import { NextResponse } from "next/server";
import { getSignal } from "@/lib/radar";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const signal = await getSignal(decodeURIComponent(id));
  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }
  return NextResponse.json(signal);
}
