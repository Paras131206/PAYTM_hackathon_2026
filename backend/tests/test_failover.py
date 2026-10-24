"""Provider failover: Gemini -> OpenAI-compatible (Groq/Ollama) mid-run, with mocked HTTP. No network."""
import json

import httpx
import pytest

from app import db
from app.agent import orchestrator as orch
from app.agent.llm import GeminiClient, OpenAICompatClient
from app.agent.planners import LLMPlanner
from app.agent.providers import GeminiProvider, OpenAICompatProvider, build_chain, configured_chain
from app.config import settings

ASSESS = {"intent": "failed_debit", "target_txn_id": "UPI4021000101", "confidence": "high",
          "needs_clarification": False, "injection_suspected": False, "rationale": "explicit id"}
DAILY_QUOTA = {"error": {"code": 429, "message": "You exceeded your current quota", "details": [
    {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "79525s"}]}}


def gemini(script, seen):
    def handler(req):
        seen.append(("gemini", json.loads(req.content)))
        status, body = script.pop(0)
        return httpx.Response(status, json=body)
    return GeminiProvider(GeminiClient(http=httpx.Client(transport=httpx.MockTransport(handler)), api_key="k"))


def compat(name, script, seen):
    def handler(req):
        body = json.loads(req.content)
        seen.append((name, body))
        item = script.pop(0)
        status, payload = item(body) if callable(item) else item
        return httpx.Response(status, json=payload, headers={"retry-after": "0"} if status == 429 else {})
    return OpenAICompatProvider(OpenAICompatClient(name=name, base_url="https://x.test/v1", model=f"{name}-m",
                                                   http=httpx.Client(transport=httpx.MockTransport(handler))))


def oa_calls(*calls, finish="tool_calls"):
    return 200, {"choices": [{"finish_reason": finish, "message": {"role": "assistant", "content": "", "tool_calls": [
        {"id": f"call_{name}", "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}
        for name, args in calls]}}]}


def oa_text(text):
    return 200, {"choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": text}}]}


def run(planner, ticket="TKT-1001"):
    rid = orch.create_run(ticket, "llm")
    return rid, orch.execute_run(rid, planner_factory=lambda _e: planner)


def events(rid, kind):
    return [e["payload"] for e in orch.run_events(rid) if e["kind"] == kind]


def test_mid_run_failover_from_gemini_to_groq_resolves(monkeypatch):
    monkeypatch.setattr("app.agent.llm.time.sleep", lambda _s: None)
    seen = []
    g = gemini([
        (200, {"candidates": [{"finishReason": "STOP", "content": {"role": "model", "parts": [
            {"functionCall": {"name": "record_assessment", "args": ASSESS}, "thoughtSignature": "s1"}]}}]}),
        (429, DAILY_QUOTA),                                      # quota hit mid-run
    ], seen)

    def refund_step(_b):
        rid_ = db.query_one("SELECT id FROM refunds")["id"]
        return oa_calls(("verify_refund", {"refund_id": rid_}))

    def close_step(_b):
        rid_ = db.query_one("SELECT id FROM refunds")["id"]
        return oa_calls(("update_ticket", {"ticket_id": "TKT-1001", "status": "resolved", "note": "verified"}),
                        ("reply_to_customer", {"ticket_id": "TKT-1001",
                                               "message": f"Your refund of Rs 450 has been processed ({rid_})."}))

    groq = compat("groq", [
        oa_calls(("check_switch_status", {"txn_id": "UPI4021000101"})),
        oa_calls(("issue_refund", {"txn_id": "UPI4021000101", "reason": "failed_debit"})),
        refund_step, close_step, oa_text("Resolved."),
    ], seen)
    rid, out = run(LLMPlanner([g, groq]))
    assert out == "resolved"
    fo = events(rid, "llm_failover")
    assert len(fo) == 1 and fo[0]["from"].startswith("gemini") and fo[0]["to"] == "groq:groq-m"
    assert fo[0]["code"] == "rate_limited"
    model = db.query_one("SELECT model FROM runs WHERE id = ?", (rid,))["model"]
    assert "gemini" in model and "groq:groq-m" in model
    # Groq received the Gemini turn re-rendered as an OpenAI tool call + tool result.
    first_groq = next(b for name, b in seen if name == "groq")
    roles = [m["role"] for m in first_groq["messages"]]
    assert roles == ["system", "user", "assistant", "tool"]
    assert first_groq["messages"][2]["tool_calls"][0]["function"]["name"] == "record_assessment"
    assert first_groq["messages"][3]["tool_call_id"] == first_groq["messages"][2]["tool_calls"][0]["id"]
    assert first_groq["tool_choice"] == "auto" and first_groq["tools"][0]["type"] == "function"


def test_all_providers_unavailable_escalates_never_rules(monkeypatch):
    monkeypatch.setattr("app.agent.llm.time.sleep", lambda _s: None)
    seen = []
    g = gemini([(429, DAILY_QUOTA)], seen)
    groq = compat("groq", [(429, {"error": {"message": "rate"}})] * 3, seen)
    ollama = compat("ollama", [], seen)
    ollama.client._http = httpx.Client(transport=httpx.MockTransport(
        lambda r: (_ for _ in ()).throw(httpx.ConnectError("refused"))))
    rid, out = run(LLMPlanner([g, groq, ollama]))
    assert out == "escalated"
    assert [f["to"].split(":")[0] for f in events(rid, "llm_failover")] == ["groq", "ollama"]
    assert events(rid, "error")[0]["code"] == "connection_error"
    assert db.query_one("SELECT status FROM runs WHERE id = ?", (rid,))["status"] == "failed"
    assert not db.query("SELECT * FROM messages WHERE role = 'agent'") and db.query("SELECT * FROM refunds") == []


def test_refusal_does_not_fail_over():
    seen = []
    g = gemini([(200, {"candidates": [{"finishReason": "SAFETY", "content": {"parts": []}}]})], seen)
    groq = compat("groq", [oa_text("should never be called")], seen)
    rid, out = run(LLMPlanner([g, groq]))
    assert events(rid, "error")[0]["code"] == "refusal" and not events(rid, "llm_failover")
    assert [n for n, _ in seen] == ["gemini"]


def test_unparseable_tool_arguments_are_rejected_not_executed():
    seen = []
    bad = (200, {"choices": [{"finish_reason": "tool_calls", "message": {"role": "assistant", "tool_calls": [
        {"id": "c1", "type": "function", "function": {"name": "issue_refund", "arguments": "{not json"}}]}}]})
    groq = compat("groq", [bad, oa_text("stopping")], seen)
    rid, _ = run(LLMPlanner([groq]))
    r = [p for p in events(rid, "tool_result") if p["tool"] == "issue_refund"][0]
    assert r["status"] == "invalid_args" and db.query("SELECT * FROM refunds") == []


def test_chain_order_and_configuration(monkeypatch):
    monkeypatch.setattr(settings, "llm_providers", ["groq", "gemini", "ollama"])
    monkeypatch.setenv("GEMINI_API_KEY", "g")
    monkeypatch.setattr(settings, "groq_api_key", "")
    monkeypatch.setattr(settings, "ollama_model", "qwen2.5:3b-instruct")
    assert configured_chain() == ["gemini", "ollama"]          # unconfigured groq skipped, order kept
    monkeypatch.setattr(settings, "groq_api_key", "gsk_x")
    assert [p.name for p in build_chain()] == ["groq", "gemini", "ollama"]
    ollama = build_chain()[-1]
    assert ollama.client._url == "http://localhost:11434/v1/chat/completions" and not ollama.client._headers


def test_api_key_sent_as_bearer_header_not_url():
    seen_req = []
    c = OpenAICompatClient(name="groq", base_url="https://api.groq.com/openai/v1", model="m", api_key="secret-k",
                           http=httpx.Client(transport=httpx.MockTransport(
                               lambda r: seen_req.append(r) or httpx.Response(200, json={"choices": [
                                   {"finish_reason": "stop", "message": {"content": "ok"}}]}))))
    c.create(messages=[{"role": "user", "content": "hi"}], tools=[])
    assert seen_req[0].headers["authorization"] == "Bearer secret-k" and "secret-k" not in str(seen_req[0].url)


def test_groq_tool_call_glitch_is_retried_not_fatal():
    seen = []
    glitch = (400, {"error": {"message": "Tool call validation failed: attempted to call tool 'commentary' "
                                         "which was not in request.tools", "code": "tool_use_failed"}})
    groq = compat("groq", [glitch, oa_text("Nothing to do.")], seen)
    rid, _ = run(LLMPlanner([groq]))
    assert len(seen) == 2 and not events(rid, "error")


# ---------------------------------------------------------------- regressions from the second code review
def test_per_day_quota_fails_fast_even_with_short_retry_delay(monkeypatch):
    slept = []
    monkeypatch.setattr("app.agent.llm.time.sleep", slept.append)
    body = {"error": {"code": 429, "message": "quota", "details": [
        {"@type": "type.googleapis.com/google.rpc.QuotaFailure", "violations": [
            {"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]},
        {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "22s"}]}}
    seen = []
    g = gemini([(429, body)], seen)
    rid, _ = run(LLMPlanner([g]))
    assert slept == [] and len(seen) == 1 and events(rid, "error")[0]["code"] == "rate_limited"


def test_malformed_reply_fails_over_and_keeps_the_audit_trail(monkeypatch):
    monkeypatch.setattr("app.agent.llm.time.sleep", lambda _s: None)
    seen = []
    g = gemini([(429, DAILY_QUOTA)], seen)

    def html(_req):
        seen.append(("groq", None))
        return httpx.Response(200, text="<html>Bad gateway</html>")
    groq = OpenAICompatProvider(OpenAICompatClient(name="groq", base_url="https://x.test/v1", model="groq-m",
                                                   http=httpx.Client(transport=httpx.MockTransport(html))))
    ollama = compat("ollama", [oa_text("nothing to do")], seen)
    rid, _ = run(LLMPlanner([g, groq, ollama]))
    hops = [(f["to"].split(":")[0], f["code"]) for f in events(rid, "llm_failover")]
    assert hops == [("groq", "rate_limited"), ("ollama", "bad_response")]
    assert db.query_one("SELECT model FROM runs WHERE id = ?", (rid,))["model"] == "ollama:ollama-m"


def test_run_model_says_none_answered_when_every_provider_failed(monkeypatch):
    monkeypatch.setattr("app.agent.llm.time.sleep", lambda _s: None)
    seen = []
    rid, _ = run(LLMPlanner([gemini([(429, DAILY_QUOTA)], seen)]))
    assert db.query_one("SELECT model FROM runs WHERE id = ?", (rid,))["model"] == "none answered"


def test_generated_tool_call_ids_are_unique_across_turns():
    seen = []
    no_id = (200, {"choices": [{"finish_reason": "tool_calls", "message": {"role": "assistant", "tool_calls": [
        {"type": "function", "function": {"name": "get_policy", "arguments": '{"policy_id": "POL-PENDING"}'}}]}}]})
    ollama = compat("ollama", [no_id, no_id, oa_text("done")], seen)
    run(LLMPlanner([ollama]))
    ids = [m["tool_call_id"] for m in seen[-1][1]["messages"] if m["role"] == "tool"]
    assert len(ids) == 2 and len(set(ids)) == 2


def test_foreign_turns_sent_to_gemini_carry_the_placeholder_signature():
    from app.agent.providers import ToolCall, Turn
    seen = []
    g = gemini([(200, {"candidates": [{"finishReason": "STOP", "content": {"role": "model", "parts": [
        {"text": "ok"}]}}]})], seen)
    groq_turn = Turn("groq", "m", "", [ToolCall("call_1", "get_policy", {"policy_id": "POL-PENDING"})])
    g.complete("sys", [("user", "hi"), ("assistant", groq_turn), ("results", [])])
    part = seen[0][1]["contents"][1]["parts"][0]
    assert part["thoughtSignature"] == "skip_thought_signature_validator" and part["functionCall"]["id"] == "call_1"


def test_groq_tool_use_failed_code_is_retried():
    seen = []
    glitch = (400, {"error": {"message": "Failed to call a function. Please adjust your prompt.",
                              "code": "tool_use_failed"}})
    rid, _ = run(LLMPlanner([compat("groq", [glitch, oa_text("ok")], seen)]))
    assert len(seen) == 2 and not events(rid, "error")


def test_auto_engine_follows_llm_providers(monkeypatch):
    from app.config import Settings
    for k in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "OLLAMA_MODEL"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("GROQ_API_KEY", "gsk_x")
    monkeypatch.setenv("AGENT_ENGINE", "auto")
    monkeypatch.setenv("LLM_PROVIDERS", "gemini")
    assert Settings().resolved_engine == "rules"          # groq has a key but isn't in the chain
    monkeypatch.setenv("LLM_PROVIDERS", "gemini,groq")
    assert Settings().resolved_engine == "llm"
