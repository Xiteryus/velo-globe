import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { backupPath, restoreFromZip } from "@/lib/backup";
import { DATA_DIR } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
      }
      const tmpZip = path.join(DATA_DIR, `upload-${Date.now()}.zip`);
      fs.writeFileSync(tmpZip, Buffer.from(await file.arrayBuffer()));
      try {
        const result = await restoreFromZip(tmpZip);
        return NextResponse.json({ ok: true, ...result });
      } finally {
        fs.rmSync(tmpZip, { force: true });
      }
    }

    const body = await req.json();
    const zip = backupPath(String(body.name));
    if (!zip) {
      return NextResponse.json({ error: "Sauvegarde introuvable" }, { status: 404 });
    }
    const result = await restoreFromZip(zip);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
