import { NextResponse } from "next/server";
import { checkKey, deleteKey, GarminError, getSetting, hasKey, saveKey } from "@/lib/garmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    hasKey: hasKey(),
    lastSync: getSetting("garmin_last_sync"),
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (key.length < 10) {
    return NextResponse.json({ error: "Clé invalide" }, { status: 400 });
  }

  saveKey(key);
  try {
    await checkKey();
    return NextResponse.json({ ok: true });
  } catch (err) {
    deleteKey();
    const message = err instanceof GarminError ? err.message : "Vérification impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export function DELETE() {
  deleteKey();
  return NextResponse.json({ ok: true });
}
