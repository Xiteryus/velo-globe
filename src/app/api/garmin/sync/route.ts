import { NextResponse } from "next/server";
import { GarminError, getSetting, hasKey } from "@/lib/garmin";
import { syncGarmin } from "@/lib/garminSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

const AUTO_INTERVAL_MS = 6 * 3600 * 1000;
const globalForSync = globalThis as unknown as { __garminSyncing?: boolean };

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const mode: string = typeof body.mode === "string" ? body.mode : "last";

  if (!hasKey()) {
    if (mode === "auto") return NextResponse.json({ skipped: true });
    return NextResponse.json({ error: "Aucune clé Garmin enregistrée" }, { status: 400 });
  }

  const last = getSetting("garmin_last_sync");

  if (mode === "auto" && last && Date.now() - Date.parse(last) < AUTO_INTERVAL_MS) {
    return NextResponse.json({ skipped: true });
  }

  if (globalForSync.__garminSyncing) {
    if (mode === "auto") return NextResponse.json({ skipped: true });
    return NextResponse.json({ error: "Une synchronisation est déjà en cours" }, { status: 409 });
  }

  let since: string;
  if (mode === "all") since = "2000-01-01";
  else if (mode === "year") since = daysAgo(365);
  else since = last ? daysAgo(Math.ceil((Date.now() - Date.parse(last)) / 86400000) + 2) : daysAgo(30);

  globalForSync.__garminSyncing = true;
  try {
    const report = await syncGarmin(since);
    return NextResponse.json({ ok: true, since, ...report });
  } catch (err) {
    const message = err instanceof GarminError ? err.message : "Erreur pendant la synchronisation";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    globalForSync.__garminSyncing = false;
  }
}
