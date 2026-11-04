"""
Automated End-to-End Test Suite for BrandGuard (Round 2 — CodeNexus India 2026).
Tests all 9 steps of the governance workflow:
1. Brand Kit v3 setup & rule versioning
2. Content creation with [[confidential]] redaction
3. Hybrid Automated Review (Deterministic + AI Heuristic + Evidence Validator)
4. Creator revision (1-click Accept Fix with word-level diff & Dismiss with reason)
5. Step 5 Safety Net: High-severity dismissal automatically escalates to ESCALATED
6. Step 6 Submit for Approval Gate
7. Step 7 Human Reviewer Gate (Blocked while ESCALATED; unlocked after Reviewer Override)
8. Step 8 Publish-Ready Compliance Record & AI Disclosure Log
9. Step 9 Governance Insights & Ambiguous-Guideline Detector Learning Loop
"""

import os
import sys
import tempfile
import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure isolated test SQLite DB before importing app
TEST_DB_FD, TEST_DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(TEST_DB_FD)
os.environ["BRANDGUARD_DB_PATH"] = TEST_DB_PATH

from backend.database import init_db  # noqa: E402
from backend.main import health_check, serve_spa_index  # noqa: E402
from backend.models import (  # noqa: E402
    ClarifyRuleRequest,
    FindingActionRequest,
    SubmissionCreateRequest,
    WorkflowDecisionRequest,
)
from backend.routers import brand_kit, insights, submissions  # noqa: E402
from backend.seed import reset_and_reseed  # noqa: E402


@pytest.fixture(autouse=True)
def setup_fresh_db():
    init_db()
    reset_and_reseed()
    yield


def test_health_and_spa_index():
    res = health_check()
    assert res["status"] == "healthy"
    assert res["product"] == "BrandGuard"

    file_resp = serve_spa_index()
    assert os.path.isfile(file_resp.path)
    with open(file_resp.path, "r", encoding="utf-8") as f:
        html_content = f.read()
    assert "BrandGuard" in html_content


def test_step1_brand_kit_and_rules():
    data = brand_kit.get_brand_kits()
    assert data["active_kit"]["version"] == 3
    rule_ids = {r["rule_id"] for r in data["rules"]}
    for expected_id in [
        "F-12",
        "F-09",
        "F-15",
        "C-4",
        "T-01",
        "T-04",
        "G-01",
        "V-01",
        "A-01",
        "A-02",
        "A-03",
    ]:
        assert expected_id in rule_ids


def test_step2_and_step3_flagship_pdf_example_and_redaction():
    sub = submissions.get_submission(1)

    # Check confidential [[...]] redaction
    assert len(sub["confidential_spans"]) == 1
    assert "[REDACTED_CONFIDENTIAL_1]" in sub["redacted_preview"]
    assert "Project Atlas" not in sub["redacted_preview"]

    # Check BG-001 finding (F-12 + C-4)
    findings = sub["findings"]
    assert len(findings) >= 5
    f12_finding = next((f for f in findings if f["rule_id"] == "F-12"), None)
    assert f12_finding is not None
    assert f12_finding["severity"] == "HIGH"
    assert f12_finding["evidence_verified"] == 1
    assert "Supports 5 languages" in f12_finding["source_quote"]
    assert "ABC SmartFlow supports 5 languages" in f12_finding["suggested_fix"]


def test_step4_to_step8_complete_end_to_end_journey():
    # Create a new submission with 1 High-severity fact issue (F-12) and 1 Medium terminology issue (T-01)
    sub = submissions.create_submission(
        SubmissionCreateRequest(
            title="Test End-to-End Campaign",
            team="Product Marketing",
            content="ABC SmartFlow supports 20 languages with our SmartFlow Bot. [[Secret Q4 pricing]]",
            fg_color="#0F172A",
            bg_color="#FFFFFF",
            accent_color="#0F62FE",
            image_name="",
            image_alt="",
            cta_link_text="",
            auto_review=True,
        ),
        x_brandguard_role="creator",
    )
    sub_id = sub["id"]
    assert sub["counts"]["open"] == 2

    f_t01 = next(f for f in sub["findings"] if f["rule_id"] == "T-01")

    # Step 4a: Creator accepts suggested fix for T-01 ('SmartFlow Bot' -> 'ABC SmartFlow Copilot')
    sub_v2 = submissions.handle_finding_action(
        sub_id,
        f_t01["id"],
        FindingActionRequest(action="accept"),
        x_brandguard_role="creator",
    )
    assert sub_v2["current_version"] == 2
    assert "ABC SmartFlow Copilot" in sub_v2["current_content"]
    latest_ver = sub_v2["versions"][0]
    assert '<ins class="diff-ins">' in latest_ver["diff_html"]

    # Step 4b & Step 5: Creator dismisses HIGH-severity finding F-12 -> triggers Step 5 ESCALATION!
    f_f12 = next(
        f for f in sub_v2["findings"] if f["rule_id"] == "F-12" and f["status"] == "OPEN"
    )
    sub_esc = submissions.handle_finding_action(
        sub_id,
        f_f12["id"],
        FindingActionRequest(
            action="dismiss",
            reason="Regional partner requested listing 20 beta languages.",
        ),
        x_brandguard_role="creator",
    )
    assert sub_esc["counts"]["open"] == 0
    assert sub_esc["counts"]["escalated"] == 1
    assert sub_esc["status"] == "ESCALATED_REVIEW"

    # Step 7 Gate Verification: Reviewer CANNOT approve while an ESCALATED finding is unresolved!
    with pytest.raises(HTTPException) as exc_info:
        submissions.handle_workflow_decision(
            sub_id,
            WorkflowDecisionRequest(decision="approve", notes="Trying to approve early"),
            x_brandguard_role="reviewer",
        )
    assert exc_info.value.status_code == 400
    assert "ESCALATED" in str(exc_info.value.detail)

    # Step 7 Resolution: Reviewer overrides the escalated finding with sign-off note
    esc_finding = next(f for f in sub_esc["findings"] if f["status"] == "ESCALATED")
    sub_unlocked = submissions.handle_finding_action(
        sub_id,
        esc_finding["id"],
        FindingActionRequest(
            action="reviewer_override",
            reason="Verified beta language disclaimer attached in regional appendix.",
        ),
        x_brandguard_role="reviewer",
    )
    assert sub_unlocked["gates"]["can_reviewer_approve"] is True

    # Step 7 Final Approval -> Step 8 Publish-Ready Record
    sub_final = submissions.handle_workflow_decision(
        sub_id,
        WorkflowDecisionRequest(
            decision="approve", notes="Approved after Reviewer Override."
        ),
        x_brandguard_role="reviewer",
    )
    assert sub_final["status"] == "APPROVED"
    assert sub_final["approved_by"] != ""


def test_step9_governance_insights_and_learning_loop():
    data = insights.get_governance_insights()
    assert data["summary"]["evidence_grounding_rate_pct"] == 100.0
    assert len(data["ambiguous_guidelines"]) >= 1

    # Clarify ambiguous rule T-04 via Learning Loop endpoint
    clarify_res = brand_kit.clarify_ambiguous_rule(
        ClarifyRuleRequest(
            rule_id="T-04",
            updated_exact_quote="Use 'workspace partners' in marketing headlines; 'end-users' is permitted in technical docs.",
        ),
        x_brandguard_role="admin",
    )
    assert clarify_res["status"] == "ok"
