export type FeedbackLabel = "useful" | "wrong" | "watch" | "investable" | "ignore";

export interface Instrument {
  symbol: string;
  name: string;
  market: string;
  role: string;
}

export interface Theme {
  id: string;
  name: string;
  aliases: string[];
  keywords: string[];
  instruments: Instrument[];
  supply_chain: string[];
  core_variables: string[];
  private_segments: string[];
  counter_indicators: string[];
}

export interface EvidenceItem {
  id: string;
  source: "stooq" | "alpha_vantage" | "gdelt" | "sec" | "fred" | "eia" | "world_bank" | "uspto" | "arxiv" | "manual";
  title: string;
  url: string;
  published_at: string;
  theme_id: string;
  extracted_claims: string[];
  relevance_score: number;
}

export interface ScoreBundle {
  momentum_score: number;
  evidence_score: number;
  primary_investability_score: number;
  risk_score: number;
  confidence: number;
}

export interface MomentumWindows {
  d5: number;
  d20: number;
  d60: number;
  d120: number;
}

export interface SignalCard {
  id: string;
  theme_id: string;
  theme_name: string;
  date: string;
  rank: number;
  horizon: "6-24 months";
  scores: ScoreBundle;
  momentum_windows: MomentumWindows;
  volume_expansion: number;
  breadth: number;
  drawdown_repair: number;
  diffusion: number;
  thesis: string;
  primary_market_angle: string;
  risks: string[];
  evidence_ids: string[];
  evidence: EvidenceItem[];
  counter_indicators: string[];
  instruments: Instrument[];
  mode: "demo-seed" | "supabase" | "postgres" | "etl";
}

export interface RadarResponse {
  date: string;
  generated_at: string;
  mode: SignalCard["mode"];
  horizon: SignalCard["horizon"];
  cards: SignalCard[];
}

export interface EvalResult {
  signal_id: string;
  forward_return_30d: number | null;
  forward_return_90d: number | null;
  forward_return_180d: number | null;
  evidence_confirmed: boolean | null;
  human_label: FeedbackLabel | null;
}

export interface FeedbackPayload {
  signal_id: string;
  label: FeedbackLabel;
  note?: string;
}
