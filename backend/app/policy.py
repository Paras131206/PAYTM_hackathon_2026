"""Deterministic business rules. Pure functions: no I/O, no LLM.

The planner (LLM or rules) may *ask* for a refund; only these rules decide whether it is allowed,
and the amount always comes from the transaction record, never from the planner.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from typing import Any, Literal

TAT_WINDOW = timedelta(hours=24)            # T+1 for UPI failed transactions (RBI TAT circular, 2019), simplified
DUPLICATE_WINDOW = timedelta(minutes=10)
REPEAT_REFUND_THRESHOLD = 3                 # refunds in the last 30 days that force human approval
REFUND_CREDIT_ETA = "1-2 working days"      # when a refund reaches the source account; the only timeline we promise

Decision = Literal["auto_refund", "needs_approval", "wait", "escalate", "block", "already_done"]


@dataclass
class Check:
    name: str
    passed: bool
    detail: str


@dataclass
class RefundDecision:
    decision: Decision
    reason_code: str
    explanation: str
    amount_paise: int
    policy_id: str
    checks: list[Check] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def find_duplicate_original(txn: dict, customer_txns: list[dict]) -> dict | None:
    """Return the earlier payment that `txn` duplicates, if any."""
    t = datetime.fromisoformat(txn["created_at"])
    for other in customer_txns:
        if other["id"] == txn["id"]:
            continue
        o = datetime.fromisoformat(other["created_at"])
        if (
            other["merchant"] == txn["merchant"]
            and other["amount_paise"] == txn["amount_paise"]
            and other["switch_status"] == "SUCCESS"
            and o < t
            and t - o <= DUPLICATE_WINDOW
        ):
            return other
    return None


def evaluate_refund(
    *,
    txn: dict,
    switch_status: str | None,
    now: datetime,
    existing_refund: dict | None,
    recent_refund_count: int,
    auto_limit_paise: int,
    duplicate_of: dict | None = None,
    suspicious: bool = False,
) -> RefundDecision:
    amount = txn["amount_paise"]
    checks: list[Check] = []

    def done(decision: Decision, code: str, text: str, policy: str) -> RefundDecision:
        return RefundDecision(decision, code, text, amount, policy, checks)

    # 1. Evidence: the switch status must have been checked in this run.
    has_evidence = switch_status in {"SUCCESS", "FAILED", "PENDING"}
    checks.append(Check("switch_status_verified", has_evidence,
                        f"Payment switch status: {switch_status or 'not checked'}"))
    if not has_evidence:
        return done("block", "missing_evidence",
                    "The payment-switch status has not been verified in this run, so no refund decision can be made.",
                    "POL-FAILED-DEBIT")

    # 2. Idempotency: never refund twice.
    already = bool(existing_refund) or bool(txn.get("reversed"))
    checks.append(Check("not_already_refunded", not already,
                        f"Existing refund: {existing_refund['id']}" if existing_refund
                        else ("Already reversed by bank" if txn.get("reversed") else "No refund on record")))
    if already:
        return done("already_done", "already_refunded",
                    "This payment has already been refunded or reversed.", "POL-FAILED-DEBIT")

    # 3. The customer must actually have been debited.
    debited = txn["debit_status"] == "DEBITED"
    checks.append(Check("customer_debited", debited, f"Debit status: {txn['debit_status']}"))
    if not debited:
        return done("block", "not_debited", "The customer's account was not debited, so there is nothing to refund.",
                    "POL-FAILED-DEBIT")

    # 4. Status-specific rules.
    policy_id = "POL-FAILED-DEBIT"
    if switch_status == "PENDING":
        age = now - datetime.fromisoformat(txn["created_at"])
        within = age < TAT_WINDOW
        checks.append(Check("within_tat_window", within, f"Age {age.total_seconds() / 3600:.1f}h vs T+1 window 24h"))
        if within:
            return done("wait", "pending_within_tat",
                        "The payment is still pending inside the T+1 window and may complete; do not refund yet.",
                        "POL-PENDING")
        return done("escalate", "pending_past_tat",
                    "The payment has been pending beyond T+1; payments operations must investigate.", "POL-PENDING")

    if switch_status == "SUCCESS":
        is_dup = duplicate_of is not None
        checks.append(Check("duplicate_of_earlier_payment", is_dup,
                            f"Duplicate of {duplicate_of['id']}" if is_dup else "No matching earlier payment"))
        if not is_dup:
            return done("block", "payment_successful",
                        "The payment succeeded and the merchant was paid. The AI teammate cannot refund successful "
                        "payments; a merchant dispute must be raised by a human.", "POL-MERCHANT-DISPUTE")
        policy_id = "POL-DUPLICATE"
    else:  # FAILED
        checks.append(Check("switch_reports_failed", True, "Switch confirms the payment failed after debit"))

    # 5. Approval routing.
    within_limit = amount <= auto_limit_paise
    checks.append(Check("within_auto_refund_limit", within_limit,
                        f"Rs {amount / 100:,.2f} vs limit Rs {auto_limit_paise / 100:,.2f}"))
    low_frequency = recent_refund_count < REPEAT_REFUND_THRESHOLD
    checks.append(Check("refund_frequency_normal", low_frequency, f"{recent_refund_count} refunds in last 30 days"))
    checks.append(Check("request_not_flagged", not suspicious,
                        "Request flagged as suspicious/manipulative" if suspicious else "No manipulation detected"))

    if within_limit and low_frequency and not suspicious:
        return done("auto_refund", "eligible_auto", "Eligible for an automatic refund.", policy_id)
    reasons = []
    if not within_limit:
        reasons.append("amount above the auto-refund limit")
    if not low_frequency:
        reasons.append("frequent refunds on this account")
    if suspicious:
        reasons.append("request flagged as suspicious")
    return done("needs_approval", "approval_required", "Eligible, but needs human approval: " + ", ".join(reasons) + ".",
                "POL-APPROVAL")


# Ticket status transitions that tools may perform.
AGENT_TICKET_STATUSES = {"in_progress", "awaiting_customer", "waiting_on_bank", "resolved"}
TERMINAL_STATUSES = {"resolved", "closed"}
