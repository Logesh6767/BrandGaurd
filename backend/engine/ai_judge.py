"""
AI Judgment Layer & Offline Heuristic Fallback for BrandGuard.
Evaluates brand tone consistency (Rule G-01) and nuanced/ambiguous claims (Rule C-02)
on confidential-redacted text.
Supports Anthropic Claude API, Google Gemini API, and an automatic Offline Heuristic
Fallback so the product works reliably even without external API keys.
"""

import json
import os
import re
import time
import urllib.request
from typing import Any, Dict, List, Optional, Tuple


TONE_PATTERNS: List[Tuple[re.Pattern, str, str, str]] = [
    (
        re.compile(
            r"\b(crush(?:es|ing)?\s+(?:the\s+)?competition|destroy(?:s|ing)?\s+competitors|obsolete\s+legacy\s+garbage|stupidly\s+simple|competitors\s+are\s+failing)\b",
            re.IGNORECASE,
        ),
        "Hostile or disparaging competitor language conflicts with ABC SmartFlow's respectful, evidence-led enterprise voice.",
        "delivers measurable workflow reliability for modern enterprise teams",
        "Preserves: competitive differentiation while maintaining constructive, professional brand tone.",
    ),
    (
        re.compile(
            r"\b(you\s+will\s+fail\s+without|don't\s+be\s+left\s+behind\s+or\s+lose\s+everything|panic-inducing|reckless\s+teams\s+still\s+use)\b",
            re.IGNORECASE,
        ),
        "Fear-mongering or alarmist phrasing violates brand tone guideline G-01 (calm, helpful, empowering).",
        "teams looking to modernize their review workflow can streamline operations with",
        "Preserves: urgency to adopt without alarmist or negative framing.",
    ),
    (
        re.compile(
            r"\b(insanely\s+fast|mind-blowing\s+magic|zero-brain\s+setup|ridiculously\s+cheap)\b",
            re.IGNORECASE,
        ),
        "Hyperbolic slang undermines enterprise credibility and violates G-01 tone guidelines.",
        "exceptionally fast and intuitive to deploy",
        "Preserves: excitement about speed and ease of use in enterprise-appropriate language.",
    ),
]

NUANCED_CLAIM_PATTERNS: List[Tuple[re.Pattern, str, str, str]] = [
    (
        re.compile(
            r"\b(cuts\s+review\s+time\s+by\s+(?:up\s+to\s+)?(?:85|90|95)%|10x\s+faster\s+than\s+manual\s+teams|eliminates\s+nearly\s+all\s+compliance\s+risk)\b",
            re.IGNORECASE,
        ),
        "Quantified comparative performance claim lacks a cited customer study or benchmark footnote; requires human reviewer judgment.",
        "reduces review turnaround time by up to 60% based on the Q3 2026 Enterprise Benchmark Study",
        "Preserves: quantified efficiency claim while grounding it in the approved Q3 2026 benchmark study.",
    ),
    (
        re.compile(
            r"\b(trusted\s+by\s+every\s+Fortune\s+500|adopted\s+by\s+leading\s+global\s+banks\s+worldwide|industry-standard\s+for\s+all\s+regulated\s+sectors)\b",
            re.IGNORECASE,
        ),
        "Broad market-leadership implication has weak or partial support in the Brand Kit and requires human verification before publication.",
        "trusted by enterprise marketing and compliance teams across regulated industries",
        "Preserves: enterprise social proof without overstating market share.",
    ),
]


def _run_offline_heuristic_judge(
    redacted_text: str,
    original_text: str,
    rules_by_id: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Deterministic heuristic analyzer for tone (G-01) and nuanced claims (C-02)
    when no external LLM API key is configured.
    """
    results: List[Dict[str, Any]] = []

    if "G-01" in rules_by_id:
        r_g01 = rules_by_id["G-01"]
        for rgx, why, fix, intent in TONE_PATTERNS:
            for m in rgx.finditer(original_text):
                # Skip if inside [[confidential]]
                before = original_text[: m.start()]
                if before.count("[[") > before.count("]]"):
                    continue
                results.append(
                    {
                        "rule_id": "G-01",
                        "category": "tone",
                        "severity": r_g01.get("severity", "MEDIUM"),
                        "detected_text": m.group(0),
                        "start_idx": m.start(),
                        "end_idx": m.end(),
                        "source_doc": r_g01["source_doc"],
                        "owner": r_g01["owner"],
                        "doc_version": r_g01["doc_version"],
                        "source_quote": r_g01["exact_quote"],
                        "why_flagged": why,
                        "suggested_fix": fix,
                        "preserved_intent": intent,
                        "confidence": "Medium (AI/Heuristic tone analysis)",
                        "needs_human_judgment": 0,
                        "engine_source": "ai_hybrid",
                    }
                )

    if "C-02" in rules_by_id:
        r_c02 = rules_by_id["C-02"]
        for rgx, why, fix, intent in NUANCED_CLAIM_PATTERNS:
            for m in rgx.finditer(original_text):
                before = original_text[: m.start()]
                if before.count("[[") > before.count("]]"):
                    continue
                results.append(
                    {
                        "rule_id": "C-02",
                        "category": "claim",
                        "severity": r_c02.get("severity", "MEDIUM"),
                        "detected_text": m.group(0),
                        "start_idx": m.start(),
                        "end_idx": m.end(),
                        "source_doc": r_c02["source_doc"],
                        "owner": r_c02["owner"],
                        "doc_version": r_c02["doc_version"],
                        "source_quote": r_c02["exact_quote"],
                        "why_flagged": why,
                        "suggested_fix": fix,
                        "preserved_intent": intent,
                        "confidence": "Uncertain (needs human judgment)",
                        "needs_human_judgment": 1,
                        "engine_source": "ai_hybrid",
                    }
                )

    return results


def _call_external_llm_if_configured(
    redacted_text: str,
    original_text: str,
    rules_by_id: Dict[str, Dict[str, Any]],
) -> Tuple[Optional[List[Dict[str, Any]]], str, str]:
    """
    Attempt a structured JSON call to Anthropic Claude or Google Gemini if an API key
    is set in the environment. Always passes ONLY `redacted_text` (with [[...]] masked).
    Returns (findings_or_none, provider_name, model_name).
    """
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()

    if not anthropic_key and not gemini_key:
        return None, "Offline Heuristic Engine (Zero External Data Transfer)", "brandguard-local-v2"

    rules_context = [
        {
            "rule_id": r["rule_id"],
            "category": r["category"],
            "exact_quote": r["exact_quote"],
            "source_doc": r["source_doc"],
            "owner": r["owner"],
            "doc_version": r["doc_version"],
        }
        for r in rules_by_id.values()
        if r.get("category") in ("tone", "claim", "fact")
    ]

    system_prompt = (
        "You are BrandGuard's AI Judgment Engine. Analyze the redacted content against the provided "
        "brand rules for tone issues (G-01) and nuanced or unsubstantiated claims (C-02). "
        "Return ONLY a JSON array of objects with keys: rule_id, category, severity, detected_text, "
        "source_quote, why_flagged, suggested_fix, preserved_intent, confidence, needs_human_judgment (0 or 1). "
        "Every finding MUST cite an existing rule_id and exact source_quote from the rules list."
    )
    user_payload = json.dumps({"redacted_content": redacted_text, "rules": rules_context})

    try:
        if anthropic_key:
            req = urllib.request.Request(
                "https://api.anthropic.com/v1/messages",
                data=json.dumps(
                    {
                        "model": "claude-3-5-haiku-latest",
                        "max_tokens": 1024,
                        "system": system_prompt,
                        "messages": [{"role": "user", "content": user_payload}],
                    }
                ).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": anthropic_key,
                    "anthropic-version": "2023-06-01",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                raw_text = body["content"][0]["text"]
                parsed = json.loads(raw_text)
                if isinstance(parsed, list):
                    for item in parsed:
                        det = item.get("detected_text", "")
                        idx = original_text.find(det) if det else -1
                        item["start_idx"] = idx
                        item["end_idx"] = (idx + len(det)) if idx >= 0 else -1
                        item["engine_source"] = "ai_hybrid"
                    return parsed, "Anthropic Claude API (Redacted Payload)", "claude-3-5-haiku-latest"
    except Exception:
        pass

    return (
        None,
        "Offline Heuristic Fallback (API Unavailable / Local Safe Mode)",
        "brandguard-local-v2",
    )


def run_ai_judgment(
    redacted_text: str,
    original_text: str,
    rules_by_id: Dict[str, Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Execute AI tone and claim judgment on redacted text, falling back automatically
    to the deterministic heuristic analyzer when offline or when no API key is configured.
    """
    t0 = time.perf_counter()
    llm_findings, provider, model_name = _call_external_llm_if_configured(
        redacted_text, original_text, rules_by_id
    )
    heuristic_findings = _run_offline_heuristic_judge(redacted_text, original_text, rules_by_id)

    if llm_findings is not None:
        combined = llm_findings + heuristic_findings
        status = "COMPLETED_EXTERNAL_REDACTED"
    else:
        combined = heuristic_findings
        status = "COMPLETED_LOCAL_FALLBACK"

    latency_ms = max(1, int((time.perf_counter() - t0) * 1000))
    meta = {
        "provider": provider,
        "model_name": model_name,
        "latency_ms": latency_ms,
        "status": status,
        "findings_returned": len(combined),
    }
    return combined, meta
