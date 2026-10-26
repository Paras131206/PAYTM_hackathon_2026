import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import {
  IconCases,
  IconExecution,
  IconHome,
  IconMarketing,
  IconQueue,
  IconRefresh,
  IconSales,
  IconSparkles,
  RobotMascot,
} from "./components/PaytmIcons";
import { Cases } from "./pages/Cases";
import { Execution } from "./pages/Execution";
import { Landing } from "./pages/Landing";
import { Marketing } from "./pages/Marketing";
import { Overview } from "./pages/Overview";
import { Queue } from "./pages/Queue";
import { Sales } from "./pages/Sales";

import type { Health } from "./types";

function useHashRoute(): [string, string | null, string | null] {
  const read = (): [string, string | null, string | null] => {
    const parts = (location.hash.replace(/^#\/?/, "") || "landing").split("/");
    return [parts[0] || "landing", parts[1] || null, parts[2] || null];
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export default function App() {

  const [page, param, param2] = useHashRoute();

  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [version, setVersion] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [resetCount, setResetCount] = useState(0);

  // Theme & View mode preferences
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("paytm_theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "dark"; // Default to sleek dark like Image 1
  });

  const [deviceFrame, setDeviceFrame] = useState<boolean>(() => {
    return localStorage.getItem("paytm_device_frame") === "true";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("paytm_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("paytm_device_frame", String(deviceFrame));
  }, [deviceFrame]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    api.handoffs("pending").then((h) => setPending(h.length)).catch(() => undefined);
  }, []);

  useEffect(() => {
    api.health().then((h) => { setHealth(h); setHealthError(null); }).catch((e) => setHealthError(e.message));
    refresh();
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
    { id: "landing", label: "Home", icon: IconHome },
    { id: "overview", label: "Overview", icon: IconSparkles },
    { id: "cases", label: "Cases", icon: IconCases },
    { id: "sales", label: "Sales", icon: IconSales },
    { id: "marketing", label: "Marketing", icon: IconMarketing },
    { id: "queue", label: "Human queue", icon: IconQueue, count: pending },
    { id: "execution", label: "Agent execution", icon: IconExecution },
  ];

  if (page === "landing" && !deviceFrame) {
    return (
      <Landing
        onProceed={() => {
          location.hash = "#/overview";
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
        health={health}
      />
    );
  }

  const appContent = (

    <div className={`shell ${deviceFrame ? "in-device" : ""}`}>
      {/* Desktop Sidebar Navigation */}
      <nav className="nav desktop-nav" aria-label="Main">
        <a href="#/landing" className="brand resolv-brand-header" style={{ textDecoration: "none" }} title="Return to Landing Page">
          <div className="brand-mark-box" aria-hidden>R</div>
          <div className="brand-titles">
            <strong className="brand-app-name">Resolv</strong>
            <small className="brand-app-sub">AI Support Teammate</small>
          </div>
        </a>

        {/* AI Assistant Mascot mini badge */}
        <div className="assistant-card">
          <div className="assistant-avatar-wrap">
            <RobotMascot size={36} />
            <span className="live-dot" title="Resolv AI Teammate Active" />
          </div>
          <div className="assistant-info">
            <span className="assistant-name">Resolv AI</span>
            <span className="assistant-role">UPI Support Teammate</span>
          </div>
        </div>

        <div className="nav-group">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = page === n.id;
            return (
              <a
                key={n.id}
                href={`#/${n.id}`}
                className={`nav-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-icon"><Icon /></span>
                <span className="nav-label">{n.label}</span>
                {n.count ? <span className="count-pill">{n.count}</span> : null}
              </a>
            );
          })}
        </div>

      </nav>

      {/* Main Content Area */}
      <div className="main">
        <header className="topbar">
          <a href="#/landing" className="mobile-brand-bar" style={{ textDecoration: "none" }} title="Return to Landing Page">
            <span className="brand-mark-box sm" aria-hidden>R</span>
            <strong className="brand-app-name">Resolv</strong>
          </a>

          {healthError && (
            <span className="small text-bad" style={{ color: "var(--bad)", fontWeight: 600 }}>
              Backend offline: {healthError}
            </span>
          )}

          <span className="spacer" />


          <div className="topbar-actions">
            {/* Landing page link */}
            <a
              href="#/landing"
              className="view-toggle-btn"
              title="Return to Landing Page"
              style={{ textDecoration: "none" }}
            >
              🪙 Landing
            </a>

            {/* View mode toggle */}
            <button
              className="view-toggle-btn"
              onClick={() => setDeviceFrame((df) => !df)}
              title={deviceFrame ? "Switch to Full Desktop view" : "Switch to Mobile Phone Prototype view"}
              aria-label="Toggle device frame preview"
            >
              {deviceFrame ? "💻 Full View" : "📱 Phone View"}
            </button>

            {/* Theme toggle */}
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light (Paytm App)" : "Dark (StudyGenie/Dark)"} theme`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>

            {/* Reset button */}
            <button
              className="btn sm reset-btn"
              onClick={reset}
              disabled={resetting}
              title="Reset all demo data"
            >
              <IconRefresh className={resetting ? "spinning" : ""} />
              <span>{resetting ? "Resetting…" : "Reset"}</span>
            </button>
          </div>
        </header>

        <main className="content-scroll" key={resetCount}>
          {page === "landing" && (
            <Landing
              onProceed={() => {
                location.hash = "#/overview";
              }}
              theme={theme}
              onToggleTheme={toggleTheme}
              health={health}
            />
          )}
          {page === "overview" && <Overview version={version} />}
          {page === "cases" && <Cases ticketId={param ?? null} health={health} onChange={refresh} />}
          {page === "sales" && <Sales />}
          {page === "marketing" && <Marketing />}
          {page === "queue" && <Queue onChange={refresh} />}
          {page === "execution" && (
            <Execution
              ticketId={param ?? null}
              runIdParam={param2 ?? null}
              health={health}
              onChange={refresh}
            />
          )}
        </main>



        {/* Mobile / Prototype Bottom Navigation Bar */}
        <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = page === n.id;
            return (
              <a
                key={n.id}
                href={`#/${n.id}`}
                className={`mobile-nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <div className="mobile-icon-wrap">
                  <Icon />
                  {n.count ? <span className="mobile-count-badge">{n.count}</span> : null}
                </div>
                <span className="mobile-nav-label">{n.label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </div>
  );

  if (deviceFrame) {
    return (
      <div className="device-preview-wrapper">
        <div className="device-controls-bar">
          <div className="preview-label">
            <strong>Resolv</strong> · Mobile Prototype View
          </div>
          <button className="btn sm primary" onClick={() => setDeviceFrame(false)}>
            Exit Phone View (Expand Full Screen)
          </button>
        </div>
        <div className="phone-mockup">
          <div className="phone-screen-header">
            <span className="phone-time">8:30</span>
            <div className="phone-island" />
            <div className="phone-icons">
              <span className="network-bars">●●●●</span>
              <span className="battery-icon">99%</span>
            </div>
          </div>
          <div className="phone-inner-content">
            {appContent}
          </div>
        </div>
      </div>
    );
  }

  return appContent;
}
