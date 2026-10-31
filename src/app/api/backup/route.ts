import { NextResponse } from "next/server";
import { createBackup, listBackups } from "@/lib/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ backups: listBackups() });
}

export async function POST() {
  try {
    const name = await createBackup();
    return NextResponse.json({ name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
