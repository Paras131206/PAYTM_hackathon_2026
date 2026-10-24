# requirements.md — dependencies and installation

The real manifests are `backend/requirements.txt` (Python) and `frontend/package.json` plus `frontend/package-lock.json` (JavaScript). This file explains them. If you change a manifest, update this file in the same commit (agents.md, rule 13).

## Runtimes

Optional: the **Ollama** app (tested 0.40.5) for the local LLM provider.

| Runtime | Tested version | Notes |
|---|---|---|
| Python | 3.14.8 (macOS arm64) | Use 3.12 or newer. The code uses modern typing syntax. Python 3.14 needs pydantic 2.12 or newer, which ships the 3.14 wheels. |
| Node.js | 26.7.0 | Vite 8 needs Node 20.19 or newer. |
| npm | 11.19.0 | It produced the committed `package-lock.json`. |

No database server is needed. SQLite is part of the Python standard library.

## Python packages (`backend/requirements.txt`)

| Package | Version | Purpose | Used by | Notes |
|---|---|---|---|---|
| fastapi | ==0.162.0 | HTTP API, request validation, background tasks | `app/api.py` | Brings in Starlette 1.9.0. |
| uvicorn[standard] | ==0.54.0 | ASGI server | how you start the backend | `[standard]` adds uvloop and httptools for speed. |
| pydantic | ==2.14.1 | Typed tool input schemas, API bodies | `tools/registry.py`, `api.py` | v2 API (`model_validate`, `ConfigDict`). |
| anthropic | ==2.3.0 | Official Claude SDK | `agent/llm.py` only | Built on `httpx2`. This is the only module that imports it. |
| python-dotenv | ==1.2.4 | Loads `.env` from the repo root | `app/config.py` | Real environment variables take precedence. |
| httpx | ==0.28.1 | Gemini and OpenAI-compatible (Groq, Cerebras, Ollama) clients, and `fastapi.testclient` | `agent/llm.py`, `tests/` | The anthropic SDK uses `httpx2`, a separate package. |
| pytest | ==9.1.1 | Test runner | `backend/tests/` | Test-only. |

**Why no Google SDK:** `pip install google-genai` timed out repeatedly against PyPI from the build machine. The Gemini adapter therefore calls the documented REST endpoint (`v1beta/models/{model}:generateContent`) through `httpx`, which was already a dependency. Switching to the SDK later only touches `GeminiClient` in `agent/llm.py`.

Not used on purpose: the `openai` SDK (Groq, Cerebras and Ollama are called with plain `httpx`; the request is one JSON POST), SQLAlchemy (plain `sqlite3` is enough for this schema), agent frameworks (the tool loop is about 60 lines and fully visible), vector databases (context is fetched by indexed SQL lookups), pandas.

### Install

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

On Windows, use `.venv\Scripts\pip` and `.venv\Scripts\python`.

## JavaScript packages (`frontend/package.json`)

| Package | Version | Kind | Purpose |
|---|---|---|---|
| react | 19.3.1 | runtime | UI |
| react-dom | 19.3.1 | runtime | DOM renderer |
| vite | 8.3.5 | dev | Dev server with an `/api` proxy, and the production build |
| @vitejs/plugin-react | 6.1.2 | dev | JSX transform and fast refresh |
| typescript | 7.0.2 | dev | Type checking (`tsc --noEmit`) |
| @types/react, @types/react-dom | 19.3.0 | dev | React type definitions |

There is no CSS framework, router, chart or state library. Styling is one hand-written CSS file with design tokens. Routing is hash-based. Charts are CSS bars.

### Install

```bash
cd frontend
npm ci
```

`npm ci` installs exactly what the lockfile lists.

## Compatibility notes

- `anthropic` 2.x: `temperature`, `top_p` and `top_k` are rejected by the API (as of 2026-10-21), so the adapter never sends them. Forced `tool_choice` returns a 400 on `claude-opus-5-5`, so the adapter uses `auto` with `strict: true` tools.
- The refusal fallback uses the beta header `server-side-fallback-2026-07-01`. If your account rejects it, set `ANTHROPIC_REFUSAL_FALLBACK=0`.
- TypeScript 7 is the native compiler. If your editor's TypeScript plugin expects 5.x, keep using `npm run typecheck` as the source of truth.

## Verification status

- The Python install above was run on this machine, and `pytest` passed (see steps.md §15).
- `npm install` was run, and `npm run build` (typecheck plus Vite build) passed.
- No live Gemini or Anthropic call has been made from this machine yet, because no API key is configured. See runthrough.md §4.
