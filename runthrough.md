# runthrough.md — setup and demo guide

This guide takes you from a clean checkout to a running demo. Commands assume macOS or Linux with the repository at `PAYTM_hackathon_2026/`.

## 1. What is real, sandboxed or planned

| Part | Status |
|---|---|
| Agent loop, policy engine, tool registry, verification, audit trail, approvals, metrics | **Real and working** (local) |
| LLM planner (`engine=llm`) with failover | **Real.** Providers are tried in `LLM_PROVIDERS` order (default gemini → groq → ollama). Only configured ones join the chain. **Tested live:** Gemini, and a real Gemini 429 failing over to local Ollama mid-run. Groq tested live too, including a real Gemini 429 failing over to Groq mid-ticket. |
| Rules planner (`engine=rules`) | **Real**, deterministic, no LLM. Always labelled in the UI. |
| Payment switch status | **Sandbox**: reads ground truth from SQLite. Supports injected outages and timeouts. |
| Refund rail | **Sandbox**: writes a refund row and marks the transaction reversed. **No money moves.** |
| Customer replies | **Internal**: in-app ticket thread only. No SMS, email or WhatsApp is sent. |
| Customers, transactions, tickets | **Synthetic** demo data |
| Compensation (₹100/day beyond T+1), auth/login, deployment, multilingual replies | **Planned**, not built |

## 2. Prerequisites

- Python 3.12 or newer (tested 3.14.8)
- Node.js 20.19 or newer (tested 26.7.0) and npm
- Optional: a free Gemini and/or Groq API key, and/or the Ollama app for a local model

## 3. Install

```bash
cd PAYTM_hackathon_2026/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

```bash
cd PAYTM_hackathon_2026/frontend
npm ci
```

## 4. Configure real LLMs (with automatic failover)

```bash
cd PAYTM_hackathon_2026
cp .env.example .env
```

Open `.env` (`open -e .env` on macOS) and set as many providers as you like. Or set one key at a time without it showing on screen: `zsh scripts/set-key.sh GROQ_API_KEY` (works for any variable name).

The app supports Gemini, Groq and Ollama only. Paid providers (Anthropic, Cerebras) were removed on 2026-10-24 at the team's request. Each one you configure joins the failover chain:

| Provider | Setting | Notes |
|---|---|---|
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` | Key from https://aistudio.google.com/apikey. The free tier allows **20 requests/day per model**. |
| Groq | `GROQ_API_KEY`, `GROQ_MODEL` | Free tier, https://console.groq.com/keys |
| Ollama | `OLLAMA_MODEL` (empty = off) | Runs locally, free, works offline. Needs the Ollama app running. Small models (3B) handle the tools poorly; use 7B or larger. |

`LLM_PROVIDERS` sets the order. On a **quota (429), timeout, outage or bad key**, the run switches to the next configured provider *mid-ticket*. The timeline shows "Switched LLM: A → B", and the run's model column lists every model that answered. It moves **forward only**. A **refusal never triggers a switch.** If every provider fails, the run is marked failed and the ticket is escalated. It never drops to the rules engine silently.

With `AGENT_ENGINE=auto` (the default), the backend uses the LLM chain if any provider is configured, else the rules engine, decided once at startup. **Restart the backend after you edit `.env`.**

## 5. Start

Terminal 1, the backend on **http://127.0.0.1:8000**:

```bash
cd PAYTM_hackathon_2026/backend
.venv/bin/uvicorn app.api:app --host 127.0.0.1 --port 8000
```

Terminal 2, the frontend on **http://localhost:5173**:

```bash
cd PAYTM_hackathon_2026/frontend
npm run dev
```

Open **http://localhost:5173**. The dev server forwards `/api` to port 8000.

To check the backend:

```bash
curl http://127.0.0.1:8000/api/health
```

Expected: `{"status":"ok", "engine":"llm" | "rules", ...}`. Interactive API docs are at http://127.0.0.1:8000/docs.

## 6. Demo data and reset

The backend seeds the database (`backend/data/resolv.db`) on first start. Use **Reset demo** in the top bar to reset it, or run either of these:

```bash
curl -X POST http://127.0.0.1:8000/api/demo/reset
```

```bash
cd PAYTM_hackathon_2026/backend
.venv/bin/python -m app.seed
```

A reset deletes all runs, refunds and approvals, and recreates 8 customers, 12 transactions and 8 open tickets. Timestamps are relative to the moment of reset.

## 7. Demo script (about 5 minutes)

| Step | Where | Do | What you should see |
|---|---|---|---|
| 1 | Cases → **TKT-1001** | Press **Run Resolv** | The timeline shows 7 tool calls: assessment → lookup → **switch: FAILED** → issue_refund (policy checks all ✓) → **verify_refund: verified in ledger** → resolved → reply. The transaction card turns green with `refunded · RFND-…`. A refund row appears in the ledger. |
| 2 | **TKT-1002** (Rs 8,500) | Run | Policy shows ✕ `within_auto_refund_limit`. Status is **pending approval**, and the banner links to the Human queue. No refund exists yet. |
| 3 | **Human queue** | Read the evidence and checks, then press **Approve refund** | The approval re-checks the switch, refunds, verifies and resolves. The refund's `created_by` is `human:<reviewer>`. |
| 4 | **TKT-1004** (ambiguous) | Run | The agent asks which of two payments was meant. Status is `awaiting customer`. |
| 5 | TKT-1004 | Type `It was the Big Bazaar one, Rs 650` and press **Send as customer** | A new run starts automatically, uses the conversation history, refunds only `UPI4021000402`, and resolves. |
| 6 | **TKT-1005** | Run | `check_switch_status` fails 3 times (seeded outage). The agent escalates with `tool_failure` and makes no guess. |
| 7 | **TKT-1006** (prompt injection) | Run | The red **Guard: manipulation pattern detected** entry appears. The switch says SUCCESS, so `issue_refund` is **blocked** (`payment_successful`) and the ticket is escalated as `suspicious_request`. No refund. |
| 8 | **TKT-1003**, **TKT-1007**, **TKT-1008** | Run each | Pending inside T+1 → `waiting on bank` with an ETA. Duplicate charge → only the later payment is refunded. "Real person" → immediate escalation. |
| 9 | **Overview** | — | Resolution, escalation and verified-refund rates with numerator and denominator, blocked actions by reason, and the **Scenario check** (expected vs actual for each seeded ticket). |
| 10 | **System** | — | Engine, model, integration modes (live, sandbox or internal), the tool list, and failure injection. |

**Custom case:** Cases → **New case** → pick a customer → write a message → **Create and run agent**.

## 8. Inspecting decisions and tool execution

- **Case workspace → Agent run:** every event in order. Each tool card shows its arguments, whether it is read or write, the SANDBOX badge, the result status, the number of attempts, the policy checks and the verification. **Inputs and result** shows the raw JSON, including the idempotency key.
- **API:** `GET /api/runs/{id}` returns the run and its full event list (the audit trail).
- **Database:** `sqlite3 backend/data/resolv.db "select seq, kind, payload from events where run_id = 1"`.

## 9. Testing failure handling by hand

- **System → Failure injection:** target `*` with mode `outage` makes every switch call fail. Run any open ticket: you get 3 attempts, then an escalation. Press **Clear** to remove the fault.
- Mode `timeout` behaves the same way, with an `adapter_timeout` code.
- **LLM engine without a provider:** in the engine dropdown, "LLM with failover" is disabled and labelled "(no provider configured)" until a key or `OLLAMA_MODEL` is set. The API returns `400` with an explanation.

## 10. Running the tests

```bash
cd PAYTM_hackathon_2026/backend
.venv/bin/python -m pytest -q
```

Expected: `81 passed`. The tests use a temporary database and **mocked** provider clients (Gemini, OpenAI-compatible), so they make no network calls.

```bash
cd PAYTM_hackathon_2026/frontend
npm run build
```

This runs the TypeScript type check and the production build.

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| Top bar says "backend unreachable" | Start the backend on port 8000. Check `curl http://127.0.0.1:8000/api/health`. |
| `409 Run … already in progress` | Wait for the current run to finish. Only one run per ticket can be active. |
| `409 Ticket is escalated; a human owns it now` | This is by design. Use the Human queue, or reset the demo. |
| "LLM with failover" is greyed out | No provider was configured when the backend started. Set a key (or `OLLAMA_MODEL`) in `.env` and restart the backend. |
| Ollama: `connection_error` | Start the Ollama app (`ollama serve`) and pull the model: `ollama pull <OLLAMA_MODEL>`. |
| Gemini `model_not_found` | The model name changed. Set `GEMINI_MODEL` to a model your key lists at https://aistudio.google.com. |
| Gemini `rate_limited` / "exceeded your current quota" | The free tier allows **20 requests per day per model**, and one ticket uses about 4–10. Switch `GEMINI_MODEL` to another model with its own quota (`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`; note that `gemini-3.5-flash` shares 3.6-flash's quota), restart the backend, or enable billing in Google AI Studio. |
| `pip` fails building `pydantic-core` | Use Python 3.12–3.14 so a prebuilt wheel is available. |
| Port in use | `lsof -i :8000` or `lsof -i :5173`, then stop the other process. |
| Odd state after experiments | Reset the demo (§6). |
