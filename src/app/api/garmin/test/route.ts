import { NextResponse } from "next/server";
import { GarminError, searchActivities } from "@/lib/garmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const items = await searchActivities(0, 5);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const message = err instanceof GarminError ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
