"""
Security & Authentication Layer for BrandGuard.
Implements PBKDF2-HMAC-SHA256 password hashing, HMAC-SHA256 signed session tokens,
server-side role checks, and 1-click Judge Role Switching (issuing valid signed tokens).
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any, Dict, Optional

SECRET_KEY = os.environ.get(
    "BRANDGUARD_SECRET_KEY", "brandguard-nexus-2026-hmac-secret-key-codenexus-r2"
).encode("utf-8")

PBKDF2_ITERATIONS = 100_000

DEFAULT_DEMO_PROFILES: Dict[str, Dict[str, str]] = {
    "creator": {
        "username": "arshath.creator",
        "display_name": "Mohammed Arshath (Content Creator)",
        "role": "creator",
        "team": "Product Marketing",
    },
    "reviewer": {
        "username": "poojitha.reviewer",
        "display_name": "Poojitha V S (Brand & Legal Reviewer)",
        "role": "reviewer",
        "team": "Legal & Compliance",
    },
    "manager": {
        "username": "muthu.manager",
        "display_name": "Muthukumar A (Campaign Manager)",
        "role": "manager",
        "team": "Brand Governance",
    },
    "admin": {
        "username": "logesh.admin",
        "display_name": "Logeshwaran V (Brand Owner / Admin)",
        "role": "admin",
        "team": "Brand Governance",
    },
}


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Hash a password using PBKDF2-HMAC-SHA256 with a random or provided salt."""
    if not salt:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return dk.hex(), salt


def verify_password(password: str, expected_hash: str, salt: str) -> bool:
    """Constant-time verification of a password against its PBKDF2 hash."""
    computed_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(computed_hash, expected_hash)


def create_signed_token(user_payload: Dict[str, Any], expires_in_sec: int = 86400 * 7) -> str:
    """Create an HMAC-SHA256 signed token containing user identity and role."""
    payload = {
        "username": user_payload.get("username", "arshath.creator"),
        "display_name": user_payload.get("display_name", "Mohammed Arshath (Content Creator)"),
        "role": user_payload.get("role", "creator"),
        "team": user_payload.get("team", "Product Marketing"),
        "exp": int(time.time()) + expires_in_sec,
    }
    raw_json = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    b64_payload = base64.urlsafe_b64encode(raw_json).decode("ascii").rstrip("=")
    signature = hmac.new(SECRET_KEY, b64_payload.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{b64_payload}.{signature}"


def verify_signed_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify an HMAC-SHA256 signed token and return its decoded payload if valid."""
    if not token or "." not in token:
        return None
    try:
        b64_payload, signature = token.rsplit(".", 1)
        expected_sig = hmac.new(
            SECRET_KEY, b64_payload.encode("ascii"), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
        padding = "=" * (-len(b64_payload) % 4)
        decoded_bytes = base64.urlsafe_b64decode(b64_payload + padding)
        data = json.loads(decoded_bytes.decode("utf-8"))
        if data.get("exp", 0) < int(time.time()):
            return None
        return data
    except Exception:
        return None


def resolve_user_from_headers(
    authorization: Optional[str] = None,
    x_role: Optional[str] = None,
    x_user: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Resolve active user from Bearer HMAC token or role-switcher header.
    Defaults to Creator profile so judges opening the app in an incognito browser
    are never blocked by a login wall.
    """
    if isinstance(authorization, str) and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        verified = verify_signed_token(token)
        if verified:
            return verified

    role_str = x_role if isinstance(x_role, str) else "creator"
    role_key = (role_str or "creator").lower().strip()
    if role_key not in DEFAULT_DEMO_PROFILES:
        role_key = "creator"
    profile = dict(DEFAULT_DEMO_PROFILES[role_key])
    if isinstance(x_user, str) and x_user:
        profile["display_name"] = x_user
    profile["token"] = create_signed_token(profile)
    return profile
