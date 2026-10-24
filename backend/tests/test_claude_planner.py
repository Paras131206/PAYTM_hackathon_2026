"""Claude planner tests with a mocked Anthropic client. No network calls are made here."""
import copy

import anthropic
import httpx2
import pytest

from app import db
from app.agent import orchestrator as orch
from app.agent.llm import ClaudeClient, LLMError
from app.agent.planners import LLMPlanner
from app.agent.providers import ClaudeProvider
from app.config import settings

from .conftest import FakeAnthropic, text, tool_use


def run_with(script, ticket="TKT-1001"):
    fake = FakeAnthropic(script)
    rid = orch.create_run(ticket, "llm")
    out = orch.execute_run(rid, planner_factory=lambda _e: LLMPlanner([ClaudeProvider(ClaudeClient(client=fake))]))
    return rid, out, fake


def events(rid, kind):
    return [e["payload"] for e in orch.run_events(rid) if e["kind"] == kind]


ASSESS_1001 = {"intent": "failed_debit", "target_txn_id": "UPI4021000101", "confidence": "high",
               "needs_clarification": False, "injection_suspected": False, "rationale": "explicit id"}


def test_happy_path_multi_turn_tool_loop():
    script = [
        ([text("Assessing."), tool_use("a", "record_assessment", ASSESS_1001)], "tool_use"),
        ([tool_use("b", "check_switch_status", {"txn_id": "UPI4021000101"})], "tool_use"),
        ([tool_use("c", "issue_refund", {"txn_id": "UPI4021000101", "reason": "failed_debit"})], "tool_use"),
        (None, None),  # placeholder replaced below once we know the refund id
    ]
    fake = FakeAnthropic(script[:3])
    rid = orch.create_run("TKT-1001", "llm")
    planner = LLMPlanner([ClaudeProvider(ClaudeClient(client=fake))])

    def dynamic(**kw):
        fake.requests.append(copy.deepcopy(kw))
        if fake.script:
            content, stop = fake.script.pop(0)
            from types import SimpleNamespace
            return SimpleNamespace(content=content, stop_reason=stop)
        refund_id = db.query_one("SELECT id FROM refunds")["id"]
        steps = {
            4: ([tool_use("d", "verify_refund", {"refund_id": refund_id})], "tool_use"),
            5: ([tool_use("e", "update_ticket", {"ticket_id": "TKT-1001", "status": "resolved", "note": "verified"}),
                 tool_use("f", "reply_to_customer", {"ticket_id": "TKT-1001",
                                                     "message": f"Your refund of Rs 450 has been processed ({refund_id})."})],
                "tool_use"),
            6: ([text("Resolved TKT-1001 with verified refund.")], "end_turn"),
        }
        from types import SimpleNamespace
        content, stop = steps[len(fake.requests)]
        return SimpleNamespace(content=content, stop_reason=stop)

    fake.beta.messages.create = dynamic
    out = orch.execute_run(rid, planner_factory=lambda _e: planner)
    assert out == "resolved"
    # Parallel tool_use blocks were answered in ONE user message with matching ids.
    last_user = fake.requests[-1]["messages"][-1]
    assert [b["tool_use_id"] for b in last_user["content"]] == ["e", "f"]
    req = fake.requests[0]
    assert req["model"] == settings.anthropic_model and req["tool_choice"] == {"type": "auto"}
    assert "temperature" not in req and all(t["strict"] for t in req["tools"])
    assert "<untrusted_customer_content>" in req["messages"][0]["content"]


def test_invalid_tool_args_from_model_are_rejected_and_reported_as_error():
    script = [
        ([tool_use("a", "record_assessment", ASSESS_1001)], "tool_use"),
        ([tool_use("b", "issue_refund", {"txn_id": "UPI4021000101", "amount": 1_000_000})], "tool_use"),
        ([tool_use("c", "escalate_to_human", {"ticket_id": "TKT-1001", "reason_code": "other",
                                              "summary": "Could not proceed."})], "tool_use"),
        ([text("Escalated.")], "end_turn"),
    ]
    rid, out, fake = run_with(script)
    assert out == "escalated"
    results = fake.requests[2]["messages"][-1]["content"]
    assert results[0]["is_error"] is True and '"invalid_args"' in results[0]["content"]
    assert db.query("SELECT * FROM refunds") == []


def test_model_cannot_refund_successful_payment_even_if_injected():
    script = [
        ([tool_use("a", "record_assessment", {**ASSESS_1001, "target_txn_id": "UPI4021000601",
                                              "injection_suspected": False})], "tool_use"),
        ([tool_use("b", "check_switch_status", {"txn_id": "UPI4021000601"})], "tool_use"),
        ([tool_use("c", "issue_refund", {"txn_id": "UPI4021000601", "reason": "failed_debit"})], "tool_use"),
        ([tool_use("d", "issue_refund", {"txn_id": "UPI4021000601", "reason": "duplicate_charge"})], "tool_use"),
        ([text("Done.")], "end_turn"),
    ]
    rid, out, _ = run_with(script, ticket="TKT-1006")
    assert db.query("SELECT * FROM refunds") == []
    codes = [r["data"].get("code") for r in events(rid, "tool_result") if r["tool"] == "issue_refund"]
    assert codes == ["payment_successful", "payment_successful"]
    assert out == "escalated"  # orchestrator escalates a run that ended without a terminal state
    assert any(e["check"] == "prompt_injection" for e in events(rid, "guard"))


def test_model_claiming_unverified_refund_is_blocked():
    script = [
        ([tool_use("a", "record_assessment", ASSESS_1001)], "tool_use"),
        ([tool_use("b", "reply_to_customer", {"ticket_id": "TKT-1001",
                                              "message": "Your refund has been processed."})], "tool_use"),
        ([tool_use("c", "update_ticket", {"ticket_id": "TKT-1001", "status": "resolved", "note": "done"})],
         "tool_use"),
        ([text("ok")], "end_turn"),
    ]
    rid, out, _ = run_with(script)
    codes = [r["data"].get("code") for r in events(rid, "tool_result") if r["status"] == "blocked"]
    assert codes == ["unverified_claim", "unverified_resolution"]
    assert out == "escalated"
    assert not db.query("SELECT * FROM messages WHERE role='agent'")


def _resp(status: int):
    return httpx2.Response(status, request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages"))


@pytest.mark.parametrize("exc,code", [
    (lambda: anthropic.RateLimitError("rate", response=_resp(429), body=None), "rate_limited"),
    (lambda: anthropic.APITimeoutError(request=httpx2.Request("POST", "https://x")), "timeout"),
    (lambda: anthropic.AuthenticationError("bad key", response=_resp(401), body=None), "auth_failed"),
    (lambda: anthropic.InternalServerError("boom", response=_resp(500), body=None), "api_error"),
])
def test_provider_errors_fail_the_run_without_fallback(exc, code):
    rid, out, _ = run_with([exc()])
    run = db.query_one("SELECT * FROM runs WHERE id = ?", (rid,))
    assert out == "escalated" and run["status"] == "failed" and run["error"].startswith(code)
    assert events(rid, "error")[0]["code"] == code
    # Nothing was fabricated: no refunds, no agent replies.
    assert db.query("SELECT * FROM refunds") == [] and not db.query("SELECT * FROM messages WHERE role='agent'")


def test_refusal_and_truncation_are_errors():
    rid, out, _ = run_with([([], "refusal")])
    assert events(rid, "error")[0]["code"] == "refusal"
    rid, out, _ = run_with([([text("...")], "max_tokens")], ticket="TKT-1003")
    assert events(rid, "error")[0]["code"] == "truncated"


def test_missing_credentials(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    with pytest.raises(LLMError) as e:
        ClaudeClient()
    assert e.value.code == "missing_credentials"
    monkeypatch.setattr(settings, "llm_providers", ["claude"])
    rid = orch.create_run("TKT-1001", "llm")
    assert orch.execute_run(rid) == "escalated"
    assert db.query_one("SELECT status FROM runs WHERE id = ?", (rid,))["status"] == "failed"


def test_turn_budget_enforced(monkeypatch):
    monkeypatch.setattr(settings, "max_agent_turns", 3)
    loop = [([tool_use(f"x{i}", "lookup_transaction", {"txn_id": "UPI4021000101"})], "tool_use") for i in range(5)]
    rid, out, _ = run_with(loop)
    assert out == "escalated"
    assert any(g["check"] == "turn_budget" for g in events(rid, "guard"))


def test_unexpected_stop_reason_fails_run():
    rid, out, _ = run_with([([text("...")], "model_context_window_exceeded")])
    assert out == "escalated" and events(rid, "error")[0]["code"] == "unexpected_stop"


def test_pause_turn_is_unexpected_without_server_tools():
    rid, out, fake = run_with([([text("..")], "pause_turn")])
    assert events(rid, "error")[0]["code"] == "unexpected_stop" and len(fake.requests) == 1
