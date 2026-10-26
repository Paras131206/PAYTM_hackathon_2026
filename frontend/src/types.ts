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

export interface RecommendationItem {
  title: string;
  channel?: string;
  action: string;
  rationale: string;
  expected_impact: string;
  effort: string;
  timeline: string;
}

export interface AgentTraceStep {
  step: string;
  detail: string;
}

export interface SalesCategory {
  category: string;
  orders: number;
  gross_sales_paise: number;
  share_pct: number;
}

export interface SalesChannel {
  channel: string;
  orders: number;
  gross_sales_paise: number;
  failed_orders: number;
}

export interface SalesDaily {
  date: string;
  orders: number;
  gross_sales_paise: number;
  failed_orders: number;
}

export interface SalesOverview {
  merchant: string;
  total_orders: number;
  gross_sales_paise: number;
  net_sales_paise: number;
  avg_order_value_paise: number;
  failed_orders: number;
  refunded_amount_paise: number;
  payment_success_rate_pct: number;
  categories: SalesCategory[];
  channels: SalesChannel[];
  daily_trend: SalesDaily[];
  recent_transactions: Transaction[];
}

export interface SalesAnalysis {
  report_title: string;
  executive_summary: string;
  prompt: string;
  merchant: string;
  key_metrics: {
    gross_sales_rs: number;
    total_orders: number;
    avg_order_value_rs: number;
    success_rate_pct: number;
    failed_orders: number;
    refunded_amount_rs: number;
  };
  findings: string[];
  recommendations: RecommendationItem[];
  agent_trace: AgentTraceStep[];
  engine: string;
  timestamp: string;
}

export interface MarketingCampaign {
  id: string;
  merchant: string;
  channel: string;
  campaign_name: string;
  spend_paise: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue_generated_paise: number;
  target_audience: string;
  status: string;
  roas: number;
  cac_paise: number;
  ctr_pct: number;
  cvr_pct: number;
  efficiency: "exceptional" | "good" | "moderate" | "underperforming";
}

export interface BudgetShift {
  from_channel: string;
  to_channel: string;
  amount_rs: number;
  reason: string;
}

export interface BudgetSimulation {
  current_spend_rs: number;
  current_revenue_rs: number;
  current_roas: number;
  projected_revenue_rs: number;
  projected_roas: number;
  revenue_growth_pct: number;
  shifts: BudgetShift[];
}

export interface MarketingOverview {
  merchant: string;
  total_spend_paise: number;
  total_revenue_paise: number;
  total_conversions: number;
  total_impressions: number;
  total_clicks: number;
  blended_roas: number;
  average_cac_paise: number;
  campaigns: MarketingCampaign[];
}

export interface MarketingAnalysis {
  report_title: string;
  executive_summary: string;
  prompt: string;
  merchant: string;
  key_metrics: {
    total_spend_rs: number;
    total_revenue_rs: number;
    blended_roas: number;
    avg_cac_rs: number;
    total_conversions: number;
  };
  campaigns: MarketingCampaign[];
  budget_reallocation_simulation: BudgetSimulation;
  findings: string[];
  recommendations: RecommendationItem[];
  agent_trace: AgentTraceStep[];
  engine: string;
  timestamp: string;
}

