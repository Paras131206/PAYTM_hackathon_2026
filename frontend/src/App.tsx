import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Badge, EngineBadge } from "./components/ui";
import { Cases } from "./pages/Cases";
import { Overview } from "./pages/Overview";
import { Queue } from "./pages/Queue";
import { System } from "./pages/System";
import type { Health } from "./types";

function useHashRoute(): string[] {
  const read = () => (location.hash.replace(/^#\/?/, "") || "cases").split("/");
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export default function App() {
  const [page, param] = useHashRoute();
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [version, setVersion] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [resetCount, setResetCount] = useState(0); // remounts pages after a demo reset

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    api.handoffs("pending").then((h) => setPending(h.length)).catch(() => undefined);
  }, []);

  useEffect(() => {
    api.health().then((h) => { setHealth(h); setHealthError(null); }).catch((e) => setHealthError(e.message));
    refresh();
    // Keep the human-queue count current while runs finish in the background.
    const id = window.setInterval(() => {
      api.handoffs("pending").then((h) => setPending(h.length)).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const reset = async () => {
    if (!confirm("Reset all demo data? Runs, refunds and approvals since the last reset will be deleted.")) return;
    setResetting(true);
    try {
      await api.reset();
      location.hash = "#/cases";
      setResetCount((n) => n + 1);
      refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setResetting(false);
    }
  };

  const nav = [
    { id: "overview", label: "Overview" },
    { id: "cases", label: "Cases" },
    { id: "queue", label: "Human queue", count: pending },
    { id: "system", label: "System" },
  ];

  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <div className="brand">
          <div className="brand-mark" aria-hidden>R</div>
          <div><strong>Resolv</strong><small>AI support teammate</small></div>
        </div>
        {nav.map((n) => (
          <a key={n.id} href={`#/${n.id}`} className={page === n.id ? "active" : ""} aria-current={page === n.id ? "page" : undefined}>
            {n.label}
            {n.count ? <span className="count">{n.count}</span> : null}
          </a>
        ))}
        <div className="nav-foot">
          <span>Prototype. Synthetic data. Payment rails are sandboxed.</span>
        </div>
      </nav>
      <div className="main">
        <header className="topbar">
          {health ? <EngineBadge engine={health.engine} model={health.model} /> : null}
          <Badge tone="warn" title="Customers, transactions and tickets are generated demo data">synthetic data</Badge>
          {healthError && <Badge tone="bad">backend unreachable: {healthError}</Badge>}
          <span className="spacer" />
          <button className="btn sm" onClick={reset} disabled={resetting}>{resetting ? "Resetting…" : "Reset demo"}</button>
        </header>
        <main key={resetCount}>
          {page === "overview" && <Overview version={version} />}
          {page === "cases" && <Cases ticketId={param ?? null} health={health} onChange={refresh} />}
          {page === "queue" && <Queue onChange={refresh} />}
          {page === "system" && <System onChange={refresh} />}
        </main>
      </div>
    </div>
  );
}
