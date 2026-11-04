"""
Word-Level Diff Utility for BrandGuard Revision History.
Generates semantic word-by-word HTML diffs and change statistics between versions.
"""

import difflib
import html
import re
from typing import Any, Dict, List, Tuple

TOKEN_SPLIT_RE = re.compile(r"(\s+|\w+|[^\w\s]+)")


def tokenize_words(text: str) -> List[str]:
    """Split text into words, whitespace, and punctuation tokens."""
    if not text:
        return []
    return TOKEN_SPLIT_RE.findall(text)


def compute_word_diff(old_text: str, new_text: str) -> Tuple[str, Dict[str, Any]]:
    """
    Generate an inline HTML diff with <del class='diff-del'> and <ins class='diff-ins'>
    along with word-level statistics.
    """
    old_tokens = tokenize_words(old_text or "")
    new_tokens = tokenize_words(new_text or "")

    matcher = difflib.SequenceMatcher(None, old_tokens, new_tokens)
    html_parts: List[str] = []
    words_added = 0
    words_removed = 0

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        old_chunk = "".join(old_tokens[i1:i2])
        new_chunk = "".join(new_tokens[j1:j2])

        if tag == "equal":
            html_parts.append(html.escape(old_chunk))
        elif tag == "delete":
            words_removed += sum(1 for t in old_tokens[i1:i2] if t.strip())
            html_parts.append(f'<del class="diff-del">{html.escape(old_chunk)}</del>')
        elif tag == "insert":
            words_added += sum(1 for t in new_tokens[j1:j2] if t.strip())
            html_parts.append(f'<ins class="diff-ins">{html.escape(new_chunk)}</ins>')
        elif tag == "replace":
            words_removed += sum(1 for t in old_tokens[i1:i2] if t.strip())
            words_added += sum(1 for t in new_tokens[j1:j2] if t.strip())
            html_parts.append(f'<del class="diff-del">{html.escape(old_chunk)}</del>')
            html_parts.append(f'<ins class="diff-ins">{html.escape(new_chunk)}</ins>')

    similarity = round(matcher.ratio() * 100, 1)
    stats = {
        "words_added": words_added,
        "words_removed": words_removed,
        "similarity_pct": similarity,
    }
    return "".join(html_parts), stats
