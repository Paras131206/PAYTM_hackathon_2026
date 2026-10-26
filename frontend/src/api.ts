import type {
  Customer, Engine, Handoff, Health, MarketingAnalysis, MarketingOverview, Metrics,
  RunDetail, SalesAnalysis, SalesOverview, SystemInfo, TicketDetail, TicketListItem,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "Cannot reach the backend. Is it running on port 8000?");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  health: () => request<Health>("/api/health"),
  system: () => request<SystemInfo>("/api/system"),
  metrics: () => request<Metrics>("/api/metrics"),
  customers: () => request<Customer[]>("/api/customers"),
  tickets: () => request<TicketListItem[]>("/api/tickets"),
  ticket: (id: string) => request<TicketDetail>(`/api/tickets/${encodeURIComponent(id)}`),
  run: (id: number) => request<RunDetail>(`/api/runs/${id}`),
  startRun: (ticketId: string, engine?: Engine) =>
    post<{ run_id: number; engine: string }>(`/api/tickets/${encodeURIComponent(ticketId)}/runs`, engine ? { engine } : {}),
  sendMessage: (ticketId: string, body: string, engine?: Engine) =>
    post<{ run_id: number | null; note: string | null }>(`/api/tickets/${encodeURIComponent(ticketId)}/messages`, { body, engine }),
  createTicket: (customer_id: string, subject: string, body: string) =>
    post<{ ticket_id: string; run_id: number | null }>("/api/tickets", { customer_id, subject, body }),
  handoffs: (status?: string) => request<Handoff[]>(`/api/handoffs${status ? `?status=${status}` : ""}`),
  decide: (id: number, decision: string, reviewer: string, note: string) =>
    post<Record<string, unknown>>(`/api/handoffs/${id}/decision`, { decision, reviewer, note }),
  setFault: (adapter: string, target: string, mode: "outage" | "timeout" | null) =>
    post<SystemInfo["faults"]>("/api/sandbox/faults", { adapter, target, mode }),
  reset: () => post<{ status: string }>("/api/demo/reset", {}),
  merchants: () => request<string[]>("/api/merchants"),
  salesOverview: (merchant?: string) =>
    request<SalesOverview>(`/api/sales/overview${merchant ? `?merchant=${encodeURIComponent(merchant)}` : ""}`),
  analyzeSales: (merchant: string, prompt: string) =>
    post<SalesAnalysis>("/api/sales/analyze", { merchant, prompt }),
  marketingOverview: (merchant?: string) =>
    request<MarketingOverview>(`/api/marketing/overview${merchant ? `?merchant=${encodeURIComponent(merchant)}` : ""}`),
  analyzeMarketing: (merchant: string, prompt: string) =>
    post<MarketingAnalysis>("/api/marketing/analyze", { merchant, prompt }),
};

