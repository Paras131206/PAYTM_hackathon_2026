from datetime import datetime, timedelta, timezone

from app import policy

NOW = datetime(2026, 10, 24, 12, 0, tzinfo=timezone.utc)


def txn(**kw):
    base = {"id": "UPI1", "merchant": "M", "amount_paise": 45000, "debit_status": "DEBITED", "reversed": 0,
            "switch_status": "FAILED", "created_at": (NOW - timedelta(hours=3)).isoformat()}
    return {**base, **kw}


def decide(t, status="FAILED", **kw):
    args = dict(txn=t, switch_status=status, now=NOW, existing_refund=None, recent_refund_count=0,
                auto_limit_paise=200000)
    args.update(kw)
    return policy.evaluate_refund(**args)


def test_failed_debit_within_limit_is_auto():
    d = decide(txn())
    assert d.decision == "auto_refund" and d.amount_paise == 45000
    assert all(c.passed for c in d.checks)


def test_above_limit_needs_approval():
    d = decide(txn(amount_paise=850000))
    assert d.decision == "needs_approval"
    assert any(c.name == "within_auto_refund_limit" and not c.passed for c in d.checks)


def test_frequent_refunds_need_approval():
    assert decide(txn(), recent_refund_count=3).decision == "needs_approval"


def test_suspicious_needs_approval_even_when_small():
    assert decide(txn(), suspicious=True).decision == "needs_approval"


def test_missing_switch_evidence_blocks():
    d = decide(txn(), status=None)
    assert d.decision == "block" and d.reason_code == "missing_evidence"


def test_successful_payment_blocked():
    d = decide(txn(), status="SUCCESS")
    assert d.decision == "block" and d.reason_code == "payment_successful"


def test_pending_inside_and_after_tat():
    assert decide(txn(), status="PENDING").decision == "wait"
    old = txn(created_at=(NOW - timedelta(hours=30)).isoformat())
    assert decide(old, status="PENDING").decision == "escalate"


def test_already_refunded_is_idempotent():
    assert decide(txn(), existing_refund={"id": "R1"}).decision == "already_done"
    assert decide(txn(reversed=1)).decision == "already_done"


def test_not_debited_blocked():
    assert decide(txn(debit_status="NOT_DEBITED")).reason_code == "not_debited"


def test_duplicate_detection_and_refund():
    first = txn(id="A", switch_status="SUCCESS", created_at=(NOW - timedelta(minutes=12)).isoformat())
    second = txn(id="B", switch_status="SUCCESS", created_at=(NOW - timedelta(minutes=10)).isoformat())
    far = txn(id="C", switch_status="SUCCESS", created_at=(NOW - timedelta(hours=2)).isoformat())
    assert policy.find_duplicate_original(second, [first, second, far])["id"] == "A"
    assert policy.find_duplicate_original(far, [first, second, far]) is None
    assert decide(second, status="SUCCESS", duplicate_of=first).decision == "auto_refund"
