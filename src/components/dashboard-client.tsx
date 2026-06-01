"use client";

import { Activity, BarChart3, Bell, CalendarDays, CheckCircle2, Database, ExternalLink, FileSearch, FlaskConical, Gauge, LineChart, RefreshCw, Search, ShieldAlert, TrendingUp, Waves } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { FeedbackLabel, RadarResponse, SignalCard } from "@/lib/types";

const feedbackLabels: Array<{ label: FeedbackLabel; text: string }> = [
  { label: "useful", text: "有用" },
  { label: "watch", text: "观察" },
  { label: "investable", text: "可投" },
  { label: "wrong", text: "错因果" },
  { label: "ignore", text: "忽略" }
];

export function DashboardClient({ initialRadar }: { initialRadar: RadarResponse }) {
  const [radar, setRadar] = useState(initialRadar);
  const [selectedId, setSelectedId] = useState(initialRadar.cards[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Ready");

  const filteredCards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return radar.cards;
    }
    return radar.cards.filter((card) => {
      const haystack = `${card.theme_name} ${card.thesis} ${card.primary_market_angle} ${card.instruments.map((item) => item.symbol).join(" ")}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query, radar.cards]);

  const selected = filteredCards.find((card) => card.id === selectedId) ?? filteredCards[0] ?? radar.cards[0];

  async function refreshRadar() {
    setStatus("Refreshing");
    const response = await fetch(`/api/radar?date=${radar.date}`, { cache: "no-store" });
    const nextRadar = (await response.json()) as RadarResponse;
    setRadar(nextRadar);
    setSelectedId(nextRadar.cards[0]?.id ?? "");
    setStatus("Updated");
  }

  async function submitFeedback(label: FeedbackLabel) {
    if (!selected) {
      return;
    }
    setStatus(`Feedback: ${label}`);
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signal_id: selected.id, label })
    });
    const result = (await response.json()) as { persisted?: boolean };
    setStatus(result.persisted ? "Feedback persisted" : "Feedback captured locally");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Waves size={20} />
          </div>
          <div>
            <strong>产业雷达</strong>
            <span>Global Industry Radar</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary">
          <a className="nav-item active" href="#radar"><Activity size={17} />Radar</a>
          <a className="nav-item" href="#themes"><BarChart3 size={17} />Themes</a>
          <a className="nav-item" href="#evidence"><FileSearch size={17} />Evidence</a>
          <a className="nav-item" href="#harness"><FlaskConical size={17} />Harness</a>
        </nav>

        <div className="sidebar-block">
          <span className="block-label">Runtime</span>
          <div className="runtime-row"><Database size={15} />{radar.mode}</div>
          <div className="runtime-row"><CalendarDays size={15} />{radar.date}</div>
          <div className="runtime-row"><Gauge size={15} />6-24 months</div>
        </div>
      </aside>

      <section className="workspace" id="radar">
        <header className="topbar">
          <div>
            <h1>二级市场异动到一级投资假设</h1>
            <p>日频发现主题动量，绑定证据链，输出可投环节和反证指标。</p>
          </div>
          <div className="topbar-actions">
            <div className="search-box">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索主题、代码、因果链" />
            </div>
            <button className="icon-button" onClick={refreshRadar} aria-label="Refresh radar" title="Refresh radar">
              <RefreshCw size={17} />
            </button>
            <button className="icon-button" aria-label="Alerts" title="Alerts">
              <Bell size={17} />
            </button>
          </div>
        </header>

        <div className="kpi-strip">
          <MetricTile label="Signals" value={radar.cards.length.toString()} detail="Top themes" />
          <MetricTile label="Median confidence" value={`${median(radar.cards.map((card) => card.scores.confidence))}`} detail="score / 100" />
          <MetricTile label="Evidence coverage" value={`${median(radar.cards.map((card) => card.scores.evidence_score))}`} detail="cross-source" />
          <MetricTile label="Status" value={status} detail="API + harness" />
        </div>

        <div className="content-grid">
          <section className="signal-list" id="themes" aria-label="Theme ranking">
            <div className="section-heading">
              <div>
                <h2>Theme Ranking</h2>
                <span>{filteredCards.length} visible signals</span>
              </div>
              <span className="mode-pill">{radar.mode}</span>
            </div>

            <div className="ranking-table">
              <div className="ranking-head">
                <span>Rank</span>
                <span>Theme</span>
                <span>Momentum</span>
                <span>Evidence</span>
                <span>Confidence</span>
              </div>
              {filteredCards.map((card) => (
                <button
                  className={`ranking-row ${card.id === selected?.id ? "selected" : ""}`}
                  key={card.id}
                  onClick={() => setSelectedId(card.id)}
                >
                  <span className="rank-number">#{card.rank}</span>
                  <span className="theme-cell">
                    <strong>{card.theme_name}</strong>
                    <small>{card.instruments.slice(0, 3).map((item) => item.symbol).join(" / ")}</small>
                  </span>
                  <Sparkline values={[card.momentum_windows.d5, card.momentum_windows.d20, card.momentum_windows.d60, card.momentum_windows.d120]} />
                  <ScoreBar value={card.scores.evidence_score} tone="blue" />
                  <ScorePill value={card.scores.confidence} />
                </button>
              ))}
            </div>
          </section>

          {selected ? (
            <SignalDetail card={selected} onFeedback={submitFeedback} />
          ) : (
            <section className="detail-panel empty-state">No signal selected</section>
          )}
        </div>
      </section>
    </main>
  );
}

function SignalDetail({ card, onFeedback }: { card: SignalCard; onFeedback: (label: FeedbackLabel) => void }) {
  return (
    <section className="detail-panel">
      <div className="detail-header">
        <div>
          <span className="signal-id">{card.id}</span>
          <h2>{card.theme_name}</h2>
        </div>
        <ScorePill value={card.scores.confidence} />
      </div>

      <div className="score-grid">
        <MiniScore icon={<TrendingUp size={15} />} label="Momentum" value={card.scores.momentum_score} />
        <MiniScore icon={<FileSearch size={15} />} label="Evidence" value={card.scores.evidence_score} />
        <MiniScore icon={<CheckCircle2 size={15} />} label="Investability" value={card.scores.primary_investability_score} />
        <MiniScore icon={<ShieldAlert size={15} />} label="Risk" value={card.scores.risk_score} />
      </div>

      <div className="chart-panel">
        <div className="panel-title"><LineChart size={16} /> Momentum windows</div>
        <div className="window-bars">
          {Object.entries(card.momentum_windows).map(([window, value]) => (
            <div className="window-bar" key={window}>
              <span>{window.toUpperCase()}</span>
              <div><i style={{ width: `${Math.max(6, Math.min(100, value * 2.2))}%` }} /></div>
              <strong>{value}%</strong>
            </div>
          ))}
        </div>
      </div>

      <article className="thesis-block">
        <h3>RAG Thesis</h3>
        <p>{card.thesis}</p>
      </article>

      <article className="thesis-block">
        <h3>一级投资角度</h3>
        <p>{card.primary_market_angle}</p>
      </article>

      <div className="evidence-list" id="evidence">
        <h3>Evidence Trail</h3>
        {card.evidence.map((item) => (
          <a href={item.url} target="_blank" rel="noreferrer" className="evidence-item" key={item.id}>
            <span>{item.source}</span>
            <strong>{item.title}</strong>
            <small>{item.extracted_claims[0]}</small>
            <ExternalLink size={14} />
          </a>
        ))}
      </div>

      <div className="counter-list">
        <h3>反证指标</h3>
        <div>
          {card.counter_indicators.slice(0, 4).map((risk) => (
            <span key={risk}>{risk}</span>
          ))}
        </div>
      </div>

      <div className="feedback-bar" id="harness">
        {feedbackLabels.map((item) => (
          <button key={item.label} onClick={() => onFeedback(item.label)}>{item.text}</button>
        ))}
      </div>
    </section>
  );
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function MiniScore({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="mini-score">
      <span>{icon}{label}</span>
      <strong>{value}</strong>
      <ScoreBar value={value} tone={label === "Risk" ? "amber" : "teal"} />
    </div>
  );
}

function ScorePill({ value }: { value: number }) {
  return <span className={value > 78 ? "score-pill high" : value > 62 ? "score-pill medium" : "score-pill"}>{value}</span>;
}

function ScoreBar({ value, tone }: { value: number; tone: "teal" | "blue" | "amber" }) {
  return (
    <span className={`score-bar ${tone}`} aria-label={`Score ${value}`}>
      <i style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <span className="sparkline" aria-label="Momentum sparkline">
      {values.map((value, index) => (
        <i key={`${value}-${index}`} style={{ height: `${Math.max(14, (value / max) * 34)}px` }} />
      ))}
    </span>
  );
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}
