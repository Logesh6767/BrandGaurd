"""
Submissions, Findings, Revisions & Approval Workflow Router (Steps 2 to 8).
Implements:
- Step 2: Content creation with [[confidential]] markers & visual/accessibility metadata
- Step 3: Hybrid automated review with evidence validation
- Step 4: Creator revisions (1-click Accept Fix with word-level diff, Manual Edit, Dismiss with reason)
- Step 5: Escalation safety net (High-severity dismissals automatically transition to ESCALATED)
- Step 6: Submit for approval gate (requires 0 OPEN findings & up-to-date review)
- Step 7: Human approval gate (blocked while ESCALATED findings remain; Reviewer must Override or Uphold)
- Step 8: Publish-ready compliance record (full version history, diffs, comments, audit & AI logs)
"""

import json
import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Header, HTTPException

from backend.auth import resolve_user_from_headers
from backend.database import db_session, log_audit, now_iso, row_to_dict, rows_to_dicts
from backend.engine.diff_utils import compute_word_diff
from backend.engine.orchestrator import execute_review_for_submission
from backend.engine.redactor import redact_confidential_sections
from backend.models import (
    FindingActionRequest,
    SubmissionCreateRequest,
    SubmissionUpdateRequest,
    WorkflowDecisionRequest,
)
from backend.seed import PRESET_SCENARIOS

router = APIRouter(prefix="/api/submissions", tags=["Content Review & Workflow"])


def _build_submission_detail(conn, submission_id: int) -> Dict[str, Any]:
    sub_row = conn.execute(
        "SELECT * FROM submissions WHERE id = ?", (submission_id,)
    ).fetchone()
    if not sub_row:
        raise HTTPException(status_code=404, detail=f"Submission {submission_id} not found")
    sub = row_to_dict(sub_row)
    assert sub is not None

    try:
        sub["image_colors"] = json.loads(sub.get("image_colors_json", "[]") or "[]")
    except Exception:
        sub["image_colors"] = []

    curr_ver = sub["current_version"]

    # Current version findings
    finding_rows = conn.execute(
        """
        SELECT * FROM findings
        WHERE submission_id = ? AND version_number = ?
        ORDER BY CASE severity WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END, id ASC
        """,
        (submission_id, curr_ver),
    ).fetchall()
    findings = rows_to_dicts(finding_rows)

    # All findings across earlier versions (for historical audit trail)
    all_finding_rows = conn.execute(
        "SELECT * FROM findings WHERE submission_id = ? ORDER BY version_number DESC, id ASC",
        (submission_id,),
    ).fetchall()
    all_findings = rows_to_dicts(all_finding_rows)

    # Attach comments per finding
    comment_rows = conn.execute(
        "SELECT * FROM finding_comments WHERE submission_id = ? ORDER BY id ASC",
        (submission_id,),
    ).fetchall()
    comments_by_finding: Dict[int, List[Dict[str, Any]]] = {}
    for c in rows_to_dicts(comment_rows):
        fid = c["finding_id"]
        comments_by_finding.setdefault(fid, []).append(c)

    for f in findings:
        f["comments"] = comments_by_finding.get(f["id"], [])
    for f in all_findings:
        f["comments"] = comments_by_finding.get(f["id"], [])

    # Revisions & word-level diffs
    version_rows = conn.execute(
        "SELECT * FROM submission_versions WHERE submission_id = ? ORDER BY version_number DESC",
        (submission_id,),
    ).fetchall()
    versions = rows_to_dicts(version_rows)
    for v in versions:
        try:
            v["diff_stats"] = json.loads(v.get("diff_stats_json", "{}") or "{}")
        except Exception:
            v["diff_stats"] = {}

    # AI disclosure logs
    ai_rows = conn.execute(
        "SELECT * FROM ai_disclosure_logs WHERE submission_id = ? ORDER BY id DESC",
        (submission_id,),
    ).fetchall()
    ai_logs = rows_to_dicts(ai_rows)
    for log_item in ai_logs:
        try:
            log_item["redacted_placeholders"] = json.loads(
                log_item.get("redacted_placeholders_json", "[]") or "[]"
            )
        except Exception:
            log_item["redacted_placeholders"] = []

    # Confidential preview info
    redacted_preview, redactions = redact_confidential_sections(sub["current_content"])

    # Compute workflow gates (Steps 5, 6, 7)
    open_findings = [f for f in findings if f["status"] == "OPEN"]
    escalated_findings = [f for f in findings if f["status"] == "ESCALATED"]
    upheld_findings = [f for f in findings if f["status"] == "UPHELD_BY_REVIEWER"]
    accepted_findings = [f for f in all_findings if f["status"] == "ACCEPTED"]
    dismissed_findings = [
        f for f in findings if f["status"] in ("DISMISSED", "OVERRIDDEN_BY_REVIEWER")
    ]

    reviewed_current = sub["last_reviewed_version"] == curr_ver
    can_submit_for_approval = (
        reviewed_current
        and len(open_findings) == 0
        and len(upheld_findings) == 0
        and sub["status"] not in ("APPROVED",)
    )

    reviewer_blocking_reasons: List[str] = []
    if not reviewed_current:
        reviewer_blocking_reasons.append("Latest content revision has not been checked yet.")
    if len(open_findings) > 0:
        reviewer_blocking_reasons.append(
            f"{len(open_findings)} open finding(s) still need resolution."
        )
    if len(escalated_findings) > 0:
        reviewer_blocking_reasons.append(
            f"{len(escalated_findings)} ESCALATED high-severity finding(s) require explicit Reviewer Override or Uphold decision (Step 5 -> Step 7 Safety Gate)."
        )
    if len(upheld_findings) > 0:
        reviewer_blocking_reasons.append(
            f"{len(upheld_findings)} upheld high-severity finding(s) require creator revision."
        )

    can_reviewer_approve = len(reviewer_blocking_reasons) == 0

    sub["findings"] = findings
    sub["all_findings_history"] = all_findings
    sub["versions"] = versions
    sub["ai_disclosure_logs"] = ai_logs
    sub["redacted_preview"] = redacted_preview
    sub["confidential_spans"] = redactions
    sub["counts"] = {
        "open": len(open_findings),
        "escalated": len(escalated_findings),
        "upheld": len(upheld_findings),
        "accepted": len(accepted_findings),
        "dismissed": len(dismissed_findings),
        "total_current": len(findings),
    }
    sub["gates"] = {
        "reviewed_current_version": reviewed_current,
        "can_submit_for_approval": can_submit_for_approval,
        "can_reviewer_approve": can_reviewer_approve,
        "reviewer_blocking_reasons": reviewer_blocking_reasons,
    }
    return sub


@router.get("/presets")
def get_preset_scenarios():
    """Return 1-click preset content scenarios for instant judge evaluation."""
    return {"presets": PRESET_SCENARIOS}


@router.get("")
def list_submissions():
    """Return all submissions with summary finding counts."""
    with db_session() as conn:
        rows = conn.execute(
            "SELECT * FROM submissions ORDER BY id ASC"
        ).fetchall()
        subs = rows_to_dicts(rows)
        result = []
        for s in subs:
            f_rows = conn.execute(
                "SELECT status, severity FROM findings WHERE submission_id = ? AND version_number = ?",
                (s["id"], s["current_version"]),
            ).fetchall()
            open_c = sum(1 for r in f_rows if r["status"] == "OPEN")
            esc_c = sum(1 for r in f_rows if r["status"] == "ESCALATED")
            s["counts"] = {
                "open": open_c,
                "escalated": esc_c,
                "total_current": len(f_rows),
            }
            result.append(s)
        return {"submissions": result}


@router.get("/{submission_id}")
def get_submission(submission_id: int):
    """Return complete submission state, findings, diffs, and workflow gates."""
    with db_session() as conn:
        return _build_submission_detail(conn, submission_id)


@router.post("")
def create_submission(
    req: SubmissionCreateRequest,
    authorization: Optional[str] = Header(default=None),
    x_brandguard_role: Optional[str] = Header(default=None),
):
    """Step 2 & Step 3: Create a new content submission and run automated brand governance review."""
    user = resolve_user_from_headers(authorization, x_brandguard_role)
    ts = now_iso()

    with db_session() as conn:
        kit_row = conn.execute(
            "SELECT version FROM brand_kits WHERE status = 'active' ORDER BY version DESC LIMIT 1"
        ).fetchone()
        kit_ver = kit_row["version"] if kit_row else 3

        cur = conn.execute(
            """
            INSERT INTO submissions (
                title, content_type, team, author_name, author_role, status, kit_version,
                current_version, current_content, fg_color, bg_color, accent_color,
                image_name, image_alt, image_colors_json, cta_link_text, cta_link_url,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                req.title.strip() or "Untitled Brand Content",
                req.content_type,
                req.team or user.get("team", "Product Marketing"),
                user["display_name"],
                user["role"],
                kit_ver,
                req.content,
                req.fg_color,
                req.bg_color,
                req.accent_color,
                req.image_name,
                req.image_alt,
                json.dumps(req.image_colors),
                req.cta_link_text,
                req.cta_link_url,
                ts,
                ts,
            ),
        )
        sub_id = cur.lastrowid

        conn.execute(
            """
            INSERT INTO submission_versions (
                submission_id, version_number, content, fg_color, bg_color, accent_color,
                image_alt, cta_link_text, change_summary, diff_html, diff_stats_json,
                created_by, created_role, created_at
            ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, 'Initial content submission (v1)', ?, ?, ?, ?, ?)
            """,
            (
                sub_id,
                req.content,
                req.fg_color,
                req.bg_color,
                req.accent_color,
                req.image_alt,
                req.cta_link_text,
                req.content,
                json.dumps(
                    {
                        "words_added": len(req.content.split()),
                        "words_removed": 0,
                        "similarity_pct": 100.0,
                    }
                ),
                user["display_name"],
                user["role"],
                ts,
            ),
        )

        log_audit(
            conn,
            actor_name=user["display_name"],
            actor_role=user["role"],
            action="CREATE_SUBMISSION",
            target_type="submission",
            target_id=str(sub_id),
            details=f"Created submission '{req.title}' (Team: {req.team}, Brand Kit v{kit_ver}).",
        )

        if req.auto_review:
            execute_review_for_submission(conn, sub_id, user["display_name"], user["role"])

        return _build_submission_detail(conn, sub_id)


@router.put("/{submission_id}")
def update_submission_content(
    submission_id: int,
    req: SubmissionUpdateRequest,
    authorization: Optional[str] = Header(default=None),
    x_brandguard_role: Optional[str] = Header(default=None),
):
    """Step 4: Save a manual edit as a new numbered revision with word-level diff and re-run review."""
    user = resolve_user_from_headers(authorization, x_brandguard_role)
    ts = now_iso()

    with db_session() as conn:
        sub_row = conn.execute(
            "SELECT * FROM submissions WHERE id = ?", (submission_id,)
        ).fetchone()
        if not sub_row:
            raise HTTPException(status_code=404, detail="Submission not found")
        sub = row_to_dict(sub_row)
        assert sub is not None

        old_content = sub["current_content"]
        new_version = sub["current_version"] + 1
        diff_html, diff_stats = compute_word_diff(old_content, req.content)

        new_title = req.title if req.title is not None else sub["title"]
        new_fg = req.fg_color if req.fg_color is not None else sub["fg_color"]
        new_bg = req.bg_color if req.bg_color is not None else sub["bg_color"]
        new_accent = req.accent_color if req.accent_color is not None else sub["accent_color"]
        new_img_name = req.image_name if req.image_name is not None else sub["image_name"]
        new_img_alt = req.image_alt if req.image_alt is not None else sub["image_alt"]
        new_img_colors = (
            json.dumps(req.image_colors)
            if req.image_colors is not None
            else sub["image_colors_json"]
        )
        new_cta_text = req.cta_link_text if req.cta_link_text is not None else sub["cta_link_text"]
        new_cta_url = req.cta_link_url if req.cta_link_url is not None else sub["cta_link_url"]

        conn.execute(
            """
            UPDATE submissions
            SET title = ?, current_version = ?, current_content = ?,
                fg_color = ?, bg_color = ?, accent_color = ?,
                image_name = ?, image_alt = ?, image_colors_json = ?,
                cta_link_text = ?, cta_link_url = ?, status = 'IN_REVIEW', updated_at = ?
            WHERE id = ?
            """,
            (
                new_title,
                new_version,
                req.content,
                new_fg,
                new_bg,
                new_accent,
                new_img_name,
                new_img_alt,
                new_img_colors,
                new_cta_text,
                new_cta_url,
                ts,
                submission_id,
            ),
        )

        conn.execute(
            """
            INSERT INTO submission_versions (
                submission_id, version_number, content, fg_color, bg_color, accent_color,
                image_alt, cta_link_text, change_summary, diff_html, diff_stats_json,
                created_by, created_role, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                submission_id,
                new_version,
                req.content,
                new_fg,
                new_bg,
                new_accent,
                new_img_alt,
                new_cta_text,
                req.change_summary,
                diff_html,
                json.dumps(diff_stats),
                user["display_name"],
                user["role"],
                ts,
            ),
        )

        log_audit(
            conn,
            actor_name=user["display_name"],
            actor_role=user["role"],
            action="SAVE_REVISION",
            target_type="submission",
            target_id=str(submission_id),
            details=f"Saved revision v{new_version}: {req.change_summary} (+{diff_stats['words_added']}/-{diff_stats['words_removed']} words).",
        )

        if req.auto_review:
            execute_review_for_submission(conn, submission_id, user["display_name"], user["role"])

        return _build_submission_detail(conn, submission_id)


@router.post("/{submission_id}/review")
def trigger_review(
    submission_id: int,
    authorization: Optional[str] = Header(default=None),
    x_brandguard_role: Optional[str] = Header(default=None),
):
    """Step 3: Explicitly re-run automated hybrid review on the current submission version."""
    user = resolve_user_from_headers(authorization, x_brandguard_role)
    with db_session() as conn:
        execute_review_for_submission(conn, submission_id, user["display_name"], user["role"])
        return _build_submission_detail(conn, submission_id)


@router.post("/{submission_id}/findings/{finding_id}/action")
def handle_finding_action(
    submission_id: int,
    finding_id: int,
    req: FindingActionRequest,
    authorization: Optional[str] = Header(default=None),
    x_brandguard_role: Optional[str] = Header(default=None),
):
    """
    Handle Creator and Reviewer actions on a specific finding:
    - accept: Applies suggested fix, creates a new revision with word-level diff, and re-runs check.
    - dismiss: Requires written reason. If severity == HIGH, triggers Step 5 Escalation (ESCALATED).
    - comment: Adds a collaborative discussion comment on the finding.
    - reviewer_override: (Reviewer/Manager/Admin) Overrides an ESCALATED finding with reason.
    - reviewer_uphold: (Reviewer/Manager/Admin) Upholds an ESCALATED finding and requests creator fix.
    """
    user = resolve_user_from_headers(authorization, x_brandguard_role)
    action = req.action.lower().strip()
    ts = now_iso()

    with db_session() as conn:
        sub_row = conn.execute(
            "SELECT * FROM submissions WHERE id = ?", (submission_id,)
        ).fetchone()
        if not sub_row:
            raise HTTPException(status_code=404, detail="Submission not found")
        sub = row_to_dict(sub_row)
        assert sub is not None

        f_row = conn.execute(
            "SELECT * FROM findings WHERE id = ? AND submission_id = ?",
            (finding_id, submission_id),
        ).fetchone()
        if not f_row:
            raise HTTPException(status_code=404, detail="Finding not found")
        finding = row_to_dict(f_row)
        assert finding is not None

        # ---------------------------------------------------------------------
        # ACTION 1: ACCEPT SUGGESTED FIX (Creates new version + word-level diff)
        # ---------------------------------------------------------------------
        if action == "accept":
            replacement = (req.custom_replacement or finding["suggested_fix"] or "").strip()
            old_content = sub["current_content"]
            new_content = old_content
            new_fg = sub["fg_color"]
            new_bg = sub["bg_color"]
            new_accent = sub["accent_color"]
            new_alt = sub["image_alt"]
            new_cta = sub["cta_link_text"]
            new_img_colors = sub["image_colors_json"]

            cat = finding["category"]
            det_text = finding["detected_text"]

            if cat == "contrast":
                new_fg = "#0F172A"
                new_bg = "#FFFFFF"
            elif cat == "visual_palette":
                new_accent = "#0F62FE"
                new_img_colors = json.dumps(["#0F62FE", "#0F172A"])
            elif cat == "accessibility_alt":
                new_alt = replacement
            elif cat == "accessibility_link" and det_text.startswith("CTA Link Text:"):
                new_cta = replacement
            else:
                # Replace detected_text in content
                if det_text and det_text in old_content:
                    new_content = old_content.replace(det_text, replacement, 1)
                elif det_text:
                    pattern = re.compile(re.escape(det_text), re.IGNORECASE)
                    new_content = pattern.sub(replacement, old_content, count=1)

                # If also CTA link matched inline
                if cat == "accessibility_link" and sub["cta_link_text"].lower() == det_text.lower():
                    new_cta = replacement

            # Mark finding ACCEPTED on the current version before incrementing
            conn.execute(
                """
                UPDATE findings
                SET status = 'ACCEPTED', resolved_by = ?, updated_at = ?
                WHERE id = ?
                """,
                (user["display_name"], ts, finding_id),
            )
            conn.execute(
                """
                INSERT INTO finding_comments (
                    finding_id, submission_id, author_name, author_role, comment_text, action_type, created_at
                ) VALUES (?, ?, ?, ?, ?, 'ACCEPT', ?)
                """,
                (
                    finding_id,
                    submission_id,
                    user["display_name"],
                    user["role"],
                    f"Accepted fix for {finding['issue_code']} ({finding['rule_id']}): \"{replacement}\". ({finding['preserved_intent']})",
                    ts,
                ),
            )

            # Save new content version with word-level diff
            new_ver = sub["current_version"] + 1
            diff_html, diff_stats = compute_word_diff(old_content, new_content)
            change_summary = (
                f"Accepted fix for {finding['issue_code']} (Rule {finding['rule_id']}): "
                f"replaced '{det_text[:45]}' -> '{replacement[:45]}'"
            )

            conn.execute(
                """
                UPDATE submissions
                SET current_version = ?, current_content = ?,
                    fg_color = ?, bg_color = ?, accent_color = ?,
                    image_alt = ?, image_colors_json = ?, cta_link_text = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    new_ver,
                    new_content,
                    new_fg,
                    new_bg,
                    new_accent,
                    new_alt,
                    new_img_colors,
                    new_cta,
                    ts,
                    submission_id,
                ),
            )
            conn.execute(
                """
                INSERT INTO submission_versions (
                    submission_id, version_number, content, fg_color, bg_color, accent_color,
                    image_alt, cta_link_text, change_summary, diff_html, diff_stats_json,
                    created_by, created_role, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    submission_id,
                    new_ver,
                    new_content,
                    new_fg,
                    new_bg,
                    new_accent,
                    new_alt,
                    new_cta,
                    change_summary,
                    diff_html,
                    json.dumps(diff_stats),
                    user["display_name"],
                    user["role"],
                    ts,
                ),
            )

            log_audit(
                conn,
                actor_name=user["display_name"],
                actor_role=user["role"],
                action="ACCEPT_SUGGESTED_FIX",
                target_type="finding",
                target_id=f"{submission_id}:{finding['issue_code']}",
                details=f"{change_summary} (Saved as v{new_ver}).",
            )

            # Re-run automated review on the new version so remaining findings update cleanly
            execute_review_for_submission(conn, submission_id, user["display_name"], user["role"])
            return _build_submission_detail(conn, submission_id)

        # ---------------------------------------------------------------------
        # ACTION 2: DISMISS FINDING (With Step 5 High-Severity Escalation Safety Net!)
        # ---------------------------------------------------------------------
        elif action == "dismiss":
            reason = req.reason.strip()
            if len(reason) < 5:
                raise HTTPException(
                    status_code=400,
                    detail="A written dismissal reason (at least 5 characters) is required for auditability.",
                )

            is_high_severity = finding["severity"].upper() == "HIGH"
            if is_high_severity:
                # Step 5 Safety Net: High-severity factual or legal findings dismissed by a creator
                # are ESCALATED instead of cleared!
                new_f_status = "ESCALATED"
                action_tag = "ESCALATE"
                comment_msg = (
                    f"Dismissal requested by {user['display_name']}: \"{reason}\" — "
                    f"⚠️ STEP 5 SAFETY NET: Finding {finding['issue_code']} ({finding['rule_id']}) is HIGH severity "
                    f"and has been automatically ESCALATED to a Brand/Legal Reviewer."
                )
                audit_action = "AUTO_ESCALATE_HIGH_RISK"
            else:
                new_f_status = "DISMISSED"
                action_tag = "DISMISS"
                comment_msg = f"Dismissed by {user['display_name']} with reason: \"{reason}\""
                audit_action = "DISMISS_FINDING"

            conn.execute(
                """
                UPDATE findings
                SET status = ?, dismiss_reason = ?, dismissed_by = ?, updated_at = ?
                WHERE id = ?
                """,
                (new_f_status, reason, user["display_name"], ts, finding_id),
            )
            conn.execute(
                """
                INSERT INTO finding_comments (
                    finding_id, submission_id, author_name, author_role, comment_text, action_type, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    finding_id,
                    submission_id,
                    user["display_name"],
                    user["role"],
                    comment_msg,
                    action_tag,
                    ts,
                ),
            )

            if is_high_severity:
                conn.execute(
                    "UPDATE submissions SET status = 'ESCALATED_REVIEW', updated_at = ? WHERE id = ?",
                    (ts, submission_id),
                )

            log_audit(
                conn,
                actor_name=user["display_name"],
                actor_role=user["role"],
                action=audit_action,
                target_type="finding",
                target_id=f"{submission_id}:{finding['issue_code']}",
                details=comment_msg,
            )
            return _build_submission_detail(conn, submission_id)

        # ---------------------------------------------------------------------
        # ACTION 3: REVIEWER OVERRIDE OR UPHOLD ON ESCALATED FINDING (Step 7)
        # ---------------------------------------------------------------------
        elif action in ("reviewer_override", "reviewer_uphold"):
            if user["role"] not in ("reviewer", "manager", "admin"):
                raise HTTPException(
                    status_code=403,
                    detail="Only a Reviewer, Manager, or Admin can resolve an ESCALATED high-severity finding. Switch role in the top bar.",
                )
            note = req.reason.strip() or (
                "Reviewer verified exception context and approved override."
                if action == "reviewer_override"
                else "Reviewer upheld rule; creator must revise before publication."
            )

            if action == "reviewer_override":
                new_f_status = "OVERRIDDEN_BY_REVIEWER"
                c_type = "OVERRIDE"
                audit_act = "REVIEWER_OVERRIDE_ESCALATION"
            else:
                new_f_status = "UPHELD_BY_REVIEWER"
                c_type = "UPHOLD"
                audit_act = "REVIEWER_UPHOLD_ESCALATION"

            conn.execute(
                """
                UPDATE findings
                SET status = ?, reviewer_decision_note = ?, resolved_by = ?, updated_at = ?
                WHERE id = ?
                """,
                (new_f_status, note, user["display_name"], ts, finding_id),
            )
            conn.execute(
                """
                INSERT INTO finding_comments (
                    finding_id, submission_id, author_name, author_role, comment_text, action_type, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    finding_id,
                    submission_id,
                    user["display_name"],
                    user["role"],
                    f"Reviewer decision ({new_f_status}): {note}",
                    c_type,
                    ts,
                ),
            )

            if action == "reviewer_uphold":
                conn.execute(
                    "UPDATE submissions SET status = 'CHANGES_REQUESTED', updated_at = ? WHERE id = ?",
                    (ts, submission_id),
                )

            log_audit(
                conn,
                actor_name=user["display_name"],
                actor_role=user["role"],
                action=audit_act,
                target_type="finding",
                target_id=f"{submission_id}:{finding['issue_code']}",
                details=f"Rule {finding['rule_id']} ({finding['issue_code']}): {note}",
            )
            return _build_submission_detail(conn, submission_id)

        # ---------------------------------------------------------------------
        # ACTION 4: COLLABORATIVE COMMENT
        # ---------------------------------------------------------------------
        elif action == "comment":
            comment_text = req.reason.strip()
            if not comment_text:
                raise HTTPException(status_code=400, detail="Comment text cannot be empty")
            conn.execute(
                """
                INSERT INTO finding_comments (
                    finding_id, submission_id, author_name, author_role, comment_text, action_type, created_at
                ) VALUES (?, ?, ?, ?, ?, 'COMMENT', ?)
                """,
                (
                    finding_id,
                    submission_id,
                    user["display_name"],
                    user["role"],
                    comment_text,
                    ts,
                ),
            )
            log_audit(
                conn,
                actor_name=user["display_name"],
                actor_role=user["role"],
                action="COMMENT_ON_FINDING",
                target_type="finding",
                target_id=f"{submission_id}:{finding['issue_code']}",
                details=f"Comment on {finding['issue_code']}: {comment_text}",
            )
            return _build_submission_detail(conn, submission_id)

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported finding action '{action}'")


@router.post("/{submission_id}/workflow")
def handle_workflow_decision(
    submission_id: int,
    req: WorkflowDecisionRequest,
    authorization: Optional[str] = Header(default=None),
    x_brandguard_role: Optional[str] = Header(default=None),
):
    """
    Execute workflow transitions (Step 6 Submit for Approval & Step 7 Human Reviewer Decision).
    """
    user = resolve_user_from_headers(authorization, x_brandguard_role)
    decision = req.decision.lower().strip()
    ts = now_iso()

    with db_session() as conn:
        detail = _build_submission_detail(conn, submission_id)
        gates = detail["gates"]
        counts = detail["counts"]

        if decision == "submit_for_approval":
            if counts["open"] > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot submit for approval while {counts['open']} open finding(s) remain. Accept a fix, edit the text, or dismiss with a reason.",
                )
            if not gates["reviewed_current_version"]:
                raise HTTPException(
                    status_code=400,
                    detail="Content has changed since the last review. Run Automated Review first.",
                )

            target_status = (
                "ESCALATED_REVIEW" if counts["escalated"] > 0 else "PENDING_APPROVAL"
            )
            conn.execute(
                "UPDATE submissions SET status = ?, updated_at = ? WHERE id = ?",
                (target_status, ts, submission_id),
            )
            log_audit(
                conn,
                actor_name=user["display_name"],
                actor_role=user["role"],
                action="SUBMIT_FOR_APPROVAL",
                target_type="submission",
                target_id=str(submission_id),
                details=(
                    f"Submitted v{detail['current_version']} for human approval "
                    f"(Status: {target_status}, Escalated findings: {counts['escalated']})."
                ),
            )
            return _build_submission_detail(conn, submission_id)

        elif decision in ("approve", "request_changes", "reject"):
            if user["role"] not in ("reviewer", "manager", "admin"):
                raise HTTPException(
                    status_code=403,
                    detail="Only Reviewer, Manager, or Admin roles can make final approval decisions. Switch your role in the top header.",
                )

            if decision == "approve":
                if not gates["can_reviewer_approve"]:
                    reasons_str = " | ".join(gates["reviewer_blocking_reasons"])
                    raise HTTPException(
                        status_code=400,
                        detail=f"Approval blocked by governance gate: {reasons_str}",
                    )
                notes = (
                    req.notes.strip()
                    or "All brand guidelines, factual citations, and accessibility checks verified. Approved for publication."
                )
                conn.execute(
                    """
                    UPDATE submissions
                    SET status = 'APPROVED', reviewer_notes = ?, approved_by = ?, approved_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (notes, user["display_name"], ts, ts, submission_id),
                )
                log_audit(
                    conn,
                    actor_name=user["display_name"],
                    actor_role=user["role"],
                    action="APPROVE_SUBMISSION",
                    target_type="submission",
                    target_id=str(submission_id),
                    details=f"Approved v{detail['current_version']} for publication. Notes: {notes}",
                )

            elif decision == "request_changes":
                notes = req.notes.strip() or "Please address the flagged brand findings and resubmit."
                conn.execute(
                    """
                    UPDATE submissions
                    SET status = 'CHANGES_REQUESTED', reviewer_notes = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (notes, ts, submission_id),
                )
                log_audit(
                    conn,
                    actor_name=user["display_name"],
                    actor_role=user["role"],
                    action="REQUEST_CHANGES",
                    target_type="submission",
                    target_id=str(submission_id),
                    details=f"Reviewer requested changes on v{detail['current_version']}: {notes}",
                )

            elif decision == "reject":
                notes = req.notes.strip() or "Rejected due to severe brand or legal policy violations."
                conn.execute(
                    """
                    UPDATE submissions
                    SET status = 'REJECTED', reviewer_notes = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (notes, ts, submission_id),
                )
                log_audit(
                    conn,
                    actor_name=user["display_name"],
                    actor_role=user["role"],
                    action="REJECT_SUBMISSION",
                    target_type="submission",
                    target_id=str(submission_id),
                    details=f"Rejected submission v{detail['current_version']}: {notes}",
                )

            return _build_submission_detail(conn, submission_id)

        else:
            raise HTTPException(status_code=400, detail=f"Unknown workflow decision '{decision}'")
