# Resolv: an AI support teammate for failed UPI payments

Prototype for Paytm Hackathon 2026, Track 3 (Autonomous AI Teammates).

Resolv works a payments support queue. It reads customer context, identifies the intent and the payment, checks the payment switch, and applies deterministic refund policy. It then **executes** refunds (sandboxed), **verifies** them in the ledger, updates the ticket, and replies to the customer. Anything over the auto-refund limit, suspicious, ambiguous or failing goes to a **human queue**. Every decision and tool call is audited, and outcomes are measured.

- Setup and demo: [runthrough.md](runthrough.md)
- Plan, architecture, metrics and test results: [steps.md](steps.md)
- Rules for coding agents: [agents.md](agents.md)
- Dependencies: [requirements.md](requirements.md)

Quick start (after installing, see runthrough.md). Start the backend:

```bash
cd backend && .venv/bin/uvicorn app.api:app --port 8000
```

Then the frontend:

```bash
cd frontend && npm run dev
```

Open http://localhost:5173.

All data is synthetic. Payment rails are sandboxed, and no money moves.
