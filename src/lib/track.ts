import zlib from "node:zlib";

export type ProfilePoint = {
  d: number; // distance cumulée, km
  t: number | null; // secondes depuis le départ
  ele: number | null;
  speed: number | null; // km/h
  hr: number | null;
  lat: number;
  lon: number;
};

export type Profile = {
  points: ProfilePoint[];
  hasEle: boolean;
  hasSpeed: boolean;
  hasHr: boolean;
};

// [lat, lon, ele, t, hr, speed]
type Row = [number, number, number | null, number | null, number | null, number | null];

const R = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function decodeTrack(blob: Buffer): Row[] {
  return JSON.parse(zlib.gunzipSync(blob).toString("utf8")) as Row[];
}

function average(values: (number | null)[]): number | null {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (v !== null && Number.isFinite(v)) {
      sum += v;
      count += 1;
    }
  }
  return count > 0 ? sum / count : null;
}

export function buildProfile(rows: Row[], maxPoints = 600): Profile {
  const n = rows.length;
  if (n < 2) return { points: [], hasEle: false, hasSpeed: false, hasHr: false };

  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    cum[i] = cum[i - 1] + haversine(rows[i - 1][0], rows[i - 1][1], rows[i][0], rows[i][1]);
  }

  const t0 = rows[0][3];
  const hasTime = t0 !== null && rows[n - 1][3] !== null;

  // Vitesse : valeur du fichier si elle existe, sinon calculée sur une fenêtre glissante
  const speeds: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const raw = rows[i][5];
    if (raw !== null && raw !== undefined) {
      speeds[i] = raw * 3.6;
      continue;
    }
    if (!hasTime) continue;
    const j0 = Math.max(0, i - 4);
    const j1 = Math.min(n - 1, i + 4);
    const ta = rows[j0][3];
    const tb = rows[j1][3];
    if (ta === null || tb === null) continue;
    const dt = (tb - ta) / 1000;
    if (dt > 0) {
      const v = ((cum[j1] - cum[j0]) / dt) * 3.6;
      speeds[i] = v >= 0 && v < 150 ? v : null;
    }
  }

  const buckets = Math.min(maxPoints, n);
  const points: ProfilePoint[] = [];
  let hasEle = false;
  let hasSpeed = false;
  let hasHr = false;

  for (let b = 0; b < buckets; b++) {
    const start = Math.floor((b * n) / buckets);
    const end = Math.max(start + 1, Math.floor(((b + 1) * n) / buckets));
    const mid = Math.min(n - 1, Math.floor((start + end - 1) / 2));

    const ele = average(rows.slice(start, end).map((r) => r[2]));
    const speed = average(speeds.slice(start, end));
    const hr = average(rows.slice(start, end).map((r) => r[4]));

    if (ele !== null) hasEle = true;
    if (speed !== null) hasSpeed = true;
    if (hr !== null) hasHr = true;

    const tMid = rows[mid][3];
    points.push({
      d: Math.round((cum[mid] / 1000) * 1000) / 1000,
      t: hasTime && tMid !== null && t0 !== null ? Math.round((tMid - t0) / 1000) : null,
      ele: ele !== null ? Math.round(ele * 10) / 10 : null,
      speed: speed !== null ? Math.round(speed * 10) / 10 : null,
      hr: hr !== null ? Math.round(hr) : null,
      lat: Math.round(rows[mid][0] * 1e6) / 1e6,
      lon: Math.round(rows[mid][1] * 1e6) / 1e6,
    });
  }

  return { points, hasEle, hasSpeed, hasHr };
}
