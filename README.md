# BrandGuard — Intelligent Brand-Governance Platform

**Team Nexus** • CodeNexus India 2026 (Round 2 — The Build)  
**Institution:** SRM Easwari Engineering College  
**Team Members:** Logeshwaran V (Team Lead), Muthukumar A, Mohammed Arshath, Poojitha V S

---

## 1. Overview & Live Judge Experience

**BrandGuard** is an evidence-grounded pre-publication review layer. Content creators, agencies, and marketing teams submit copy and visual assets; BrandGuard checks them against the organisation's versioned **Brand Knowledge Base** (`ABC SmartFlow Global Brand Kit v3`), explains every issue in plain language, cites the exact rule, owner, document version, and verified source quote, and offers **1-click intent-preserving fixes** while keeping human reviewers in control of high-risk decisions.

### Zero-Friction Incognito Evaluation (No Login Wall)
When a judge opens the application link in a private/incognito window:
1. **Pre-Seeded Workspace:** Opens directly into the active **Review & Approval Workspace** with 3 realistic submissions across different stages of the 9-step governance workflow—including the exact **`BG-001` (`F-12` + `C-4`) example** from Page 3 of our Round 1 Proposal PDF.
2. **Instant Role Switcher in the Header:** Switch seamlessly between **✍️ Creator**, **⚖️ Reviewer**, **📈 Manager**, and **🛡️ Admin** at the top of the screen (each switch issues a real HMAC-SHA256 signed session token and logs the role transition). Formal PBKDF2 password sign-in is also available via the **🔑 Sign In** button.
3. **1-Click Test Scenarios:** Use the **⚡ Judge Quick-Test Scenarios** bar to switch between active creator review (`Sub #1`), an amber-escalated high-risk submission blocked at the Reviewer Gate (`Sub #2`), an approved publish-ready record with word-level diffs (`Sub #3`), or create a new check from presets.

---

## 2. Quick Start (Local & Cloud Deployment)

### Run Locally (Python 3.12+)
```bash
# 1. Create and activate virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python run.py

# Linux / macOS:
.venv/bin/pip install -r requirements.txt
.venv/bin/python run.py
```
Then open **`http://localhost:8000`** in any browser.

### Run Automated End-to-End Test Suite
```bash
.venv\Scripts\pytest tests/test_workflow.py -v
```

### Run via Docker
```bash
docker build -t brandguard-nexus .
docker run -p 8000:8000 brandguard-nexus
```

---

## 3. Completed Features in Round 2 (All 9 Workflow Steps Working End-to-End)

| Workflow Step | Completed Implementation Details |
| :--- | :--- |
| **Step 1: Brand Knowledge Base (`Admin`)** | Versioned Brand Kits (`v1`, `v2`, active `v3`) with 14 structured rules across **Approved Facts (`F-xx`)**, **Expired Facts (`expiry_date`)**, **Claims Policy (`C-xx`)**, **Terminology (`T-xx`)**, **Voice & Tone (`G-xx`)**, **Visual Palette (`V-01`)**, and **Accessibility (`A-01`–`A-03`)**. Every rule stores `rule_id`, `source_doc`, `owner`, `doc_version`, and `exact_quote`. |
| **Step 2: Content & Asset Creation (`Creator`)** | Multi-modal submission supporting copy/text, `[[confidential]]` double-bracket redaction tags, foreground/background/accent HEX colors, client-side HTML5 Canvas image upload with dominant color extraction, image alt text, and CTA link anchor text. |
| **Step 3: Hybrid Automated Review & Evidence Validator (`System`)** | **1) Confidential Redactor** masks `[[...]]` spans as `[REDACTED_CONFIDENTIAL_n]`. **2) Deterministic Engine** checks exact facts, expired pricing/specs, banned terms, prohibited guarantees, WCAG 2.1 luminance contrast ratio math, perceptual RGB color distance ($\Delta E$), alt text, generic link text, and Flesch-Kincaid readability. **3) AI Judgment + Offline Heuristic Fallback** evaluates tone and nuanced claims. **4) Evidence Validator** verifies every finding's rule ID, owner, version, and exact source quote substring match before surfacing it. |
| **Step 4: Creator Revision (`Creator`)** | Annotated live preview with clickable highlights; **1-Click Accept Fix** (automatically replaces the flagged span or visual attribute, saves a new numbered version `v2`, `v3`..., and computes a **word-level `<del>`/`<ins>` HTML diff**); **Custom Fix**; **Manual Edit**; **Dismiss with required written reason**; and **Per-Finding Comments**. |
| **Step 5: Escalation Safety Net (`System`)** | Dismissing a `LOW` or `MEDIUM` finding clears it with the recorded reason. Dismissing a **`HIGH` severity finding** (factual contradiction or legal claim) automatically transitions the finding to **`ESCALATED` (Amber State)** and routes the submission to `ESCALATED_REVIEW`. |
| **Step 6: Submit for Approval Gate (`Creator`)** | Enforces server-side and UI gate: enabled only when `0 OPEN` findings remain and the latest content revision has been checked. |
| **Step 7: Human Approval Authority (`Reviewer / Manager`)** | **Approval is locked** while any `ESCALATED` high-severity finding remains unresolved. The Reviewer must inspect the creator's dismissal reason and explicitly choose **⚖️ Reviewer Override & Clear** or **🛑 Uphold Rule & Require Fix** before approving, requesting changes, or rejecting. |
| **Step 8: Publish-Ready Compliance Record (`System`)** | Immutable record storing all numbered versions, word-level diffs, per-finding comments, reviewer sign-off, and the **AI & Privacy Redaction Disclosure Log**. |
| **Step 9: Governance Insights & Learning Loop (`Manager / Admin`)** | Dashboard tracking Evidence Grounding Rate (`100%`), average revisions to approval, recurring violations by rule, contributor team comparison, and the **Ambiguous-Guideline Detector**—which flags frequently dismissed rules (e.g., `T-04`) and lets Admins clarify the rule in 1 click. |

---

## 4. Technology & Implementation Details

- **Backend (`backend/`):** Python 3.12, **FastAPI**, **Pydantic v2**, and **Uvicorn**.
- **Database (`backend/database.py`):** **SQLite3** with relational foreign-key constraints across 9 normalized tables (`users`, `brand_kits`, `brand_rules`, `submissions`, `submission_versions`, `findings`, `finding_comments`, `ai_disclosure_logs`, `audit_logs`).
- **Hybrid Engine (`backend/engine/`):**
  - `redactor.py`: Regex extraction and SHA-256 fingerprinting of `[[confidential]]` spans prior to external calls.
  - `deterministic.py`: Regex rule tables, ISO expiry date comparison, WCAG 2.1 relative luminance and contrast ratio formula, perceptual RGB color distance, and Flesch-Kincaid syllable/sentence grade calculation.
  - `ai_judge.py`: Supports structured JSON calls to Anthropic Claude (`ANTHROPIC_API_KEY`) on redacted text, paired with an automatic **Offline Heuristic Fallback** so the platform runs with 100% reliability without requiring external API keys.
  - `validator.py`: Hallucination guardrail verifying rule existence, metadata ownership, and normalized substring matching of `source_quote` against `exact_quote`.
  - `diff_utils.py`: Token-level `difflib.SequenceMatcher` generating semantic word-by-word `<del>` and `<ins>` diffs.
- **Security (`backend/auth.py`):** PBKDF2-HMAC-SHA256 password hashing (100,000 iterations), HMAC-SHA256 signed session tokens, and server-side role verification.
- **Frontend (`frontend/`):** Zero-build, high-speed Single-Page Application (HTML5, CSS3 custom design system, vanilla ES6 JavaScript) served directly by FastAPI for one-command deployment.

---

## 5. Explanation of Changes Made to the Original Round 1 Plan

1. **Added Instant Judge Role-Switcher & Pre-Seeded Incognito Workspace:**  
   In Round 1, we proposed standard role-based login screens. To ensure judges can evaluate all 4 roles (`Creator`, `Reviewer`, `Manager`, `Admin`) and the entire 9-step workflow immediately in an incognito browser without login friction, we added a **1-click Role Switcher** in the header (which dynamically issues real HMAC-signed tokens) alongside the formal PBKDF2 login modal.
2. **Client-Side Canvas Dominant Color Extraction for Image Assets:**  
   Rather than requiring heavy server-side vision dependencies for palette checking in Round 2, we implemented an HTML5 `<canvas>` color-sampling inspector in the frontend paired with perceptual RGB distance ($\Delta E$) math in the deterministic engine so uploaded images are checked against the Brand Kit palette instantaneously.

---

## 6. Three Major Improvements Planned for Round 3

1. **Direct Document Upload & Layout-Aware Parsing (`PDF`, `DOCX`, and Slide Decks):**  
   Build a multi-format document ingestion pipeline (`pypdf` & `python-docx`) that extracts headings, body paragraphs, tables, embedded images, and link annotations from uploaded files, mapping every finding back to its exact page number and paragraph index.
2. **Semantic Fact & Claim Retrieval with Vector Embeddings (`pgvector` / Local Embeddings):**  
   Upgrade fact and claim verification from regex/pattern matching to dense semantic retrieval so paraphrased or indirectly worded claims (e.g., *"speaks nearly two dozen tongues"*) are matched against the Brand Knowledge Base (`F-12: Supports 5 languages`) with cosine-similarity confidence scores.
3. **Multimodal Vision-Model Brand Asset & Logo Compliance Engine:**  
   Integrate multimodal vision inspection to verify logo clear-space ratios, detect stretched or recolored logos, check text overlay contrast directly on complex background photography, and verify visual style consistency against approved brand reference assets.

---

## 7. Open-Source & AI Tool Disclosures (Hackathon Rules 05, 06, 08, 12)

- **Hackathon Build Window:** All source code in this repository was written during the official CodeNexus India 2026 Round 2 build window (4 Nov – 7 Nov 2026) based on the architectural plan submitted in Round 1.
- **Open-Source Packages:** FastAPI, Uvicorn, Pydantic, Pytest, HTTPX (all MIT / BSD licensed).
- **AI Assistance Disclosure:** AI coding assistance (Google Antigravity / Gemini) was used during Round 2 for scaffolding and testing the implementation of Team Nexus's Round 1 system design. Runtime content evaluation uses BrandGuard's local deterministic + heuristic engine by default, with optional Anthropic Claude API support.
- **License:** MIT License (see [LICENSE](LICENSE)).
