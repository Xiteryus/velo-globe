import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { db, DATA_DIR } from "./db";
import { parseGpx } from "./parsers/gpx";
import { parseFit } from "./parsers/fit";
import { bbox, elevationGain, totalDistance } from "./geo/metrics";
import { encodeLod, simplify } from "./geo/simplify";

export type ImportResult = {
  filename: string;
  status: "added" | "duplicate" | "error";
  id?: number;
  reason?: string;
};

export type ImportOptions = {
  source?: string;
  externalId?: string;
  name?: string;
};

const insertActivity = db.prepare(`
  INSERT INTO activities (
    source, external_id, file_hash, file_path, name, sport, start_time, duration_s, moving_time_s,
    distance_m, elevation_gain_m, avg_speed_ms, max_speed_ms, avg_hr, max_hr, calories,
    min_lat, min_lon, max_lat, max_lon, track_lod
  ) VALUES (
    @source, @external_id, @file_hash, @file_path, @name, @sport, @start_time, @duration_s, @moving_time_s,
    @distance_m, @elevation_gain_m, @avg_speed_ms, @max_speed_ms, @avg_hr, @max_hr, @calories,
    @min_lat, @min_lon, @max_lat, @max_lon, @track_lod
  )
`);

const insertTrack = db.prepare(
  "INSERT INTO activity_tracks (activity_id, points) VALUES (?, ?)"
);

const findByHash = db.prepare("SELECT id FROM activities WHERE file_hash = ?");

const findNear = db.prepare(`
  SELECT id FROM activities
  WHERE abs(strftime('%s', start_time) - strftime('%s', ?)) <= 60
    AND abs(distance_m - ?) <= ? * 0.01
`);

export function importFile(
  filename: string,
  buf: Buffer,
  options: ImportOptions = {}
): ImportResult {
  try {
    const ext = path.extname(filename).toLowerCase();
    if (ext !== ".gpx" && ext !== ".fit") {
      return { filename, status: "error", reason: "Format non pris en charge" };
    }

    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    const sameFile = findByHash.get(hash) as { id: number } | undefined;
    if (sameFile) return { filename, status: "duplicate", id: sameFile.id };

    const parsed = ext === ".gpx" ? parseGpx(buf) : parseFit(buf);
    const distance = parsed.distanceM ?? totalDistance(parsed.points);
    const gain = parsed.elevationGainM ?? elevationGain(parsed.points);

    const lastTime = parsed.points[parsed.points.length - 1].t;
    const firstTime = parsed.points[0].t;
    const duration =
      parsed.durationS ??
      (firstTime !== null && lastTime !== null ? Math.round((lastTime - firstTime) / 1000) : null);
    const avgSpeed = parsed.avgSpeedMs ?? (duration ? distance / duration : null);

    const sameRide = findNear.get(parsed.startTime, distance, distance) as { id: number } | undefined;
    if (sameRide) return { filename, status: "duplicate", id: sameRide.id };

    const storedPath = path.join("activities", hash + ext);
    fs.writeFileSync(path.join(DATA_DIR, storedPath), buf);

    const box = bbox(parsed.points);
    const lod = encodeLod(simplify(parsed.points, 8));
    const fullTrack = zlib.gzipSync(
      JSON.stringify(parsed.points.map((p) => [p.lat, p.lon, p.ele, p.t, p.hr, p.speed]))
    );

    const run = db.transaction(() => {
      const info = insertActivity.run({
        source: options.source ?? ext.slice(1),
        external_id: options.externalId ?? null,
        file_hash: hash,
        file_path: storedPath,
        name: options.name && options.name.trim() ? options.name.trim() : parsed.name,
        sport: parsed.sport,
        start_time: parsed.startTime,
        duration_s: duration,
        moving_time_s: parsed.movingTimeS,
        distance_m: distance,
        elevation_gain_m: gain,
        avg_speed_ms: avgSpeed,
        max_speed_ms: parsed.maxSpeedMs,
        avg_hr: parsed.avgHr,
        max_hr: parsed.maxHr,
        calories: parsed.calories,
        min_lat: box.minLat,
        min_lon: box.minLon,
        max_lat: box.maxLat,
        max_lon: box.maxLon,
        track_lod: lod,
      });
      const id = Number(info.lastInsertRowid);
      insertTrack.run(id, fullTrack);
      return id;
    });

    return { filename, status: "added", id: run() };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Erreur inconnue";
    return { filename, status: "error", reason };
  }
}
