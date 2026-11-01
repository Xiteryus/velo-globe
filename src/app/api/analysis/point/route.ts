import { NextResponse } from "next/server";
import { analyzePoint } from "@/lib/analysis/pointPasses";
import { RADII } from "@/lib/analysis/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const lat = Number(body?.lat);
  const lon = Number(body?.lon);
  const radius = Number(body?.radius);

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
  }
  if (!(RADII as readonly number[]).includes(radius)) {
    return NextResponse.json({ error: "Rayon invalide (10, 25, 50 ou 100 m)" }, { status: 400 });
  }

  return NextResponse.json({ analysis: analyzePoint(lat, lon, radius) });
}
