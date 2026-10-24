"""Deterministic safety checks applied regardless of which planner is running."""
from __future__ import annotations

import re

_INJECTION_PATTERNS = [
    r"ignore (all |any )?(the )?(previous|prior|above|your) (instructions|rules|policies|prompts?)",
    r"ignore (all |any )?(rules|policies|instructions)",
    r"system (override|prompt)",
    r"\badmin mode\b",
    r"\bdeveloper mode\b",
    r"you are now\b",
    r"approval (has )?(already )?(been )?granted",
    r"pre-?approved",
    r"bypass (the )?(policy|rules|limit|approval)",
]
_INJECTION_RE = re.compile("|".join(_INJECTION_PATTERNS), re.IGNORECASE)

_HUMAN_RE = re.compile(
    r"\b(real person|human( being| agent)?|talk to (a |an )?(person|agent|someone)|speak (to|with) (a |an )?"
    r"(person|agent|someone|human)|customer care executive|not (a |with a |to a )?bot)\b",
    re.IGNORECASE,
)

# Phrases that assert a refund has been completed. Used to stop replies that claim unverified success.
_REFUND_CLAIM_RE = re.compile(
    r"\b(refund|amount|money)\b[^.]{0,60}\b(has been|was|is|have been)\s+(successfully\s+)?"
    r"(refunded|processed|issued|credited|reversed|returned|initiated|completed)\b"
    r"|\bwe (have )?(refunded|reversed|credited)\b"
    r"|\brefund(ed)? (successfully|completed)\b",
    re.IGNORECASE,
)


def injection_suspected(text: str) -> bool:
    return bool(_INJECTION_RE.search(text or ""))


def asks_for_human(text: str) -> bool:
    return bool(_HUMAN_RE.search(text or ""))


def claims_refund_done(text: str) -> bool:
    return bool(_REFUND_CLAIM_RE.search(text or ""))
