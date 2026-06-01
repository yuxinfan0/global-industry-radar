import { themes } from "./ontology";
import { buildEvidence, synthesizePrimaryAngle, synthesizeThesis } from "./rag";
import { clamp, isoDateOrToday, round, seededUnit } from "./deterministic";
import { readRadarFromSupabase, readSignalFromSupabase, upsertSignalCards } from "./storage";
import type { MomentumWindows, RadarResponse, ScoreBundle, SignalCard, Theme } from "./types";

const structuralThemeBoost: Record<string, number> = {
  "ai-memory-hbm": 18,
  "data-center-power": 16,
  "power-grid": 13,
  "advanced-packaging": 11,
  "nuclear-power": 9,
  "solar-pv": 8,
  "energy-storage": 7,
  "copper-electrification": 6,
  robotics: 5,
  "glp-1": 4,
  "defense-tech": 3,
  "shipping-logistics": 1
};

export async function getRadar(dateValue?: string | null, limit = 20): Promise<RadarResponse> {
  const date = isoDateOrToday(dateValue);
  const stored = await readRadarFromSupabase(date);
  if (stored) {
    return stored;
  }

  const cards = buildDemoCards(date)
    .sort((left, right) => right.scores.confidence - left.scores.confidence)
    .slice(0, limit)
    .map((card, index) => ({ ...card, rank: index + 1 }));

  return {
    date,
    generated_at: new Date().toISOString(),
    mode: "demo-seed",
    horizon: "6-24 months",
    cards
  };
}

export async function getSignal(signalId: string): Promise<SignalCard | null> {
  const stored = await readSignalFromSupabase(signalId);
  if (stored) {
    return stored;
  }

  const match = /^(.*)-(\d{4}-\d{2}-\d{2})$/.exec(signalId);
  if (!match) {
    return null;
  }

  const [, themeId, date] = match;
  return buildDemoCards(date).find((card) => card.theme_id === themeId) ?? null;
}

export async function generateAndPersistDailyRadar(dateValue?: string | null): Promise<RadarResponse> {
  const radar = await getRadar(dateValue, Number(process.env.MAX_AI_THEMES ?? 20));
  await upsertSignalCards(radar.cards);
  return radar;
}

function buildDemoCards(date: string): SignalCard[] {
  return themes.map((theme) => buildCard(theme, date));
}

function buildCard(theme: Theme, date: string): SignalCard {
  const seed = `${theme.id}:${date}`;
  const boost = structuralThemeBoost[theme.id] ?? 0;
  const randomA = seededUnit(`${seed}:a`);
  const randomB = seededUnit(`${seed}:b`);
  const randomC = seededUnit(`${seed}:c`);

  const windows: MomentumWindows = {
    d5: round(-2 + randomA * 9 + boost * 0.05),
    d20: round(1 + randomB * 18 + boost * 0.22),
    d60: round(2 + randomC * 28 + boost * 0.34),
    d120: round(3 + randomA * 34 + boost * 0.48)
  };

  const volumeExpansion = round(0.8 + randomB * 1.8 + boost / 70, 2);
  const breadth = round(clamp(38 + randomC * 42 + boost * 0.55), 0);
  const drawdownRepair = round(clamp(25 + randomA * 45 + boost * 0.6), 0);
  const diffusion = round(clamp(30 + randomB * 48 + boost * 0.5), 0);

  const evidence = buildEvidence(theme, date, randomA);
  const scores: ScoreBundle = {
    momentum_score: round(clamp(windows.d20 * 2.2 + windows.d60 * 1.25 + breadth * 0.22), 0),
    evidence_score: round(clamp(52 + evidence.length * 8 + randomC * 18), 0),
    primary_investability_score: round(clamp(45 + boost * 0.8 + theme.private_segments.length * 3 + randomB * 14), 0),
    risk_score: round(clamp(22 + theme.counter_indicators.length * 5 + (100 - breadth) * 0.18), 0),
    confidence: 0
  };
  scores.confidence = round(
    clamp(scores.momentum_score * 0.34 + scores.evidence_score * 0.24 + scores.primary_investability_score * 0.28 - scores.risk_score * 0.12 + 18),
    0
  );

  return {
    id: `${theme.id}-${date}`,
    theme_id: theme.id,
    theme_name: theme.name,
    date,
    rank: 999,
    horizon: "6-24 months",
    scores,
    momentum_windows: windows,
    volume_expansion: volumeExpansion,
    breadth,
    drawdown_repair: drawdownRepair,
    diffusion,
    thesis: synthesizeThesis(theme, windows, scores),
    primary_market_angle: synthesizePrimaryAngle(theme, scores),
    risks: theme.counter_indicators.slice(0, 4),
    evidence_ids: evidence.map((item) => item.id),
    evidence,
    counter_indicators: theme.counter_indicators,
    instruments: theme.instruments,
    mode: "demo-seed"
  };
}
