import type { FeedbackPayload, RadarResponse, SignalCard } from "./types";

interface SupabaseConfig {
  url: string;
  key: string;
}

type SignalRow = { signal_json: SignalCard | string };

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return { url: url.replace(/\/$/, ""), key };
}

async function supabaseFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${detail}`);
  }

  if (response.status === 204) {
    return null;
  }

  return (await response.json()) as T;
}

function getPostgresUrl(): string | null {
  return process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? null;
}

async function getSql() {
  const url = getPostgresUrl();
  if (!url) {
    return null;
  }

  const { neon } = await import("@neondatabase/serverless");
  return neon(url);
}

function normalizeSignal(row: SignalRow, mode: "postgres" | "supabase"): SignalCard {
  const signal = typeof row.signal_json === "string" ? (JSON.parse(row.signal_json) as SignalCard) : row.signal_json;
  return { ...signal, mode };
}

async function readRadarFromPostgres(date: string): Promise<RadarResponse | null> {
  const sql = await getSql();
  if (!sql) {
    return null;
  }

  const rows = (await sql`
    select signal_json
    from signal_cards
    where date = ${date}
    order by rank asc
    limit 20
  `) as SignalRow[];

  if (rows.length === 0) {
    return null;
  }

  return {
    date,
    generated_at: new Date().toISOString(),
    mode: "postgres",
    horizon: "6-24 months",
    cards: rows.map((row) => normalizeSignal(row, "postgres"))
  };
}

async function readSignalFromPostgres(signalId: string): Promise<SignalCard | null> {
  const sql = await getSql();
  if (!sql) {
    return null;
  }

  const rows = (await sql`
    select signal_json
    from signal_cards
    where id = ${signalId}
    limit 1
  `) as SignalRow[];

  if (rows.length === 0) {
    return null;
  }

  return normalizeSignal(rows[0], "postgres");
}

async function upsertSignalCardsPostgres(cards: SignalCard[]): Promise<boolean> {
  const sql = await getSql();
  if (!sql || cards.length === 0) {
    return false;
  }

  for (const card of cards) {
    await sql`
      insert into signal_cards (id, theme_id, date, rank, confidence, signal_json, updated_at)
      values (${card.id}, ${card.theme_id}, ${card.date}, ${card.rank}, ${card.scores.confidence}, ${JSON.stringify({
        ...card,
        mode: "postgres"
      })}::jsonb, now())
      on conflict (id) do update set
        theme_id = excluded.theme_id,
        date = excluded.date,
        rank = excluded.rank,
        confidence = excluded.confidence,
        signal_json = excluded.signal_json,
        updated_at = now()
    `;
  }

  return true;
}

async function recordFeedbackPostgres(payload: FeedbackPayload): Promise<{ persisted: boolean } | null> {
  const sql = await getSql();
  if (!sql) {
    return null;
  }

  await sql`
    insert into feedback (signal_id, label, note)
    values (${payload.signal_id}, ${payload.label}, ${payload.note ?? null})
  `;
  return { persisted: true };
}

export async function readRadarFromSupabase(date: string): Promise<RadarResponse | null> {
  const postgres = await readRadarFromPostgres(date);
  if (postgres) {
    return postgres;
  }

  const rows = await supabaseFetch<Array<{ signal_json: SignalCard }>>(
    `signal_cards?select=signal_json&date=eq.${encodeURIComponent(date)}&order=rank.asc&limit=20`
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  const cards = rows.map((row) => ({ ...row.signal_json, mode: "supabase" as const }));
  return {
    date,
    generated_at: new Date().toISOString(),
    mode: "supabase",
    horizon: "6-24 months",
    cards
  };
}

export async function readSignalFromSupabase(signalId: string): Promise<SignalCard | null> {
  const postgres = await readSignalFromPostgres(signalId);
  if (postgres) {
    return postgres;
  }

  const rows = await supabaseFetch<Array<{ signal_json: SignalCard }>>(
    `signal_cards?select=signal_json&id=eq.${encodeURIComponent(signalId)}&limit=1`
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  return { ...rows[0].signal_json, mode: "supabase" };
}

export async function upsertSignalCards(cards: SignalCard[]): Promise<void> {
  if (await upsertSignalCardsPostgres(cards)) {
    return;
  }

  if (!getSupabaseConfig() || cards.length === 0) {
    return;
  }

  await supabaseFetch("signal_cards?on_conflict=id", {
    method: "POST",
    body: JSON.stringify(
      cards.map((card) => ({
        id: card.id,
        theme_id: card.theme_id,
        date: card.date,
        rank: card.rank,
        confidence: card.scores.confidence,
        signal_json: { ...card, mode: "supabase" }
      }))
    )
  });
}

export async function recordFeedback(payload: FeedbackPayload): Promise<{ persisted: boolean }> {
  const postgres = await recordFeedbackPostgres(payload);
  if (postgres) {
    return postgres;
  }

  if (!getSupabaseConfig()) {
    return { persisted: false };
  }

  await supabaseFetch("feedback", {
    method: "POST",
    body: JSON.stringify({
      signal_id: payload.signal_id,
      label: payload.label,
      note: payload.note ?? null
    })
  });
  return { persisted: true };
}
