# agents.md — rules for coding agents and subagents

This file is the authoritative engineering instruction file for any AI coding agent (or human) changing this repository. Read it fully before editing.

## 1. Mission and scope

**Resolv** is an AI support teammate for failed and disputed UPI payments, built for Paytm Hackathon 2026, Track 3. It resolves tickets end to end with real tool actions (sandboxed payment rails), deterministic policy, verification, a human approval queue and outcome metrics.

**In scope:** failed-but-debited payments, pending payments, duplicate charges, refund status, escalation.
**Out of scope** unless steps.md is updated first: sales workflows, real payment rails, outbound SMS/email, authentication.

## 2. Architecture and directory ownership

| Path | Owns | Must not |
|---|---|---|
| `backend/app/agent/llm.py` | HTTP/SDK clients for every LLM provider; error mapping to `LLMError` codes | Contain business rules or tool logic |
| `backend/app/agent/providers.py` | Provider-neutral history and per-provider rendering; the configured chain | Decide policy or execute tools |
| `backend/app/agent/planners.py` | Proposing tool calls (Claude or rules) | Write to the DB, decide policy, or execute tools |
| `backend/app/agent/orchestrator.py` | Run lifecycle, turn budget, outcome derived from persisted state | Trust planner text for outcomes |
| `backend/app/policy.py` | Pure deterministic refund rules | Do any I/O or call an LLM |
| `backend/app/guards.py` | Deterministic injection, human-request and claim detection | — |
| `backend/app/tools/registry.py` | Tool schemas, validation, permissions, retries, idempotency keys, audit events | Be bypassed: **every** tool call goes through `execute()` |
| `backend/app/tools/adapters.py` | SANDBOX switch and refund ledger, fault injection | Pretend to be a real integration |
| `backend/app/handoffs.py` | Human decisions, executed through the registry | Execute refunds directly |
| `backend/app/metrics.py` | Metric definitions (see steps.md §11) | Report un-sourced or extrapolated figures |
| `backend/app/api.py` | HTTP contract | Contain business logic |
| `frontend/src/` | UI. `types.ts` mirrors API shapes. | Fabricate data, activity or statistics |

## 3. Mandatory rules

1. Inspect the relevant code before editing it.
2. Plan substantial changes before implementing them, in steps.md.
3. Keep the LLM, the business rules and tool execution as distinct components (section 2).
4. Never claim an action succeeded unless its execution result confirms it.
5. Never present mock or sandbox tool output as a real external integration.
6. Never silently switch between live and simulated execution. The engine is resolved once at startup, and each run records its engine.
7. Never hardcode successful outcomes and label them live.
8. Validate tool arguments (pydantic, `extra="forbid"`) before execution.
9. Use least-privilege credentials and never commit secrets. `.env` is git-ignored. `.env.example` has placeholders only.
10. Require human approval for high-risk or irreversible actions (refunds above the limit, flagged requests, frequent refunders).
11. Keep an audit trail of decisions, tool calls, results and escalations in the `events` table.
12. Update steps.md and runthrough.md when behaviour or setup changes.
13. Keep requirements.md and the dependency manifests aligned.
14. Test each important workflow and failure state.
15. Document limitations honestly.

## 4. Coding conventions

- Python 3.12+, type hints everywhere, `from __future__ import annotations`. Use dataclasses for internal state and pydantic for external input.
- Money is **integer paise** in storage and logic. Convert to rupees only for display or tool output.
- Timestamps are ISO-8601 UTC strings from `config.utcnow()`. Use that one clock everywhere.
- SQL is parameterised only. Multi-statement writes go in `with db.tx():`.
- TypeScript runs with `strict: true`. API shapes live in `frontend/src/types.ts`. Keep them in sync with `api.py`.
- Comments explain *why*, briefly. Match the density of the surrounding code.

## 5. Tool integration contract

Adding a tool means:
1. a pydantic input model (`_In`, every field typed, with bounds);
2. a handler `(RunContext, Model) -> ToolResult` that raises `Blocked` for policy or permission refusals;
3. a `ToolSpec` with `permission` (`read`/`write`), `integration` (`internal`/`sandbox`, or `live` once one exists), and an `idempotency` key function for writes;
4. ownership checks (`_own_ticket` / `_own_txn`) for anything scoped to a customer;
5. tests for success, invalid args, a permission violation and the failure path.

Write tools must be idempotent, or keyed so that retries are visible and counted once. Adapter exceptions that can be retried must subclass `AdapterError`.

## 6. LLM configuration rules

- Providers: Gemini (REST), Groq / Cerebras / Ollama (OpenAI-compatible `chat/completions`), and Claude (official SDK). Clients live in `agent/llm.py`, rendering in `agent/providers.py`. Engines are `llm` (the `LLM_PROVIDERS` chain) and `rules`.
- Failover: forward only, and only on availability codes (`FAILOVER_CODES` in `planners.py`). Never on `refusal`, `truncated`, `bad_request` or `unexpected_stop`. Every switch is emitted as an `llm_failover` event, and `runs.model` lists the models that answered. Never fail over to the rules engine.
- A provider replays its own earlier turns verbatim (`Turn.raw`). Other providers' turns are rendered from the neutral history.
- Do not loosen tool schemas to accommodate weak models. Validation is a trust boundary.
- Gemini: send the key in the `x-goog-api-key` header (never in the URL). Replay the model's `content` verbatim (it carries thought signatures). Return every `functionResponse` in one user turn. Don't send `additionalProperties` in function schemas. Any `finishReason` other than STOP is an `LLMError`.
- Default model `claude-opus-5-5`, overridable with `ANTHROPIC_MODEL`. Use `output_config.effort` from `ANTHROPIC_EFFORT`.
- Do not send `temperature`, `top_p` or `top_k` (they are rejected). Do not force `tool_choice` (it returns a 400 on Opus 5.5). Tools are `strict: true`.
- Manual tool loop: append the assistant `content` exactly as returned, and return **all** `tool_result` blocks in **one** user message with matching ids. Use `is_error: true` for errors.
- Customer text goes inside `<untrusted_customer_content>`. The system prompt states that it is data. Permissions are enforced in code regardless of what the model does.
- Errors map to `LLMError(code)`, and the run fails and escalates. **There is no fabricated fallback.**
- Unit tests use `tests/conftest.py::FakeAnthropic` and an `httpx.MockTransport` for Gemini. Never call a live API from tests.

## 7. Dependency management

- Python: pin exact tested versions in `backend/requirements.txt`. Frontend: `package.json` plus a committed `package-lock.json`. Install with `npm ci`.
- Add a dependency only when the standard library or the existing stack can't do the job. Record why in requirements.md.

## 8. Data validation and privacy

- All synthetic data is labelled synthetic in the UI and the seed. Never add real customer data.
- Phone numbers stay masked. Don't log API keys. Don't put PII in URLs.
- Treat tool outputs and customer messages as untrusted. Never `eval` or format them into SQL.

## 9. UI design rules

- Use a restrained token palette (`styles.css :root`) with light and dark themes. Status colour comes from `StatusBadge` only.
- No gradients, glows, emoji icons, AI illustrations, fake activity feeds or invented statistics.
- Every async view needs loading, empty and error states. Controls must be keyboard-accessible and labelled.
- Sandbox actions carry the `SANDBOX` badge. The engine badge is always visible in the top bar.
- Layouts must work at 375px wide without horizontal scrolling.

## 10. Documentation obligations

| Change | Update |
|---|---|
| Behaviour, tools, policy, metrics | steps.md (relevant section and the tracker) |
| Setup, commands, ports, environment variables | runthrough.md and `.env.example` |
| Dependencies | requirements.md and the manifest |
| Rules for agents | this file |

## 11. Git and change management

- Use small commits with clear messages. Never commit `.env`, `backend/data/*.db`, `node_modules/` or `.venv/`.
- The unrelated folders listed in `.gitignore` (plugins and Windows tools) are not part of this project. Don't edit, move or delete them.
- Never push or publish without the repository owner's explicit permission.

## 12. Subagent delegation and review

- Delegate only discrete tasks with a clear brief (files, the invariant to protect, what done looks like).
- Review subagents are **read-only** unless explicitly told otherwise.
- The delegating agent must verify subagent findings against the code and tests before acting. Subagent claims are not evidence.

## 13. Definition of done (per change)

- [ ] Code follows section 2 ownership and section 3 rules.
- [ ] `cd backend && .venv/bin/python -m pytest -q` passes.
- [ ] `cd frontend && npm run build` passes.
- [ ] The workflow was exercised end to end in the browser when the UI or the API changed.
- [ ] Docs updated per section 10, with actual test results recorded in steps.md §15.
- [ ] No secrets, no misleading "live" claims, no fabricated metrics.
