import { NextResponse } from "next/server";
import { recordFeedback } from "@/lib/storage";
import type { FeedbackLabel, FeedbackPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

const labels = new Set<FeedbackLabel>(["useful", "wrong", "watch", "investable", "ignore"]);

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<FeedbackPayload>;

  if (!body.signal_id || !body.label || !labels.has(body.label)) {
    return NextResponse.json({ error: "Expected signal_id and a valid label" }, { status: 400 });
  }

  const result = await recordFeedback({
    signal_id: body.signal_id,
    label: body.label,
    note: body.note
  });

  return NextResponse.json({ ok: true, ...result });
}
