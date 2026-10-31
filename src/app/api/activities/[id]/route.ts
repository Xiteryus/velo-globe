import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { db, DATA_DIR } from "@/lib/db";
import { decodeLod } from "@/lib/lod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function readId(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const id = await readId(ctx);
  if (id === null) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  const row = db
    .prepare(
      `SELECT id, name, description, sport, start_time, duration_s, moving_time_s,
              distance_m, elevation_gain_m, avg_speed_ms, max_speed_ms,
              avg_hr, max_hr, calories, track_lod
       FROM activities WHERE id = ?`
    )
    .get(id) as (Record<string, unknown> & { track_lod: Buffer | null }) | undefined;

  if (!row) {
    return NextResponse.json({ error: "Sortie introuvable" }, { status: 404 });
  }

  const { track_lod, ...rest } = row;
  const coords = track_lod ? decodeLod(track_lod) : [];
  return NextResponse.json({ activity: { ...rest, coords } });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const id = await readId(ctx);
  if (id === null) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : null;
  const description = typeof body.description === "string" ? body.description : null;

  if (name !== null && name.length === 0) {
    return NextResponse.json({ error: "Le nom ne peut pas être vide" }, { status: 400 });
  }

  db.prepare(
    "UPDATE activities SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?"
  ).run(name, description, id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const id = await readId(ctx);
  if (id === null) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  const row = db.prepare("SELECT file_path FROM activities WHERE id = ?").get(id) as
    | { file_path: string }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "Sortie introuvable" }, { status: 404 });
  }

  db.prepare("DELETE FROM activities WHERE id = ?").run(id);

  try {
    fs.unlinkSync(path.join(DATA_DIR, row.file_path));
  } catch {
    // le fichier d'origine a déjà disparu : sans importance
  }

  return NextResponse.json({ ok: true });
}
