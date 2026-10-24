// Mirrors the FastAPI response shapes in backend/app/api.py.

export type Engine = "llm" | "rules";

export type TicketStatus =
  | "open" | "in_progress" | "awaiting_customer" | "waiting_on_bank"
  | "pending_approval" | "escalated" | "resolved" | "closed";

export interface Ticket {
  id: string;
  customer_id: string;
  subject: string;
  channel: string;
  status: TicketStatus;
  priority: string;
  scenario: string | null;
  resolution_code: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface TicketListItem extends Ticket {
  customer_name: string;
  last_outcome: string | null;
  last_run_status: string | null;
  first_message: string;
}

export interface Customer {
  id: string;
  name: string;
  phone_masked: string;
  kyc_level: string;
  tier: string;
  language: string;
}

export interface Transaction {
  id: string;
  merchant: string;
  amount_paise: number;
  method: string;
  debit_status: string;
  app_status: string;
  switch_status: string;
  reversed: number;
  reversal_ref: string | null;
  created_at: string;
}

export interface Refund {
  id: string;
  txn_id: string;
  ticket_id: string;
  amount_paise: number;
  reason: string;
  status: string;
  created_by: string;
  created_at: string;
}

export interface Message {
  id: number;
  role: "customer" | "agent" | "human" | "system";
  author: string;
  body: string;
  created_at: string;
}

export interface Run {
  id: number;
  ticket_id: string;
  engine: Engine | "human";
  model: string | null;
  status: "queued" | "running" | "finished" | "failed";
  outcome: string | null;
  turns: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface Handoff {
  id: number;
  kind: "approval" | "escalation";
  ticket_id: string;
  run_id: number | null;
  action: string | null;
  args: Record<string, unknown> | null;
  amount_paise: number | null;
  reason_code: string;
  summary: string;
  evidence: Record<string, unknown>;
  status: string;
  decided_by: string | null;
  decision_note: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  decided_at: string | null;
  subject?: string;
  customer_name?: string;
  ticket_status?: string;
}

export interface TicketDetail {
  ticket: Ticket;
  customer: Customer;
  transactions: Transaction[];
  refunds: Refund[];
  prior_tickets: { id: string; subject: string; status: string; created_at: string }[];
  messages: Message[];
  runs: Run[];
  handoffs: Handoff[];
}

export interface RunEvent {
  seq: number;
  kind: string;
  payload: Record<string, any>;
  created_at: string;
}

export interface RunDetail {
  run: Run;
  events: RunEvent[];
}

export interface Rate {
  numerator: number;
  denominator: number;
  value: number | null;
}

export interface Metrics {
  label: string;
  cases_processed: number;
  agent_runs: number;
  autonomous_resolution_rate: Rate;
  resolution_rate_incl_human: Rate;
  escalation_rate: Rate;
  verified_refund_rate: Rate;
  successful_write_actions: number;
  blocked_actions: { total: number; by_code: Record<string, number> };
  policy_deferrals: number;
  tool_failures: number;
  tool_retries: number;
  median_run_seconds: number | null;
  approvals: Record<string, number>;
  escalations: Record<string, number>;
  scenario_check: Rate & {
    rows: {
      ticket_id: string;
      scenario: string;
      processed: boolean;
      status: string | null;
      expected: string[];
      refund_expected: boolean | null;
      refund_present: boolean;
      match: boolean | null;
    }[];
  };
}

export interface Health {
  status: string;
  engine: Engine;
  engine_setting: string;
  llm_configured: boolean;
  model: string | null;
}

export interface SystemInfo {
  engine: string;
  engine_setting: string;
  llm_configured: boolean;
  model: string;
  providers: { name: string; model: string; configured: boolean; order: number }[];
  auto_refund_limit_rupees: number;
  max_agent_turns: number;
  tool_max_attempts: number;
  integrations: { name: string; mode: string; detail: string }[];
  tools: { name: string; permission: string; integration: string; description: string }[];
  faults: { adapter: string; target: string; mode: string }[];
}
