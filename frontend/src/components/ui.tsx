import type { ReactNode } from "react";

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "accent";

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span className={`badge ${tone}`} title={title}>{children}</span>;
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
  running: "info",
  queued: "info",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge>—</Badge>;
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}

export function EngineBadge({ engine, model }: { engine: string; model?: string | null }) {
  if (engine === "llm") return <Badge tone="accent" title="LLM planner. Providers are tried in order; a quota or outage moves to the next one.">LLM · {model ?? "no provider"}</Badge>;
  if (engine === "human") return <Badge tone="ok">Human · {model}</Badge>;
  return <Badge tone="neutral" title="Deterministic keyword planner. No LLM is called.">Rules engine (no LLM)</Badge>;
}

export function SandboxBadge() {
  return <Badge tone="warn" title="Simulated against local SQLite. No real bank, switch or money movement.">SANDBOX</Badge>;
}

export const rupees = (paise: number) =>
  `Rs ${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function when(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
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
