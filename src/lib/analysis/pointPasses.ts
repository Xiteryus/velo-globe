import { db } from "../db";
import { compassName, groupDirections } from "../geo/direction";
import { distanceToSegment, findPasses, type TrackRow } from "../geo/passes";
import { decodeLod } from "../lod";
import { decodeTrack } from "../track";
import type { DirectionStat, PointAnalysis, PointPass } from "./types";

// Données calculées : jetables, séparées des données d'origine, exclues des sauvegardes
db.exec(`
  CREATE TABLE IF NOT EXISTS analysis_cache (
    key        TEXT PRIMARY KEY,
    version    TEXT NOT NULL,
    payload    TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

const M_PER_DEG_LAT = 111132;
const LOD_MARGIN_M = 15; // le tracé simplifié s'écarte de l'original de 8 m au plus
const BBOX_MARGIN_M = 50;
const TRACK_CACHE_MAX = 30;
const CACHE_MAX_ROWS = 500;
const LANES = "ABCDEFGH";

type CorePass = {
  activityId: number;
  timeMs: number | null;
  distanceM: number;
  directionId: string | null;
  bearing: number | null;
  speedKmh: number | null;
};

type Core = {
  lat: number;
  lon: number;
  radius: number;
  passes: CorePass[];
  directions: DirectionStat[];
};

type Candidate = {
  id: number;
  file_hash: string;
  track_lod: Buffer | null;
};

const globalForTracks = globalThis as unknown as { __trackCache?: Map<string, TrackRow[]> };
const trackCache = globalForTracks.__trackCache ?? new Map<string, TrackRow[]>();
globalForTracks.__trackCache = trackCache;

function dataVersion(): string {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n,
              COALESCE(MAX(id), 0) AS max_id,
              COALESCE(ROUND(SUM(distance_m)), 0) AS dist
       FROM activities`
    )
    .get() as { n: number; max_id: number; dist: number };
  return `${row.n}|${row.max_id}|${row.dist}`;
}

function lodIsNear(coords: number[], lat0: number, lon0: number, radius: number): boolean {
  if (coords.length < 4) return false;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const limit = radius + LOD_MARGIN_M;
  let px = (coords[0] - lon0) * kx;
  let py = (coords[1] - lat0) * M_PER_DEG_LAT;
  for (let i = 2; i < coords.length; i += 2) {
    const x = (coords[i] - lon0) * kx;
    const y = (coords[i + 1] - lat0) * M_PER_DEG_LAT;
    if (distanceToSegment(px, py, x, y).dist <= limit) return true;
    px = x;
    py = y;
  }
  return false;
}

function loadTrack(id: number, hash: string): TrackRow[] | null {
  const key = `${id}:${hash}`;
  const hit = trackCache.get(key);
  if (hit) {
    trackCache.delete(key);
    trackCache.set(key, hit);
    return hit;
  }

  const row = db
    .prepare("SELECT points FROM activity_tracks WHERE activity_id = ?")
    .get(id) as { points: Buffer } | undefined;
  if (!row) return null;

  const rows = decodeTrack(row.points) as TrackRow[];
  trackCache.set(key, rows);
  if (trackCache.size > TRACK_CACHE_MAX) {
    const oldest = trackCache.keys().next().value;
    if (oldest !== undefined) trackCache.delete(oldest);
  }
  return rows;
}

function compute(lat: number, lon: number, radius: number): Core {
  const dLat = (radius + BBOX_MARGIN_M) / M_PER_DEG_LAT;
  const dLon = dLat / Math.max(0.01, Math.cos((lat * Math.PI) / 180));

  // Étape 1 : bounding boxes en SQL
  const candidates = db
    .prepare(
      `SELECT id, file_hash, track_lod FROM activities
       WHERE max_lat >= ? AND min_lat <= ? AND max_lon >= ? AND min_lon <= ?`
    )
    .all(lat - dLat, lat + dLat, lon - dLon, lon + dLon) as Candidate[];

  const found: CorePass[] = [];

  for (const c of candidates) {
    // Étape 2 : tracé simplifié, bien plus léger que le tracé complet
    if (c.track_lod && !lodIsNear(decodeLod(c.track_lod), lat, lon, radius)) continue;

    // Étape 3 : tracé complet, seulement pour les vrais candidats
    const track = loadTrack(c.id, c.file_hash);
    if (!track) continue;

    for (const pass of findPasses(track, lat, lon, radius)) {
      found.push({
        activityId: c.id,
        timeMs: pass.timeMs !== null ? Math.round(pass.timeMs) : null,
        distanceM: Math.round(pass.distanceM * 10) / 10,
        directionId: null,
        bearing: pass.bearing !== null ? Math.round(pass.bearing) : null,
        speedKmh: pass.speedKmh !== null ? Math.round(pass.speedKmh * 10) / 10 : null,
      });
    }
  }

  const { assignment, groups } = groupDirections(found.map((p) => p.bearing));
  found.forEach((p, index) => {
    const g = assignment[index];
    p.directionId = g === null ? null : LANES[g] ?? null;
  });

  const directions: DirectionStat[] = groups.map((g, index) => {
    const id = LANES[index] ?? String(index + 1);
    const speeds = found
      .filter((p) => p.directionId === id && p.speedKmh !== null)
      .map((p) => p.speedKmh as number);
    const avg = speeds.length > 0 ? speeds.reduce((s, v) => s + v, 0) / speeds.length : null;
    return {
      id,
      label: "Vers le " + compassName(g.bearing),
      bearing: Math.round(g.bearing),
      count: g.count,
      avgSpeedKmh: avg !== null ? Math.round(avg * 10) / 10 : null,
      bestSpeedKmh: speeds.length > 0 ? Math.max(...speeds) : null,
    };
  });

  return { lat, lon, radius, passes: found, directions };
}

function hydrate(core: Core): PointAnalysis {
  const ids = Array.from(new Set(core.passes.map((p) => p.activityId)));
  const info = new Map<number, { name: string; start_time: string }>();

  if (ids.length > 0) {
    const marks = ids.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT id, name, start_time FROM activities WHERE id IN (${marks})`)
      .all(...ids) as { id: number; name: string; start_time: string }[];
    for (const r of rows) info.set(r.id, { name: r.name, start_time: r.start_time });
  }

  const passes: PointPass[] = core.passes
    .filter((p) => info.has(p.activityId))
    .map((p) => {
      const meta = info.get(p.activityId) as { name: string; start_time: string };
      return { ...p, name: meta.name, startTime: meta.start_time };
    });

  const when = (p: PointPass): number => p.timeMs ?? Date.parse(p.startTime);
  passes.sort((a, b) => when(b) - when(a));

  return {
    lat: core.lat,
    lon: core.lon,
    radius: core.radius,
    totalPasses: passes.length,
    activityCount: new Set(passes.map((p) => p.activityId)).size,
    directions: core.directions,
    passes,
  };
}

export function analyzePoint(lat: number, lon: number, radius: number): PointAnalysis {
  const version = dataVersion();
  const key = `point:${lat.toFixed(5)}:${lon.toFixed(5)}:${radius}`;

  const cached = db
    .prepare("SELECT payload FROM analysis_cache WHERE key = ? AND version = ?")
    .get(key, version) as { payload: string } | undefined;

  if (cached) return hydrate(JSON.parse(cached.payload) as Core);

  const core = compute(lat, lon, radius);

  db.prepare(
    `INSERT INTO analysis_cache (key, version, payload) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET version = excluded.version, payload = excluded.payload,
                                    created_at = CURRENT_TIMESTAMP`
  ).run(key, version, JSON.stringify(core));

  db.prepare(
    `DELETE FROM analysis_cache WHERE rowid NOT IN
       (SELECT rowid FROM analysis_cache ORDER BY created_at DESC LIMIT ?)`
  ).run(CACHE_MAX_ROWS);

  return hydrate(core);
}
