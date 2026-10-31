import { NextResponse } from "next/server";
import { importFile } from "@/lib/import";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
  }

  const results = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    results.push(importFile(file.name, buf));
  }

  return NextResponse.json({ results });
}