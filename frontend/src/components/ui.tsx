import type { ReactNode } from "react";

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "accent" | "paytm";

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`badge ${tone}`} title={title}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  resolved: "ok",
  closed: "neutral",
  open: "info",
  in_progress: "info",
  awaiting_customer: "accent",
  waiting_on_bank: "warn",
  pending_approval: "warn",
  escalated: "bad",
  pending: "warn",
  approved: "ok",
  rejected: "bad",
  info_requested: "accent",
  handled: "neutral",
  finished: "ok",
  failed: "bad",
  running: "paytm",
  queued: "info",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge>—</Badge>;
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <span className={`badge ${tone} status-pill`}>
      <span className="dot" aria-hidden="true" />
      <span>{status.replace(/_/g, " ")}</span>
    </span>
  );
}

export function EngineBadge({ engine, model }: { engine: string; model?: string | null }) {
  if (engine === "llm") {
    return (
      <span
        className="badge paytm engine-pill"
        title="LLM planner. Providers are tried in order; a quota or outage moves to the next one."
      >
        <span className="dot" />
        <span>LLM · {model ?? "waiting for first answer"}</span>
      </span>
    );
  }
  if (engine === "human") {
    return (
      <span className="badge ok engine-pill">
        <span className="dot" />
        <span>Human · {model}</span>
      </span>
    );
  }
  return (
    <span className="badge neutral engine-pill" title="Deterministic keyword planner. No LLM is called.">
      <span className="dot" />
      <span>Rules engine (no LLM)</span>
    </span>
  );
}

export function SandboxBadge() {
  return (
    <span className="badge warn sandbox-pill" title="Simulated against local SQLite. No real bank, switch or money movement.">
      SANDBOX
    </span>
  );
}

export const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function when(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function pct(v: number | null) {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

export function Json({ value, label = "Raw data" }: { value: unknown; label?: string }) {
  return (
    <details className="json">
      <summary>{label}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="banner bad" role="alert">{error}</div>;
}
