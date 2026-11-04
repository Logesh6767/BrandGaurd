"""
Seed Data & Interactive Preset Scenarios for BrandGuard.
Populates:
- 4 Team Nexus role profiles (Admin, Creator, Reviewer, Manager)
- Brand Kits v1, v2, and active v3 ("ABC SmartFlow Global Brand Kit v3")
- 12 comprehensive rules across Facts (with expiry), Claims, Terminology, Tone, Visual Palette, and Accessibility
- Pre-seeded submissions covering every stage of the 9-step workflow:
  1. Active Creator Review (with the exact BG-001 example from Page 3 of the Round 1 PDF)
  2. Escalated High-Risk Submission (demonstrating Step 5 Amber Escalation & Step 7 Reviewer Gate)
  3. Approved Publish-Ready Submission with multi-version word-level diffs (Step 8)
  4. Historical findings across teams powering Step 9 Governance Insights & Ambiguous-Guideline Detector
"""

import json
import sqlite3
from typing import Any, Dict, List

from backend.auth import hash_password
from backend.database import db_session, log_audit, now_iso
from backend.engine.diff_utils import compute_word_diff
from backend.engine.orchestrator import execute_review_for_submission


PRESET_SCENARIOS: List[Dict[str, Any]] = [
    {
        "id": "scenario_pdf_flagship",
        "name": "Scenario 1: Round 1 PDF Flagship Example (BG-001 + Multi-Rule Check)",
        "title": "ABC SmartFlow Q4 Global Product Launch Post",
        "content_type": "product_copy",
        "team": "Product Marketing",
        "content": (
            "ABC SmartFlow supports 20 languages and guarantees 100% growth. "
            "Our new SmartFlow Bot crushes the competition and starts at just $19/month for new teams. "
            "[[Confidential internal launch note: Q4 enterprise margin target is 44% under Project Atlas]] "
            "To get started today, click here."
        ),
        "fg_color": "#78869B",
        "bg_color": "#FFFFFF",
        "accent_color": "#FF00AA",
        "image_name": "smartflow-hero-launch.png",
        "image_alt": "banner",
        "image_colors": ["#FF00AA", "#0F62FE"],
        "cta_link_text": "click here",
        "cta_link_url": "https://abc-smartflow.example.com/launch",
    },
    {
        "id": "scenario_agency_claims",
        "name": "Scenario 2: External Agency Ad Campaign (SLA & Comparative Claims)",
        "title": "External Agency Paid Social — Zero Downtime Campaign",
        "content_type": "ad_campaign",
        "team": "External Agency",
        "content": (
            "Tired of slow approvals? ABC SmartFlow delivers 100% uptime and cuts review time by 95% "
            "for all end-users. It is a cheap automation solution that guarantees 100% ROI in week one. "
            "[[Agency retainer rate card: $8,500/mo confidential]]"
        ),
        "fg_color": "#0F172A",
        "bg_color": "#FFFFFF",
        "accent_color": "#0F62FE",
        "image_name": "agency-social-card.png",
        "image_alt": "ABC SmartFlow enterprise workflow comparison chart showing 5 supported languages",
        "image_colors": ["#0F62FE", "#10B981"],
        "cta_link_text": "Explore Enterprise Benchmark Report",
        "cta_link_url": "https://abc-smartflow.example.com/benchmark",
    },
    {
        "id": "scenario_clean_compliant",
        "name": "Scenario 3: Fully Compliant Copy (Ready for 1-Click Approval)",
        "title": "Q4 Enterprise Customer Newsletter — Workflow Governance",
        "content_type": "email_campaign",
        "team": "Product Marketing",
        "content": (
            "ABC SmartFlow supports 5 languages and helps businesses improve operational efficiency. "
            "With ABC SmartFlow Copilot and our 99.9% contractual uptime SLA, teams can streamline "
            "pre-publication checks starting with the $29/month Pro Starter plan."
        ),
        "fg_color": "#0F172A",
        "bg_color": "#FFFFFF",
        "accent_color": "#0F62FE",
        "image_name": "newsletter-header.png",
        "image_alt": "ABC SmartFlow Copilot interface showing verified brand rule citations",
        "image_colors": ["#0F62FE", "#0F172A"],
        "cta_link_text": "Read the Product Specification v3 Overview",
        "cta_link_url": "https://abc-smartflow.example.com/specs",
    },
]


def seed_if_empty() -> None:
    """Seed the SQLite database on first startup if no brand kits exist."""
    with db_session() as conn:
        count = conn.execute("SELECT COUNT(*) FROM brand_kits").fetchone()[0]
        if count > 0:
            return
        _populate_initial_data(conn)


def reset_and_reseed() -> None:
    """Reset all tables and re-seed fresh demo data (useful for judges wanting a clean slate)."""
    with db_session() as conn:
        for table in [
            "finding_comments",
            "findings",
            "submission_versions",
            "ai_disclosure_logs",
            "submissions",
            "brand_rules",
            "brand_kits",
            "audit_logs",
            "users",
        ]:
            conn.execute(f"DELETE FROM {table}")
        conn.execute("DELETE FROM sqlite_sequence")
        _populate_initial_data(conn)


def _populate_initial_data(conn: sqlite3.Connection) -> None:
    ts = now_iso()

    # 1. Seed Users (Team Nexus members mapped to the 4 governance roles)
    users_data = [
        ("logesh.admin", "Logeshwaran V (Brand Owner / Admin)", "admin", "Brand Governance", "nexus2026"),
        ("muthu.manager", "Muthukumar A (Campaign Manager)", "manager", "Brand Governance", "nexus2026"),
        ("arshath.creator", "Mohammed Arshath (Content Creator)", "creator", "Product Marketing", "nexus2026"),
        ("poojitha.reviewer", "Poojitha V S (Brand & Legal Reviewer)", "reviewer", "Legal & Compliance", "nexus2026"),
    ]
    for uname, dname, role, team, pwd in users_data:
        pw_hash, salt = hash_password(pwd)
        conn.execute(
            """
            INSERT INTO users (username, display_name, role, team, password_hash, salt, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (uname, dname, role, team, pw_hash, salt, ts),
        )

    # 2. Seed Brand Kits (v1, v2 archived; v3 active)
    kits = [
        (
            1,
            "ABC SmartFlow Global Brand Kit v1",
            "Initial launch terminology and basic colour palette.",
            "archived",
            json.dumps(["Clear", "Professional"]),
            11.0,
            4.5,
            3.0,
            "Logeshwaran V (Brand Owner / Admin)",
            "2026-03-15T10:00:00Z",
        ),
        (
            2,
            "ABC SmartFlow Global Brand Kit v2",
            "Added initial product facts and legacy $19/month starter pricing.",
            "archived",
            json.dumps(["Clear", "Evidence-based", "Helpful"]),
            10.5,
            4.5,
            3.0,
            "Logeshwaran V (Brand Owner / Admin)",
            "2026-06-01T10:00:00Z",
        ),
        (
            3,
            "ABC SmartFlow Global Brand Kit v3",
            "Enterprise governance kit with verified Product Spec v3 facts, Claims Policy C-4, WCAG 2.1 AA rules, and expiry dates.",
            "active",
            json.dumps(["Evidence-led", "Respectful", "Clear", "Enterprise-ready"]),
            10.0,
            4.5,
            3.0,
            "Logeshwaran V (Brand Owner / Admin)",
            "2026-10-15T09:30:00Z",
        ),
    ]
    for k in kits:
        conn.execute(
            """
            INSERT INTO brand_kits (
                version, name, description, status, voice_descriptors_json,
                target_reading_grade, min_contrast_normal, min_contrast_large,
                created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            k,
        )

    # 3. Seed Brand Rules for Active Brand Kit v3
    rules_v3 = [
        {
            "rule_id": "F-12",
            "category": "fact",
            "title": "Supported Languages Count (5 Languages)",
            "source_doc": "Product Specification v3",
            "owner": "Product Team",
            "doc_version": "v3.0",
            "severity": "HIGH",
            "exact_quote": "Supports 5 languages: ABC SmartFlow officially supports 5 languages (English, Hindi, Tamil, Spanish, and German) in v3.",
            "pattern": r"\bsupports\s+(?!5\b)\d+\s+languages\b",
            "disallow_terms": ["supports 20 languages", "supports 10 languages", "supports 50 languages"],
            "preferred_replacement": "supports 5 languages",
            "preserved_intent": "Preserves: global product capability statement with verified language count.",
            "expiry_date": "2027-12-31",
            "metadata": {"approved_value": "5 languages"},
        },
        {
            "rule_id": "F-09",
            "category": "fact",
            "title": "Starter Tier Pricing (Expired Q2 Promo)",
            "source_doc": "Pricing & Packaging Sheet v2.4",
            "owner": "Revenue Operations",
            "doc_version": "v2.4",
            "severity": "HIGH",
            "exact_quote": "Introductory $19/month starter pricing expired on 2026-06-30; current approved entry tier is the $29/month Pro Starter plan.",
            "pattern": r"\$19(?:\.00)?\s*(?:/|\s+per\s+)\s*month",
            "disallow_terms": ["$19/month", "$19 per month"],
            "preferred_replacement": "$29/month Pro Starter plan",
            "preserved_intent": "Preserves: accessible entry pricing callout using current approved rate.",
            "expiry_date": "2026-06-30",
            "metadata": {"expired": True, "current_price": "$29/month"},
        },
        {
            "rule_id": "F-15",
            "category": "fact",
            "title": "Enterprise Uptime SLA Specification",
            "source_doc": "Enterprise Master SLA v3.1",
            "owner": "Cloud Infrastructure & Legal",
            "doc_version": "v3.1",
            "severity": "HIGH",
            "exact_quote": "ABC SmartFlow provides a contractually backed 99.9% uptime SLA across all production regions; never claim 100% uptime.",
            "pattern": r"\b(?:100%|99\.999%)\s+uptime\b",
            "disallow_terms": ["100% uptime", "zero downtime guarantee"],
            "preferred_replacement": "99.9% contractual uptime SLA",
            "preserved_intent": "Preserves: enterprise reliability assurance within legal SLA commitments.",
            "expiry_date": "2027-12-31",
            "metadata": {"approved_sla": "99.9%"},
        },
        {
            "rule_id": "C-4",
            "category": "claim",
            "title": "No Unsupported Growth or ROI Guarantees",
            "source_doc": "Claims Policy v3",
            "owner": "Legal & Compliance Team",
            "doc_version": "v3.0",
            "severity": "HIGH",
            "exact_quote": "Claims Policy rule C-4: no unsupported guarantees. Copy must not promise guaranteed percentage growth, 100% ROI, or risk-free financial outcomes.",
            "pattern": r"\b(?:guarantees?\s+\d+%\s+(?:growth|ROI|revenue)|100%\s+risk-free|guarantees?\s+instant\s+ROI)\b",
            "disallow_terms": ["guarantees 100% growth", "guarantees 100% ROI", "100% risk-free"],
            "preferred_replacement": "helps businesses improve operational efficiency",
            "preserved_intent": "Preserves: product benefit and positive tone.",
            "expiry_date": None,
            "metadata": {},
        },
        {
            "rule_id": "C-02",
            "category": "claim",
            "title": "Substantiated Comparative Speed Claims",
            "source_doc": "Claims Policy v3",
            "owner": "Legal & Compliance Team",
            "doc_version": "v3.0",
            "severity": "MEDIUM",
            "exact_quote": "Rule C-02: Quantified speed or time-saving claims must cite the Q3 2026 Enterprise Benchmark Study (up to 60% faster review cycles).",
            "pattern": "",
            "disallow_terms": [],
            "preferred_replacement": "reduces review turnaround time by up to 60% based on the Q3 2026 Enterprise Benchmark Study",
            "preserved_intent": "Preserves: quantified speed advantage backed by verified benchmark evidence.",
            "expiry_date": None,
            "metadata": {},
        },
        {
            "rule_id": "T-01",
            "category": "terminology",
            "title": "Approved AI Assistant Naming ('ABC SmartFlow Copilot')",
            "source_doc": "Brand Lexicon & Messaging Guide v3",
            "owner": "Brand Team",
            "doc_version": "v3.0",
            "severity": "MEDIUM",
            "exact_quote": "Refer to intelligent features as 'ABC SmartFlow Copilot'; do not use 'SmartFlow Bot', 'ABC Bot', or 'Auto-Writer Bot'.",
            "pattern": "",
            "disallow_terms": ["SmartFlow Bot", "ABC Bot", "Auto-Writer Bot"],
            "preferred_replacement": "ABC SmartFlow Copilot",
            "preserved_intent": "Preserves: reference to AI assistance while emphasizing human-in-the-loop control.",
            "expiry_date": None,
            "metadata": {},
        },
        {
            "rule_id": "T-02",
            "category": "terminology",
            "title": "Enterprise Value Positioning Terminology",
            "source_doc": "Brand Lexicon & Messaging Guide v3",
            "owner": "Brand Team",
            "doc_version": "v3.0",
            "severity": "LOW",
            "exact_quote": "Do not describe ABC SmartFlow as 'cheap automation' or 'budget software'; use 'cost-effective workflow automation'.",
            "pattern": "",
            "disallow_terms": ["cheap automation", "cheap tool", "cheap software", "budget tool"],
            "preferred_replacement": "cost-effective workflow automation",
            "preserved_intent": "Preserves: cost-efficiency message without undermining enterprise trust.",
            "expiry_date": None,
            "metadata": {},
        },
        {
            "rule_id": "T-04",
            "category": "terminology",
            "title": "Audience Reference Term ('Workspace Partners' vs 'End-Users')",
            "source_doc": "Brand Style Guide v2.1 (Section 4.2)",
            "owner": "Brand Team",
            "doc_version": "v2.1",
            "severity": "LOW",
            "exact_quote": "Replace all occurrences of 'end-users' with 'workspace partners' across every piece of external communication.",
            "pattern": "",
            "disallow_terms": ["end-users", "end users"],
            "preferred_replacement": "workspace partners",
            "preserved_intent": "Preserves: audience reference using brand partnership language.",
            "expiry_date": None,
            "metadata": {
                "ambiguity_candidate": True,
                "suggested_clarification": (
                    "Use 'workspace partners' in marketing headlines and case studies, "
                    "but permit 'end-users' in technical, UX, and API documentation."
                ),
            },
        },
        {
            "rule_id": "G-01",
            "category": "tone",
            "title": "Respectful, Evidence-Led Enterprise Tone",
            "source_doc": "Voice & Tone Charter v3",
            "owner": "Brand Team",
            "doc_version": "v3.0",
            "severity": "MEDIUM",
            "exact_quote": "Voice Charter G-01: Maintain a calm, respectful, evidence-led tone. Never use hostile competitor attacks ('crushes the competition'), panic framing, or hyperbolic slang.",
            "pattern": "",
            "disallow_terms": [],
            "preferred_replacement": "delivers measurable workflow reliability for modern enterprise teams",
            "preserved_intent": "Preserves: strong competitive differentiation in professional enterprise language.",
            "expiry_date": None,
            "metadata": {},
        },
        {
            "rule_id": "G-02",
            "category": "tone",
            "title": "Readability & Sentence Clarity Standard (≤ Grade 10)",
            "source_doc": "Inclusive Communication Standards v3",
            "owner": "Editorial Team",
            "doc_version": "v3.0",
            "severity": "LOW",
            "exact_quote": "Keep sentences under 32 words and overall readability at or below Flesch-Kincaid Grade 10.",
            "pattern": "",
            "disallow_terms": [],
            "preferred_replacement": "Split multi-clause sentences into two clear statements.",
            "preserved_intent": "Preserves: complete detail with higher reader comprehension.",
            "expiry_date": None,
            "metadata": {},
        },
        {
            "rule_id": "V-01",
            "category": "visual",
            "title": "Approved Brand Color Palette Compliance",
            "source_doc": "Visual Design System v3.2",
            "owner": "Design Systems Team",
            "doc_version": "v3.2",
            "severity": "LOW",
            "exact_quote": "All visual accents and graphics must use the approved ABC SmartFlow palette: Primary Blue (#0F62FE), Deep Slate (#0F172A), Emerald (#10B981), Neutral Surface (#FFFFFF / #F8FAFC).",
            "pattern": "",
            "disallow_terms": [],
            "preferred_replacement": "#0F62FE",
            "preserved_intent": "Preserves: visual emphasis within the official brand color system.",
            "expiry_date": None,
            "metadata": {
                "approved_palette": [
                    "#0F62FE",
                    "#0F172A",
                    "#FFFFFF",
                    "#F8FAFC",
                    "#10B981",
                    "#1E293B",
                    "#2563EB",
                ]
            },
        },
        {
            "rule_id": "A-01",
            "category": "accessibility",
            "title": "WCAG 2.1 AA Text Contrast Ratio (≥ 4.5:1)",
            "source_doc": "Digital Accessibility Standard v3",
            "owner": "UX & Accessibility Lead",
            "doc_version": "v3.0",
            "severity": "MEDIUM",
            "exact_quote": "Foreground text and background color combinations must maintain a WCAG 2.1 contrast ratio of at least 4.5:1.",
            "pattern": "",
            "disallow_terms": [],
            "preferred_replacement": "Use #0F172A text on #FFFFFF background (17.4:1 contrast)",
            "preserved_intent": "Preserves: layout hierarchy while ensuring legibility for low-vision users.",
            "expiry_date": None,
            "metadata": {},
        },
        {
            "rule_id": "A-02",
            "category": "accessibility",
            "title": "Descriptive Image Alternative Text",
            "source_doc": "Digital Accessibility Standard v3",
            "owner": "UX & Accessibility Lead",
            "doc_version": "v3.0",
            "severity": "MEDIUM",
            "exact_quote": "Every image asset must include descriptive alt text (minimum 10 characters) that conveys its visual meaning to screen-reader users.",
            "pattern": "",
            "disallow_terms": [],
            "preferred_replacement": "Descriptive alt text summarizing the visual content and key text",
            "preserved_intent": "Preserves: visual storytelling for screen-reader users.",
            "expiry_date": None,
            "metadata": {},
        },
        {
            "rule_id": "A-03",
            "category": "accessibility",
            "title": "Descriptive Hyperlink Anchor Text",
            "source_doc": "Digital Accessibility Standard v3",
            "owner": "UX & Accessibility Lead",
            "doc_version": "v3.0",
            "severity": "LOW",
            "exact_quote": "Avoid generic link text like 'click here' or 'read more'; anchor text must clearly state the link destination.",
            "pattern": "",
            "disallow_terms": ["click here", "read more", "tap here"],
            "preferred_replacement": "Explore ABC SmartFlow Product Specifications",
            "preserved_intent": "Preserves: call-to-action flow with accessible destination context.",
            "expiry_date": None,
            "metadata": {},
        },
    ]

    for r in rules_v3:
        conn.execute(
            """
            INSERT INTO brand_rules (
                kit_version, rule_id, category, title, source_doc, owner, doc_version,
                severity, exact_quote, pattern, disallow_terms_json, preferred_replacement,
                preserved_intent, expiry_date, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                3,
                r["rule_id"],
                r["category"],
                r["title"],
                r["source_doc"],
                r["owner"],
                r["doc_version"],
                r["severity"],
                r["exact_quote"],
                r["pattern"],
                json.dumps(r["disallow_terms"]),
                r["preferred_replacement"],
                r["preserved_intent"],
                r["expiry_date"],
                json.dumps(r["metadata"]),
            ),
        )

    # -------------------------------------------------------------------------
    # 4. Seed Submission #1: Flagship Active Review (Exact Round 1 PDF Example!)
    # -------------------------------------------------------------------------
    s1 = PRESET_SCENARIOS[0]
    cur1 = conn.execute(
        """
        INSERT INTO submissions (
            title, content_type, team, author_name, author_role, status, kit_version,
            current_version, current_content, fg_color, bg_color, accent_color,
            image_name, image_alt, image_colors_json, cta_link_text, cta_link_url,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'IN_REVIEW', 3, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            s1["title"],
            s1["content_type"],
            s1["team"],
            "Mohammed Arshath (Content Creator)",
            "creator",
            s1["content"],
            s1["fg_color"],
            s1["bg_color"],
            s1["accent_color"],
            s1["image_name"],
            s1["image_alt"],
            json.dumps(s1["image_colors"]),
            s1["cta_link_text"],
            s1["cta_link_url"],
            ts,
            ts,
        ),
    )
    sub1_id = cur1.lastrowid
    conn.execute(
        """
        INSERT INTO submission_versions (
            submission_id, version_number, content, fg_color, bg_color, accent_color,
            image_alt, cta_link_text, change_summary, diff_html, diff_stats_json,
            created_by, created_role, created_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, 'Initial draft submitted by Creator', ?, ?, ?, 'creator', ?)
        """,
        (
            sub1_id,
            s1["content"],
            s1["fg_color"],
            s1["bg_color"],
            s1["accent_color"],
            s1["image_alt"],
            s1["cta_link_text"],
            s1["content"],
            json.dumps({"words_added": len(s1["content"].split()), "words_removed": 0, "similarity_pct": 100.0}),
            "Mohammed Arshath (Content Creator)",
            ts,
        ),
    )
    execute_review_for_submission(conn, sub1_id, "System Automated Review", "system")

    # -------------------------------------------------------------------------
    # 5. Seed Submission #2: Escalated High-Severity Finding (Step 5 & Step 7 Demo)
    # -------------------------------------------------------------------------
    s2 = PRESET_SCENARIOS[1]
    cur2 = conn.execute(
        """
        INSERT INTO submissions (
            title, content_type, team, author_name, author_role, status, kit_version,
            current_version, current_content, fg_color, bg_color, accent_color,
            image_name, image_alt, image_colors_json, cta_link_text, cta_link_url,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'ESCALATED_REVIEW', 3, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            s2["title"],
            s2["content_type"],
            s2["team"],
            "External Agency Writer",
            "creator",
            s2["content"],
            s2["fg_color"],
            s2["bg_color"],
            s2["accent_color"],
            s2["image_name"],
            s2["image_alt"],
            json.dumps(s2["image_colors"]),
            s2["cta_link_text"],
            s2["cta_link_url"],
            ts,
            ts,
        ),
    )
    sub2_id = cur2.lastrowid
    conn.execute(
        """
        INSERT INTO submission_versions (
            submission_id, version_number, content, fg_color, bg_color, accent_color,
            image_alt, cta_link_text, change_summary, diff_html, diff_stats_json,
            created_by, created_role, created_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, 'Initial agency campaign draft', ?, ?, 'External Agency Writer', 'creator', ?)
        """,
        (
            sub2_id,
            s2["content"],
            s2["fg_color"],
            s2["bg_color"],
            s2["accent_color"],
            s2["image_alt"],
            s2["cta_link_text"],
            s2["content"],
            json.dumps({"words_added": len(s2["content"].split()), "words_removed": 0, "similarity_pct": 100.0}),
            ts,
        ),
    )
    execute_review_for_submission(conn, sub2_id, "System Automated Review", "system")

    # Simulate Step 5 Escalation on Submission #2: Creator dismissed HIGH finding F-15 (100% uptime)
    f15_row = conn.execute(
        "SELECT id FROM findings WHERE submission_id = ? AND rule_id = 'F-15'", (sub2_id,)
    ).fetchone()
    if f15_row:
        conn.execute(
            """
            UPDATE findings
            SET status = 'ESCALATED',
                dismiss_reason = 'Region US-East had 100% observed availability last month; we want a punchier headline.',
                dismissed_by = 'External Agency Writer',
                updated_at = ?
            WHERE id = ?
            """,
            (ts, f15_row["id"]),
        )
        conn.execute(
            """
            INSERT INTO finding_comments (finding_id, submission_id, author_name, author_role, comment_text, action_type, created_at)
            VALUES (?, ?, 'External Agency Writer', 'creator',
                    'Dismissed by creator: Region US-East had 100% observed availability last month -> System Safety Net (Step 5): Auto-escalated to Reviewer because F-15 is HIGH severity.',
                    'ESCALATE', ?)
            """,
            (f15_row["id"], sub2_id, ts),
        )
    # Also dismiss T-04 ("end-users") on Submission #2 to contribute to the Ambiguous-Guideline Detector!
    t04_row = conn.execute(
        "SELECT id FROM findings WHERE submission_id = ? AND rule_id = 'T-04'", (sub2_id,)
    ).fetchone()
    if t04_row:
        conn.execute(
            """
            UPDATE findings
            SET status = 'DISMISSED',
                dismiss_reason = 'Technical IT buyers search for "end-users", not "workspace partners". Rule T-04 is too broad.',
                dismissed_by = 'External Agency Writer',
                updated_at = ?
            WHERE id = ?
            """,
            (ts, t04_row["id"]),
        )
    conn.execute("UPDATE submissions SET status = 'ESCALATED_REVIEW' WHERE id = ?", (sub2_id,))

    # -------------------------------------------------------------------------
    # 6. Seed Submission #3: Approved Publish-Ready Record with Revisions & Diffs (Step 8)
    # -------------------------------------------------------------------------
    v1_text = (
        "ABC SmartFlow supports 12 languages and our SmartFlow Bot helps end-users automate reviews "
        "starting at $19/month."
    )
    v2_text = (
        "ABC SmartFlow supports 5 languages and our ABC SmartFlow Copilot helps workspace partners "
        "automate reviews starting with the $29/month Pro Starter plan."
    )
    diff_html_1_2, diff_stats_1_2 = compute_word_diff(v1_text, v2_text)

    cur3 = conn.execute(
        """
        INSERT INTO submissions (
            title, content_type, team, author_name, author_role, status, kit_version,
            current_version, current_content, fg_color, bg_color, accent_color,
            image_name, image_alt, image_colors_json, cta_link_text, cta_link_url,
            last_reviewed_version, reviewer_notes, approved_by, approved_at, created_at, updated_at
        ) VALUES (
            'Q3 Enterprise Security & Localization Release Notes', 'press_release', 'Product',
            'Mohammed Arshath (Content Creator)', 'creator', 'APPROVED', 3, 2, ?,
            '#0F172A', '#FFFFFF', '#0F62FE', 'release-architecture.png',
            'ABC SmartFlow v3 release architecture diagram showing 5 supported languages',
            '["#0F62FE", "#0F172A"]', 'Read the Full Release Documentation',
            'https://abc-smartflow.example.com/releases/v3', 2,
            'All factual claims (F-12, F-09) and terminology (T-01) verified against Brand Kit v3. Approved for publication.',
            'Poojitha V S (Brand & Legal Reviewer)', ?, ?, ?
        )
        """,
        (v2_text, ts, ts, ts),
    )
    sub3_id = cur3.lastrowid
    conn.execute(
        """
        INSERT INTO submission_versions (
            submission_id, version_number, content, fg_color, bg_color, accent_color,
            image_alt, cta_link_text, change_summary, diff_html, diff_stats_json,
            created_by, created_role, created_at
        ) VALUES (?, 1, ?, '#0F172A', '#FFFFFF', '#0F62FE',
                  'ABC SmartFlow v3 release architecture diagram showing 5 supported languages',
                  'Read the Full Release Documentation', 'Initial release notes draft', ?, ?,
                  'Mohammed Arshath (Content Creator)', 'creator', ?)
        """,
        (
            sub3_id,
            v1_text,
            v1_text,
            json.dumps({"words_added": len(v1_text.split()), "words_removed": 0, "similarity_pct": 100.0}),
            ts,
        ),
    )
    conn.execute(
        """
        INSERT INTO submission_versions (
            submission_id, version_number, content, fg_color, bg_color, accent_color,
            image_alt, cta_link_text, change_summary, diff_html, diff_stats_json,
            created_by, created_role, created_at
        ) VALUES (?, 2, ?, '#0F172A', '#FFFFFF', '#0F62FE',
                  'ABC SmartFlow v3 release architecture diagram showing 5 supported languages',
                  'Read the Full Release Documentation',
                  'Accepted BrandGuard fixes for F-12 (5 languages), T-01 (Copilot), and F-09 ($29/mo)',
                  ?, ?, 'Mohammed Arshath (Content Creator)', 'creator', ?)
        """,
        (sub3_id, v2_text, diff_html_1_2, json.dumps(diff_stats_1_2), ts),
    )

    # Seed historical resolved/dismissed findings on Sub #3 so Step 9 Insights Dashboard has rich telemetry
    historical_findings = [
        (sub3_id, 1, "BG-001", "F-12", "fact", "HIGH", "supports 12 languages", "Product Specification v3", "Product Team", "v3.0", "Supports 5 languages", "Contradicts F-12.", "supports 5 languages", "ACCEPTED", "", "Mohammed Arshath (Content Creator)"),
        (sub3_id, 1, "BG-002", "F-09", "expired_fact", "HIGH", "$19/month", "Pricing & Packaging Sheet v2.4", "Revenue Operations", "v2.4", "Introductory $19/month starter pricing expired on 2026-06-30", "Expired pricing.", "$29/month Pro Starter plan", "ACCEPTED", "", "Mohammed Arshath (Content Creator)"),
        (sub3_id, 1, "BG-003", "T-01", "terminology", "MEDIUM", "SmartFlow Bot", "Brand Lexicon & Messaging Guide v3", "Brand Team", "v3.0", "Refer to intelligent features as 'ABC SmartFlow Copilot'", "Deprecated bot term.", "ABC SmartFlow Copilot", "ACCEPTED", "", "Mohammed Arshath (Content Creator)"),
        (sub3_id, 1, "BG-004", "T-04", "terminology", "LOW", "end-users", "Brand Style Guide v2.1 (Section 4.2)", "Brand Team", "v2.1", "Replace all occurrences of 'end-users' with 'workspace partners'", "Flagged end-users.", "workspace partners", "DISMISSED", "In release notes, 'end-users' refers to distinct seat permissions vs workspace admins.", "Mohammed Arshath (Content Creator)"),
        (sub3_id, 1, "BG-005", "T-04", "terminology", "LOW", "end users", "Brand Style Guide v2.1 (Section 4.2)", "Brand Team", "v2.1", "Replace all occurrences of 'end-users' with 'workspace partners'", "Flagged end users.", "workspace partners", "DISMISSED", "Technical documentation requires standard 'end users' phrasing for clarity.", "Mohammed Arshath (Content Creator)"),
        (sub3_id, 1, "BG-006", "C-4", "claim", "HIGH", "guarantees 100% ROI", "Claims Policy v3", "Legal & Compliance Team", "v3.0", "Claims Policy rule C-4: no unsupported guarantees.", "Unsupported guarantee.", "helps businesses improve operational efficiency", "ACCEPTED", "", "Mohammed Arshath (Content Creator)"),
    ]
    for hf in historical_findings:
        conn.execute(
            """
            INSERT INTO findings (
                submission_id, version_number, issue_code, rule_id, category, severity,
                detected_text, start_idx, end_idx, source_doc, owner, doc_version,
                source_quote, evidence_verified, why_flagged, suggested_fix,
                preserved_intent, confidence, needs_human_judgment, engine_source,
                status, dismiss_reason, dismissed_by, resolved_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 10, ?, ?, ?, ?, 1, ?, ?, 'Preserves: core message and intent.', 'High (verified rule)', 0, 'deterministic', ?, ?, ?, ?, ?, ?)
            """,
            (
                hf[0], hf[1], hf[2], hf[3], hf[4], hf[5], hf[6], hf[7], hf[8], hf[9],
                hf[10], hf[11], hf[12], hf[13], hf[14], hf[15], hf[15], ts, ts
            ),
        )

    log_audit(
        conn,
        actor_name="Logeshwaran V (Brand Owner / Admin)",
        actor_role="admin",
        action="INITIALIZE_BRAND_KIT_V3",
        target_type="brand_kit",
        target_id="3",
        details="Published ABC SmartFlow Global Brand Kit v3 with 14 evidence-grounded rules and facts.",
    )
    log_audit(
        conn,
        actor_name="External Agency Writer",
        actor_role="creator",
        action="AUTO_ESCALATE_HIGH_RISK",
        target_type="submission",
        target_id=str(sub2_id),
        details="Creator dismissed HIGH-severity finding F-15 ('100% uptime'); System Step 5 Safety Net escalated finding to Reviewer.",
    )
    log_audit(
        conn,
        actor_name="Poojitha V S (Brand & Legal Reviewer)",
        actor_role="reviewer",
        action="APPROVE_SUBMISSION",
        target_type="submission",
        target_id=str(sub3_id),
        details="Approved 'Q3 Enterprise Security & Localization Release Notes' (v2) with Publish-Ready Compliance Record.",
    )
