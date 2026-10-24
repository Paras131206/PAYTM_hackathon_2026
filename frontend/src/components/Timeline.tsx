import type { RunEvent } from "../types";
import { Badge, Json, SandboxBadge } from "./ui";

type Item =
  | { type: "event"; ev: RunEvent }
  | { type: "tool"; call: RunEvent; inner: RunEvent[]; result?: RunEvent };

function group(events: RunEvent[]): Item[] {
  const out: Item[] = [];
  let open: Extract<Item, { type: "tool" }> | null = null;
  for (const ev of events) {
    if (ev.kind === "tool_call") {
      open = { type: "tool", call: ev, inner: [] };
      out.push(open);
    } else if (ev.kind === "tool_result" && open) {
      open.result = ev;
      open = null;
    } else if (open) {
      open.inner.push(ev);
    } else {
      out.push({ type: "event", ev });
    }
  }
  return out;
}

const RESULT_TONE: Record<string, string> = {
  ok: "ok", already_done: "ok", approval_required: "warn", blocked: "bad", error: "bad",
  invalid_args: "bad", not_found: "warn",
};

function Checks({ checks }: { checks: { name: string; passed: boolean; detail: string }[] }) {
  return (
    <ul className="checks">
      {checks.map((c) => (
        <li key={c.name}>
          <span className={c.passed ? "y" : "n"} aria-label={c.passed ? "passed" : "failed"}>{c.passed ? "✓" : "✕"}</span>
          <span><code>{c.name}</code> — {c.detail}</span>
        </li>
      ))}
    </ul>
  );
}

function Inner({ ev }: { ev: RunEvent }) {
  const p = ev.payload;
  if (ev.kind === "policy_check") {
    const tone = p.decision === "auto_refund" ? "ok" : p.decision === "needs_approval" || p.decision === "wait" ? "warn" : "bad";
    return (
      <div style={{ marginTop: 6 }}>
        <div className="row small">
          <Badge tone={tone as any}>policy: {String(p.decision).replace(/_/g, " ")}</Badge>
          <span className="muted">{p.policy_id}</span>
        </div>
        <div className="b small">{p.explanation}</div>
        <Checks checks={p.checks} />
      </div>
    );
  }
  if (ev.kind === "verification") {
    return (
      <div className="row small" style={{ marginTop: 6 }}>
        <Badge tone={p.confirmed ? "ok" : "bad"}>{p.confirmed ? "verified in ledger" : "NOT verified"}</Badge>
        <span className="muted">ledger={p.ledger_status} · txn reversed={String(p.txn_reversed)}</span>
      </div>
    );
  }
  if (ev.kind === "tool_retry") {
    return <div className="small" style={{ color: "var(--warn)", marginTop: 4 }}>Attempt {p.attempt} failed: {p.error}</div>;
  }
  if (ev.kind === "assessment") {
    return (
      <div className="small" style={{ marginTop: 6 }}>
        <div className="row">
          <Badge tone="info">intent: {p.intent}</Badge>
          {p.target_txn_id ? <Badge>target {p.target_txn_id}</Badge> : <Badge tone="warn">no target yet</Badge>}
          <Badge>confidence {p.confidence}</Badge>
          {p.needs_clarification && <Badge tone="accent">needs clarification</Badge>}
          {p.injection_suspected && <Badge tone="bad">manipulation suspected</Badge>}
        </div>
        <div className="b">{p.rationale}</div>
      </div>
    );
  }
  return null;
}

function title(ev: RunEvent): { t: string; tone: string; body?: string } {
  const p = ev.payload;
  switch (ev.kind) {
    case "context":
      return { t: "Loaded customer context", tone: "info",
        body: `${p.customer?.name} · ${p.transactions} recent transactions · ${p.prior_tickets} prior tickets · ${p.messages} messages · ${p.refunds_last_30_days} refunds in 30 days` };
    case "guard":
      return { t: p.check === "prompt_injection" ? "Guard: manipulation pattern detected" : `Guard: ${p.check}`, tone: "bad", body: p.detail };
    case "planner_note":
      return { t: "Planner note", tone: "neutral", body: p.text };
    case "error":
      return { t: `Error (${p.source}): ${p.code}`, tone: "bad", body: `${p.message}${p.note ? ` — ${p.note}` : ""}` };
    case "llm_failover":
      return { t: `Switched LLM: ${p.from} → ${p.to}`, tone: "warn", body: `${p.code}: ${p.message}` };
    case "human_decision":
      return { t: `Human decision: ${p.decision}`, tone: "ok", body: p.note || undefined };
    case "ticket_update":
      return { t: `Ticket set to ${p.status}`, tone: "info" };
    case "outcome":
      return { t: `Outcome: ${String(p.outcome).replace(/_/g, " ")}`, tone: p.outcome === "resolved" ? "ok" : p.outcome === "escalated" || p.outcome === "failed" ? "bad" : "warn",
        body: p.duration_s !== undefined ? `Run time ${p.duration_s}s · verified refunds: ${(p.verified_refunds ?? []).join(", ") || "none"}` : undefined };
    default:
      return { t: ev.kind, tone: "neutral" };
  }
}

export function Timeline({ events }: { events: RunEvent[] }) {
  if (!events.length) return <div className="empty">No events yet.</div>;
  return (
    <ol className="timeline">
      {group(events).map((item) => {
        if (item.type === "event") {
          const { t, tone, body } = title(item.ev);
          return (
            <li key={item.ev.seq} className={`tl ${tone}`}>
              <span className="mark" />
              <div className="t">{t}</div>
              {body && <div className="b">{body}</div>}
            </li>
          );
        }
        const p = item.call.payload;
        const r = item.result?.payload;
        const tone = r ? RESULT_TONE[r.status] ?? "neutral" : "info";
        return (
          <li key={item.call.seq} className={`tl ${tone}`}>
            <span className="mark" />
            <div className="t">
              <code>{p.tool}</code>
              {p.permission === "write" && <Badge tone="accent">write</Badge>}
              {p.integration === "sandbox" && <SandboxBadge />}
              {r ? <Badge tone={tone as any}>{String(r.status).replace(/_/g, " ")}</Badge> : <span className="spinner" />}
              {r && r.attempts > 1 && <Badge tone="warn">{r.attempts} attempts</Badge>}
              {p.actor && p.actor !== "agent" && <Badge tone="ok">{p.actor}</Badge>}
            </div>
            <div className="b small mono">{argsLine(p.args)}</div>
            {item.inner.map((ev) => <Inner key={ev.seq} ev={ev} />)}
            {r?.message && <div className="b small">{r.message}</div>}
            {r && <Json value={{ args: p.args, result: { status: r.status, data: r.data }, idempotency_key: r.idempotency_key }} label="Inputs and result" />}
          </li>
        );
      })}
    </ol>
  );
}

function argsLine(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  return Object.entries(args as Record<string, unknown>)
    .filter(([k]) => k !== "rationale" && k !== "message" && k !== "summary" && k !== "note")
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("  ");
}
