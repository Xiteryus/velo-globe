import { XMLParser } from "fast-xml-parser";
import type { ParsedActivity, TrackPoint } from "./types";

const ARRAYS = new Set(["trk", "trkseg", "trkpt"]);

export function parseGpx(buf: Buffer): ParsedActivity {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (tag) => ARRAYS.has(tag),
  });
  const doc = parser.parse(buf.toString("utf8"));
  const tracks = doc?.gpx?.trk ?? [];
  const points: TrackPoint[] = [];

  for (const trk of tracks) {
    for (const seg of trk.trkseg ?? []) {
      for (const pt of seg.trkpt ?? []) {
        const lat = Number(pt["@_lat"]);
        const lon = Number(pt["@_lon"]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const ele = pt.ele !== undefined ? Number(pt.ele) : null;
        const t = pt.time ? Date.parse(pt.time) : null;
        const hrRaw = pt.extensions?.["gpxtpx:TrackPointExtension"]?.["gpxtpx:hr"];
        const hr = hrRaw !== undefined ? Number(hrRaw) : null;
        points.push({ lat, lon, ele, t, hr, speed: null });
      }
    }
  }

  if (points.length < 2) {
    throw new Error("Aucun tracé GPS exploitable dans ce fichier GPX");
  }

  const firstTime = points.find((p) => p.t !== null)?.t ?? Date.now();
  const rawName = tracks[0]?.name;

  return {
    name: rawName ? String(rawName) : "Sortie vélo",
    sport: tracks[0]?.type ? String(tracks[0].type) : null,
    startTime: new Date(firstTime).toISOString(),
    durationS: null,
    movingTimeS: null,
    distanceM: null,
    elevationGainM: null,
    avgSpeedMs: null,
    maxSpeedMs: null,
    avgHr: null,
    maxHr: null,
    calories: null,
    points,
  };
}