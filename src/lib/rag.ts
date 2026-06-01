import type { EvidenceItem, MomentumWindows, ScoreBundle, Theme } from "./types";

const sourceForTheme: Record<string, EvidenceItem["source"][]> = {
  "ai-memory-hbm": ["gdelt", "sec", "arxiv", "stooq"],
  "advanced-packaging": ["gdelt", "sec", "uspto", "stooq"],
  "solar-pv": ["eia", "world_bank", "gdelt", "stooq"],
  "energy-storage": ["eia", "gdelt", "sec", "stooq"],
  "power-grid": ["eia", "sec", "gdelt", "stooq"],
  "copper-electrification": ["fred", "gdelt", "stooq", "sec"],
  robotics: ["uspto", "arxiv", "gdelt", "stooq"],
  "nuclear-power": ["eia", "gdelt", "sec", "stooq"],
  "glp-1": ["sec", "gdelt", "arxiv", "stooq"],
  "defense-tech": ["sec", "gdelt", "uspto", "stooq"],
  "shipping-logistics": ["gdelt", "sec", "stooq", "fred"],
  "data-center-power": ["eia", "sec", "gdelt", "stooq"]
};

const sourceLabels: Record<EvidenceItem["source"], string> = {
  stooq: "Stooq market proxy",
  alpha_vantage: "Alpha Vantage market proxy",
  gdelt: "GDELT news/GKG",
  sec: "SEC EDGAR filings",
  fred: "FRED macro series",
  eia: "EIA energy data",
  world_bank: "World Bank indicators",
  uspto: "USPTO PatentsView",
  arxiv: "arXiv research feed",
  manual: "Analyst note"
};

export function buildEvidence(theme: Theme, date: string, seedOffset: number): EvidenceItem[] {
  const sources = sourceForTheme[theme.id] ?? ["gdelt", "stooq", "sec"];

  return sources.slice(0, 4).map((source, index) => {
    const variable = theme.core_variables[index % theme.core_variables.length];
    const segment = theme.private_segments[index % theme.private_segments.length];
    const keyword = theme.keywords[index % theme.keywords.length];
    const day = String(Math.max(1, Number(date.slice(8, 10)) - index)).padStart(2, "0");
    const publishedAt = `${date.slice(0, 8)}${day}T08:00:00.000Z`;

    return {
      id: `${theme.id}-${source}-${date}-${index}`,
      source,
      title: `${sourceLabels[source]}: ${keyword} signal for ${theme.name}`,
      url: buildSourceUrl(source, keyword),
      published_at: publishedAt,
      theme_id: theme.id,
      extracted_claims: [
        `${variable} is the gating variable to monitor before treating market momentum as durable.`,
        `${segment} is a plausible private-market wedge if evidence persists across sources.`,
        `This item is a retrieval anchor; production runs replace it with live extracted claims.`
      ],
      relevance_score: Math.min(0.98, 0.72 + index * 0.05 + seedOffset * 0.02)
    };
  });
}

export function synthesizeThesis(theme: Theme, windows: MomentumWindows, scores: ScoreBundle): string {
  const leadVariable = theme.core_variables[0];
  const secondVariable = theme.core_variables[1] ?? theme.core_variables[0];
  const supplyNode = theme.supply_chain.slice(0, 3).join(" / ");
  const direction = windows.d60 >= 0 ? "market breadth is confirming the theme" : "the theme is still in early repair mode";

  return `${theme.name} is flagged because ${direction}: 20d momentum is ${windows.d20}% and 60d momentum is ${windows.d60}%. The RAG chain should test whether ${leadVariable} and ${secondVariable} are turning into multi-quarter demand rather than a single headline. The private-market watch zone is around ${supplyNode}, where bottlenecks can compound over a 6-24 month horizon. Confidence is ${scores.confidence}/100 because evidence is cross-source but still needs human labeling.`;
}

export function synthesizePrimaryAngle(theme: Theme, scores: ScoreBundle): string {
  const segments = theme.private_segments.slice(0, 3).join(", ");
  const variable = theme.core_variables[0];
  return `Map the signal to private companies in ${segments}. Prioritize teams with measurable exposure to ${variable}, customer proof in the theme's supply chain, and a path to benefit even if public-market beta fades. Current investability score: ${scores.primary_investability_score}/100.`;
}

function buildSourceUrl(source: EvidenceItem["source"], keyword: string): string {
  const encoded = encodeURIComponent(keyword);
  switch (source) {
    case "gdelt":
      return `https://api.gdeltproject.org/api/v2/doc/doc?query=${encoded}&mode=artlist&format=json`;
    case "sec":
      return "https://www.sec.gov/edgar/search/";
    case "fred":
      return "https://fred.stlouisfed.org/";
    case "eia":
      return "https://www.eia.gov/opendata/";
    case "world_bank":
      return "https://data.worldbank.org/";
    case "uspto":
      return "https://patentsview.org/apis/purpose";
    case "arxiv":
      return `https://export.arxiv.org/api/query?search_query=all:${encoded}`;
    case "alpha_vantage":
      return "https://www.alphavantage.co/documentation/";
    case "stooq":
      return "https://stooq.com/db/h/";
    case "manual":
      return "https://example.com/manual-analyst-note";
  }
}
