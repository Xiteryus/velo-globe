import fs from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { backupPath } from "@/lib/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ name: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { name } = await ctx.params;
  const file = backupPath(name);
  if (!file) {
    return NextResponse.json({ error: "Sauvegarde introuvable" }, { status: 404 });
  }

  const stream = Readable.toWeb(fs.createReadStream(file)) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": String(fs.statSync(file).size),
    },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { name } = await ctx.params;
  const file = backupPath(name);
  if (!file) {
    return NextResponse.json({ error: "Sauvegarde introuvable" }, { status: 404 });
  }
  fs.rmSync(file, { force: true });
  return NextResponse.json({ ok: true });
}
