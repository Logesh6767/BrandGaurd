"""
Review Orchestrator for BrandGuard (Step 3 of 9-Step Workflow).
Coordinates:
1. Confidential [[...]] Redaction
2. Deterministic Rule Engine (facts, expiry, terms, claims, contrast, palette, alt, link, readability)
3. AI Judgment Layer + Offline Fallback (tone, nuanced claims)
4. Evidence Validator (verifies rule ID, owner, version & exact source quote)
5. Persistence of Findings and AI/Privacy Disclosure Log
"""

import hashlib
import json
import sqlite3
from typing import Any, Dict, List

from backend.database import log_audit, now_iso, row_to_dict, rows_to_dicts
from backend.engine.ai_judge import run_ai_judgment
from backend.engine.deterministic import run_deterministic_checks
from backend.engine.redactor import redact_confidential_sections
from backend.engine.validator import validate_findings_evidence


def execute_review_for_submission(
    conn: sqlite3.Connection,
    submission_id: int,
    actor_name: str = "System Automated Review",
    actor_role: str = "system",
) -> Dict[str, Any]:
    """
    Run the complete hybrid review pipeline on the latest version of `submission_id`
    and persist findings + AI disclosure logs.
    """
    sub_row = conn.execute(
        "SELECT * FROM submissions WHERE id = ?", (submission_id,)
    ).fetchone()
    if not sub_row:
        raise ValueError(f"Submission {submission_id} not found")
    submission = row_to_dict(sub_row)
    assert submission is not None

    kit_version = submission["kit_version"]
    kit_row = conn.execute(
        "SELECT * FROM brand_kits WHERE version = ?", (kit_version,)
    ).fetchone()
    if not kit_row:
        kit_row = conn.execute(
            "SELECT * FROM brand_kits ORDER BY version DESC LIMIT 1"
        ).fetchone()
    brand_kit = row_to_dict(kit_row) or {}

    rule_rows = conn.execute(
        "SELECT * FROM brand_rules WHERE kit_version = ?", (brand_kit.get("version", 3),)
    ).fetchall()
    rules_list = rows_to_dicts(rule_rows)
    rules_by_id = {r["rule_id"]: r for r in rules_list}

    original_text = submission["current_content"] or ""
    version_num = submission["current_version"]

    # Step 3a: Confidential Redaction
    redacted_text, redactions = redact_confidential_sections(original_text)
    if redactions:
        log_audit(
            conn,
            actor_name=actor_name,
            actor_role=actor_role,
            action="REDACT_CONFIDENTIAL",
            target_type="submission",
            target_id=str(submission_id),
            details=(
                f"Redacted {len(redactions)} confidential [[...]] section(s) prior to AI analysis "
                f"on v{version_num}."
            ),
        )

    # Step 3b: Deterministic Engine
    det_findings = run_deterministic_checks(submission, brand_kit, rules_by_id)

    # Step 3c: AI Judgment Layer (with Offline Heuristic Fallback)
    ai_findings, ai_meta = run_ai_judgment(redacted_text, original_text, rules_by_id)

    # Step 3d: Evidence Validator
    all_candidates = det_findings + ai_findings
    validated_findings, dropped_count = validate_findings_evidence(
        all_candidates, rules_by_id
    )

    # Clear existing OPEN findings for this exact version before inserting fresh review results
    # (Preserve any findings on this version that the user already acted on if re-running?
    # Actually, a fresh review on the current version refreshes OPEN findings while keeping history on earlier versions.)
    conn.execute(
        "DELETE FROM findings WHERE submission_id = ? AND version_number = ? AND status = 'OPEN'",
        (submission_id, version_num),
    )

    # Check existing non-open findings on this version to avoid duplicate issue codes
    existing_rows = conn.execute(
        "SELECT * FROM findings WHERE submission_id = ? AND version_number = ?",
        (submission_id, version_num),
    ).fetchall()
    existing_Rule_spans = {
        (r["rule_id"], r["detected_text"]) for r in existing_rows
    }

    ts = now_iso()
    inserted_findings: List[Dict[str, Any]] = []
    seq = len(existing_rows)

    for f in validated_findings:
        if (f["rule_id"], f["detected_text"]) in existing_Rule_spans:
            continue
        seq += 1
        issue_code = f"BG-{seq:03d}"
        cur = conn.execute(
            """
            INSERT INTO findings (
                submission_id, version_number, issue_code, rule_id, category, severity,
                detected_text, start_idx, end_idx, source_doc, owner, doc_version,
                source_quote, evidence_verified, why_flagged, suggested_fix,
                preserved_intent, confidence, needs_human_judgment, engine_source,
                status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)
            """,
            (
                submission_id,
                version_num,
                issue_code,
                f["rule_id"],
                f["category"],
                f["severity"],
                f["detected_text"],
                f["start_idx"],
                f["end_idx"],
                f["source_doc"],
                f["owner"],
                f["doc_version"],
                f["source_quote"],
                f["evidence_verified"],
                f["why_flagged"],
                f["suggested_fix"],
                f["preserved_intent"],
                f["confidence"],
                f["needs_human_judgment"],
                f["engine_source"],
                ts,
                ts,
            ),
        )
        f_copy = dict(f)
        f_copy["id"] = cur.lastrowid
        f_copy["issue_code"] = issue_code
        f_copy["status"] = "OPEN"
        inserted_findings.append(f_copy)

    # Log AI & Privacy Disclosure entry
    prompt_hash = hashlib.sha256(redacted_text.encode("utf-8")).hexdigest()[:16]
    conn.execute(
        """
        INSERT INTO ai_disclosure_logs (
            submission_id, version_number, timestamp, provider, model_name,
            confidential_spans_redacted, redacted_placeholders_json, prompt_hash,
            findings_returned, findings_validated, latency_ms, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            submission_id,
            version_num,
            ts,
            ai_meta["provider"],
            ai_meta["model_name"],
            len(redactions),
            json.dumps(redactions),
            prompt_hash,
            len(all_candidates),
            len(validated_findings),
            ai_meta["latency_ms"],
            ai_meta["status"],
        ),
    )

    # Update submission status and last_reviewed_version
    all_version_findings = rows_to_dicts(
        conn.execute(
            "SELECT * FROM findings WHERE submission_id = ? AND version_number = ?",
            (submission_id, version_num),
        ).fetchall()
    )
    open_count = sum(1 for item in all_version_findings if item["status"] == "OPEN")
    escalated_count = sum(1 for item in all_version_findings if item["status"] == "ESCALATED")

    new_status = submission["status"]
    if new_status not in ("APPROVED", "REJECTED"):
        if escalated_count > 0:
            new_status = "ESCALATED_REVIEW"
        elif open_count > 0:
            new_status = "IN_REVIEW"
        else:
            new_status = "IN_REVIEW"

    conn.execute(
        """
        UPDATE submissions
        SET last_reviewed_version = ?, status = ?, updated_at = ?
        WHERE id = ?
        """,
        (version_num, new_status, ts, submission_id),
    )

    log_audit(
        conn,
        actor_name=actor_name,
        actor_role=actor_role,
        action="RUN_AUTOMATED_REVIEW",
        target_type="submission",
        target_id=str(submission_id),
        details=(
            f"Reviewed v{version_num} against Brand Kit v{brand_kit.get('version', 3)}: "
            f"{len(validated_findings)} verified findings ({dropped_count} ungrounded dropped, "
            f"{len(redactions)} confidential spans redacted)."
        ),
    )

    return {
        "submission_id": submission_id,
        "version_number": version_num,
        "kit_version": brand_kit.get("version", 3),
        "redactions": redactions,
        "ai_disclosure": ai_meta,
        "findings_count": len(all_version_findings),
        "open_count": open_count,
        "escalated_count": escalated_count,
    }
