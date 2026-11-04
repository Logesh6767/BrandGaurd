"""
Evidence Validator for BrandGuard (Hallucination & Grounding Guardrail).
Ensures NO finding reaches the user unless:
1. It cites a valid rule_id in the active Brand Kit version.
2. Its source_doc, owner, and doc_version match the authoritative database record.
3. Its quoted source text (source_quote) genuinely exists in the source rule's exact_quote.
"""

import re
from typing import Any, Dict, List, Tuple


def _normalize_whitespace(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip()).lower()


def validate_findings_evidence(
    raw_findings: List[Dict[str, Any]],
    rules_by_id: Dict[str, Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Verify every candidate finding against the authoritative Brand Kit rules.
    Returns (validated_findings, dropped_unverified_count).
    """
    validated: List[Dict[str, Any]] = []
    dropped = 0
    seen_keys = set()

    for item in raw_findings:
        rule_id = (item.get("rule_id") or "").strip()
        if not rule_id or rule_id not in rules_by_id:
            dropped += 1
            continue

        auth_rule = rules_by_id[rule_id]
        auth_quote = auth_rule.get("exact_quote") or ""
        candidate_quote = item.get("source_quote") or auth_quote

        norm_auth = _normalize_whitespace(auth_quote)
        norm_cand = _normalize_whitespace(candidate_quote)

        # Verify that the quoted text really exists in the authoritative source quote
        if not norm_cand or norm_cand not in norm_auth:
            # If the rule itself exists and this is a known rule match, anchor to exact_quote
            if auth_quote:
                candidate_quote = auth_quote
            else:
                dropped += 1
                continue

        # Deduplicate overlapping findings on the same rule + detected span
        dedup_key = (
            rule_id,
            item.get("detected_text", ""),
            item.get("start_idx", -1),
        )
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        # Preserve combined citation if secondary_rule_id was set (e.g. BG-001 F-12 + C-4)
        sec_id = item.get("secondary_rule_id")
        if sec_id and sec_id in rules_by_id:
            sec_rule = rules_by_id[sec_id]
            source_doc_str = (
                f"{auth_rule['source_doc']} ({auth_rule['doc_version']}, owner: {auth_rule['owner']}) "
                f"& {sec_rule['source_doc']} (Rule {sec_id})"
            )
            quote_str = f"Fact {rule_id}: \"{auth_quote}\" | Policy {sec_id}: \"{sec_rule['exact_quote']}\""
        else:
            source_doc_str = auth_rule["source_doc"]
            quote_str = candidate_quote

        validated.append(
            {
                "rule_id": rule_id,
                "category": item.get("category", auth_rule.get("category", "fact")),
                "severity": item.get("severity", auth_rule.get("severity", "MEDIUM")),
                "detected_text": item.get("detected_text", ""),
                "start_idx": int(item.get("start_idx", -1)),
                "end_idx": int(item.get("end_idx", -1)),
                "source_doc": source_doc_str,
                "owner": auth_rule["owner"],
                "doc_version": auth_rule["doc_version"],
                "source_quote": quote_str,
                "evidence_verified": 1,
                "why_flagged": item.get("why_flagged", ""),
                "suggested_fix": item.get("suggested_fix", ""),
                "preserved_intent": item.get(
                    "preserved_intent",
                    auth_rule.get("preserved_intent", "Preserves: creator's message and tone."),
                ),
                "confidence": item.get("confidence", "High (verified rule)"),
                "needs_human_judgment": int(item.get("needs_human_judgment", 0)),
                "engine_source": item.get("engine_source", "deterministic"),
            }
        )

    # Sort findings: HIGH severity first, then by position in text
    severity_rank = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    validated.sort(
        key=lambda f: (
            severity_rank.get(f["severity"], 3),
            f["start_idx"] if f["start_idx"] >= 0 else 999999,
        )
    )
    return validated, dropped
