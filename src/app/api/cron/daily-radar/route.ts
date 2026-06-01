import { NextResponse } from "next/server";
import { generateAndPersistDailyRadar } from "@/lib/radar";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const isProduction = process.env.VERCEL_ENV === "production";
  const authHeader = request.headers.get("authorization");

  if ((secret || isProduction) && authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const radar = await generateAndPersistDailyRadar(searchParams.get("date"));
  return NextResponse.json({
    ok: true,
    date: radar.date,
    mode: radar.mode,
    cards: radar.cards.length,
    top_signal: radar.cards[0]?.id ?? null
  });
}
