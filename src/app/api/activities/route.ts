import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: number;
  name: string;
  start_time: string;
  distance_m: number;
  duration_s: number | null;
  elevation_gain_m: number | null;
  avg_speed_ms: number | null;
  track_lod: Buffer | null;
};

export function GET() {
  const rows = db
    .prepare(
      `SELECT id, name, start_time, distance_m, duration_s,
              elevation_gain_m, avg_speed_ms, track_lod
       FROM activities
       ORDER BY start_time DESC`
    )
    .all() as Row[];

  const activities = rows.map(({ track_lod, ...rest }) => {
    let coords: number[] = [];
    if (track_lod) {
      const copy = track_lod.buffer.slice(
        track_lod.byteOffset,
        track_lod.byteOffset + track_lod.byteLength
      );
      coords = Array.from(new Float64Array(copy));
    }
    return { ...rest, coords };
  });

  return NextResponse.json({ activities });
}
