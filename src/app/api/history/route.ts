import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const rows = db
    .prepare(
      `SELECT id, name, description, sport, start_time, distance_m,
              duration_s, elevation_gain_m, avg_speed_ms
       FROM activities
       ORDER BY start_time DESC`
    )
    .all();
  return NextResponse.json({ activities: rows });
}
