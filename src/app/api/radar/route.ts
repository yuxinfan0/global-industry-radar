import { NextResponse } from "next/server";
import { getRadar } from "@/lib/radar";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const radar = await getRadar(date);
  return NextResponse.json(radar);
}
