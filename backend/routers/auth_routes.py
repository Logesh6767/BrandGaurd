"""
Authentication & Role Switching API Routes.
Supports PBKDF2 login, HMAC-signed bearer tokens, and 1-click Judge Role Switching.
"""

from typing import Optional
from fastapi import APIRouter, Header, HTTPException

from backend.auth import (
    DEFAULT_DEMO_PROFILES,
    create_signed_token,
    resolve_user_from_headers,
    verify_password,
)
from backend.database import db_session, log_audit, row_to_dict
from backend.models import LoginRequest, RoleSwitchRequest

router = APIRouter(prefix="/api/auth", tags=["Authentication & Roles"])


@router.get("/me")
def get_current_user(
    authorization: Optional[str] = Header(default=None),
    x_brandguard_role: Optional[str] = Header(default=None),
    x_brandguard_user: Optional[str] = Header(default=None),
):
    """Return active user profile and all available demo role profiles."""
    active = resolve_user_from_headers(authorization, x_brandguard_role, x_brandguard_user)
    return {
        "user": active,
        "available_roles": list(DEFAULT_DEMO_PROFILES.values()),
    }


@router.post("/switch-role")
def switch_role(req: RoleSwitchRequest):
    """Issue a valid HMAC-SHA256 signed token for the selected role (Judge 1-Click Switcher)."""
    role_key = req.role.lower().strip()
    if role_key not in DEFAULT_DEMO_PROFILES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{req.role}'")

    profile = dict(DEFAULT_DEMO_PROFILES[role_key])
    token = create_signed_token(profile)
    profile["token"] = token

    with db_session() as conn:
        log_audit(
            conn,
            actor_name=profile["display_name"],
            actor_role=profile["role"],
            action="SWITCH_ACTIVE_ROLE",
            target_type="session",
            target_id=profile["username"],
            details=f"Switched active workspace role to '{profile['role'].upper()}' ({profile['display_name']}).",
        )

    return {"user": profile, "token": token}


@router.post("/login")
def login(req: LoginRequest):
    """Authenticate a user with PBKDF2-HMAC-SHA256 and issue an HMAC-signed token."""
    with db_session() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (req.username.strip(),)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        user = row_to_dict(row)
        assert user is not None

        if not verify_password(req.password, user["password_hash"], user["salt"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")

        payload = {
            "username": user["username"],
            "display_name": user["display_name"],
            "role": user["role"],
            "team": user["team"],
        }
        token = create_signed_token(payload)
        payload["token"] = token

        log_audit(
            conn,
            actor_name=user["display_name"],
            actor_role=user["role"],
            action="USER_LOGIN",
            target_type="user",
            target_id=user["username"],
            details="Authenticated via PBKDF2 password verification and issued HMAC-signed token.",
        )
        return {"user": payload, "token": token}
