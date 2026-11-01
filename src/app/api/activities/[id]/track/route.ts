import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildProfile, decodeTrack } from "@/lib/track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  const row = db
    .prepare("SELECT points FROM activity_tracks WHERE activity_id = ?")
    .get(n) as { points: Buffer } | undefined;

  if (!row) {
    return NextResponse.json({ error: "Tracé introuvable" }, { status: 404 });
  }

  return NextResponse.json(buildProfile(decodeTrack(row.points)));
}
