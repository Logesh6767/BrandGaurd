"""
Confidential Text Redaction & Privacy Guardrail.
Masks any content inside [[double brackets]] before sending to external AI APIs
and logs every redaction event for transparency.
"""

import hashlib
import re
from typing import Any, Dict, List, Tuple

CONFIDENTIAL_PATTERN = re.compile(r"\[\[([\s\S]*?)\]\]")


def redact_confidential_sections(text: str) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Replace all [[confidential]] spans with deterministic placeholders
    like [REDACTED_CONFIDENTIAL_1] so confidential material never leaves
    the local boundary.
    """
    if not text:
        return "", []

    redactions: List[Dict[str, Any]] = []
    counter = 0

    def _replacer(match: re.Match) -> str:
        nonlocal counter
        counter += 1
        raw_inner = match.group(1)
        placeholder = f"[REDACTED_CONFIDENTIAL_{counter}]"
        digest = hashlib.sha256(raw_inner.encode("utf-8")).hexdigest()[:10]
        redactions.append(
            {
                "placeholder": placeholder,
                "char_length": len(raw_inner),
                "sha256_prefix": digest,
                "start_idx": match.start(),
                "end_idx": match.end(),
            }
        )
        return placeholder

    redacted_text = CONFIDENTIAL_PATTERN.sub(_replacer, text)
    return redacted_text, redactions


def strip_confidential_markers_for_publish(text: str) -> str:
    """Return text with confidential sections highlighted or stripped for preview."""
    return CONFIDENTIAL_PATTERN.sub(r"[CONFIDENTIAL: \1]", text or "")
