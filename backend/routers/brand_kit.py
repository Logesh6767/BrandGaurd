"""
Brand Knowledge Base & Versioning API Routes (Step 1 of 9-Step Workflow).
Allows inspecting and managing Brand Kit versions, rules, facts, claims,
terminology, visual palettes, and clarifying ambiguous guidelines.
"""

import json
from typing import Optional
from fastapi import APIRouter, Header, HTTPException

from backend.auth import resolve_user_from_headers
from backend.database import db_session, log_audit, now_iso, row_to_dict, rows_to_dicts
from backend.models import ClarifyRuleRequest, RuleCreateRequest

router = APIRouter(prefix="/api/brand-kits", tags=["Brand Knowledge Base"])


def _format_rule(r: dict) -> dict:
    out = dict(r)
    try:
        out["disallow_terms"] = json.loads(out.get("disallow_terms_json", "[]") or "[]")
    except Exception:
        out["disallow_terms"] = []
    try:
        out["metadata"] = json.loads(out.get("metadata_json", "{}") or "{}")
    except Exception:
        out["metadata"] = {}
    return out


@router.get("")
def get_brand_kits(version: Optional[int] = None):
    """Return all Brand Kit versions and the full rule set for the active or requested version."""
    with db_session() as conn:
        kits_rows = conn.execute(
            "SELECT * FROM brand_kits ORDER BY version DESC"
        ).fetchall()
        kits = rows_to_dicts(kits_rows)
        for k in kits:
            try:
                k["voice_descriptors"] = json.loads(k.get("voice_descriptors_json", "[]") or "[]")
            except Exception:
                k["voice_descriptors"] = []

        if not kits:
            return {"kits": [], "active_kit": None, "rules": []}

        selected_kit = None
        if version is not None:
            selected_kit = next((k for k in kits if k["version"] == version), None)
        if not selected_kit:
            selected_kit = next((k for k in kits if k["status"] == "active"), kits[0])

        rule_rows = conn.execute(
            "SELECT * FROM brand_rules WHERE kit_version = ? ORDER BY category, rule_id",
            (selected_kit["version"],),
        ).fetchall()
        rules = [_format_rule(dict(r)) for r in rule_rows]

        return {
            "kits": kits,
            "active_kit": selected_kit,
            "rules": rules,
        }


@router.post("/rules")
def create_or_update_rule(
    req: RuleCreateRequest,
    authorization: Optional[str] = Header(default=None),
    x_brandguard_role: Optional[str] = Header(default=None),
):
    """Add or update a rule in the active Brand Kit (Step 1 — Admin / Brand Owner)."""
    user = resolve_user_from_headers(authorization, x_brandguard_role)
    if user["role"] not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Only Admin or Brand Manager roles can modify the Brand Knowledge Base. Use the header role switcher to switch to Admin.",
        )

    with db_session() as conn:
        kit_row = conn.execute(
            "SELECT * FROM brand_kits WHERE status = 'active' ORDER BY version DESC LIMIT 1"
        ).fetchone()
        if not kit_row:
            raise HTTPException(status_code=404, detail="No active Brand Kit found")
        kit = row_to_dict(kit_row)
        assert kit is not None
        kit_ver = kit["version"]

        existing = conn.execute(
            "SELECT id FROM brand_rules WHERE kit_version = ? AND rule_id = ?",
            (kit_ver, req.rule_id.strip().upper()),
        ).fetchone()

        rule_id_clean = req.rule_id.strip().upper()
        if existing:
            conn.execute(
                """
                UPDATE brand_rules
                SET category = ?, title = ?, source_doc = ?, owner = ?, doc_version = ?,
                    severity = ?, exact_quote = ?, pattern = ?, disallow_terms_json = ?,
                    preferred_replacement = ?, preserved_intent = ?, expiry_date = ?, metadata_json = ?
                WHERE id = ?
                """,
                (
                    req.category,
                    req.title,
                    req.source_doc,
                    req.owner,
                    req.doc_version,
                    req.severity.upper(),
                    req.exact_quote,
                    req.pattern,
                    json.dumps(req.disallow_terms),
                    req.preferred_replacement,
                    req.preserved_intent,
                    req.expiry_date,
                    json.dumps(req.metadata),
                    existing["id"],
                ),
            )
            action_verb = "UPDATE_BRAND_RULE"
        else:
            conn.execute(
                """
                INSERT INTO brand_rules (
                    kit_version, rule_id, category, title, source_doc, owner, doc_version,
                    severity, exact_quote, pattern, disallow_terms_json, preferred_replacement,
                    preserved_intent, expiry_date, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    kit_ver,
                    rule_id_clean,
                    req.category,
                    req.title,
                    req.source_doc,
                    req.owner,
                    req.doc_version,
                    req.severity.upper(),
                    req.exact_quote,
                    req.pattern,
                    json.dumps(req.disallow_terms),
                    req.preferred_replacement,
                    req.preserved_intent,
                    req.expiry_date,
                    json.dumps(req.metadata),
                ),
            )
            action_verb = "ADD_BRAND_RULE"

        log_audit(
            conn,
            actor_name=user["display_name"],
            actor_role=user["role"],
            action=action_verb,
            target_type="brand_rule",
            target_id=rule_id_clean,
            details=f"{action_verb} {rule_id_clean} ('{req.title}') in Brand Kit v{kit_ver} (Source: {req.source_doc}).",
        )

    return get_brand_kits()


@router.post("/clarify-rule")
def clarify_ambiguous_rule(
    req: ClarifyRuleRequest,
    authorization: Optional[str] = Header(default=None),
    x_brandguard_role: Optional[str] = Header(default=None),
):
    """
    Step 9 Learning Loop Action: Clarify a rule flagged by the Ambiguous-Guideline Detector
    so future content checks apply the refined guidance.
    """
    user = resolve_user_from_headers(authorization, x_brandguard_role)
    with db_session() as conn:
        kit_row = conn.execute(
            "SELECT * FROM brand_kits WHERE status = 'active' ORDER BY version DESC LIMIT 1"
        ).fetchone()
        if not kit_row:
            raise HTTPException(status_code=404, detail="No active Brand Kit")
        kit_ver = kit_row["version"]

        rule_row = conn.execute(
            "SELECT * FROM brand_rules WHERE kit_version = ? AND rule_id = ?",
            (kit_ver, req.rule_id),
        ).fetchone()
        if not rule_row:
            raise HTTPException(status_code=404, detail=f"Rule {req.rule_id} not found")

        rule = row_to_dict(rule_row)
        assert rule is not None
        meta = {}
        try:
            meta = json.loads(rule.get("metadata_json", "{}") or "{}")
        except Exception:
            meta = {}
        meta["clarified_at"] = now_iso()
        meta["clarified_by"] = user["display_name"]
        meta["clarification_note"] = req.clarification_note
        meta["ambiguity_resolved"] = True

        new_pref = (
            req.updated_preferred_replacement
            if req.updated_preferred_replacement is not None
            else rule["preferred_replacement"]
        )
        new_doc_ver = (
            f"{rule['doc_version']}-clarified"
            if not str(rule["doc_version"]).endswith("-clarified")
            else rule["doc_version"]
        )

        conn.execute(
            """
            UPDATE brand_rules
            SET exact_quote = ?, preferred_replacement = ?, doc_version = ?, metadata_json = ?
            WHERE id = ?
            """,
            (req.updated_exact_quote, new_pref, new_doc_ver, json.dumps(meta), rule["id"]),
        )

        log_audit(
            conn,
            actor_name=user["display_name"],
            actor_role=user["role"],
            action="CLARIFY_AMBIGUOUS_GUIDELINE",
            target_type="brand_rule",
            target_id=req.rule_id,
            details=(
                f"Learning Loop: Clarified rule {req.rule_id} ({new_doc_ver}) based on creator dismissal "
                f"feedback: '{req.updated_exact_quote}'"
            ),
        )

    return {"status": "ok", "rule_id": req.rule_id, "updated_kit": get_brand_kits()}
