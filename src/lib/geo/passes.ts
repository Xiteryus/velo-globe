// Ligne d'un tracé complet : [lat, lon, altitude, temps (ms), fréquence cardiaque, vitesse (m/s)]
export type TrackRow = [
  number,
  number,
  number | null,
  number | null,
  number | null,
  number | null,
];

export type Pass = {
  segmentIndex: number;
  distanceM: number; // distance minimale entre le tracé et le point analysé
  bearing: number | null; // sens de déplacement, en degrés depuis le nord
  timeMs: number | null; // instant du passage, seulement si le fichier a des horodatages
  speedKmh: number | null; // seulement si mesurable, jamais estimée sans données
};

const M_PER_DEG_LAT = 111132;
const M_PER_DEG_LON_EQUATOR = 111320;
const BEARING_WINDOW_M = 25;
const MIN_BEARING_SPAN_M = 8;
const MAX_PLAUSIBLE_KMH = 120;

// Distance entre l'origine (0, 0) et le segment [A, B], en mètres, et position t le long du segment
export function distanceToSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number
): { dist: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = -(ax * dx + ay * dy) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { dist: Math.hypot(cx, cy), t };
}

export function findPasses(
  rows: TrackRow[],
  lat0: number,
  lon0: number,
  radiusM: number
): Pass[] {
  const n = rows.length;
  if (n < 2) return [];

  const kx = M_PER_DEG_LON_EQUATOR * Math.cos((lat0 * Math.PI) / 180);
  const ky = M_PER_DEG_LAT;

  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const cum = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    xs[i] = (rows[i][1] - lon0) * kx;
    ys[i] = (rows[i][0] - lat0) * ky;
    if (i > 0) {
      cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    }
  }

  type Hit = { i: number; dist: number; t: number };
  const runs: Hit[][] = [];
  let current: Hit[] | null = null;
  let lastIndex = -1;

  for (let i = 0; i < n - 1; i++) {
    const { dist, t } = distanceToSegment(xs[i], ys[i], xs[i + 1], ys[i + 1]);
    if (dist > radiusM) continue;

    // Les segments proches sont fusionnés : un arrêt ou un petit saut GPS ne crée pas un second passage
    const joins = current !== null && cum[i] - cum[lastIndex + 1] <= 2 * radiusM;
    if (joins && current) {
      current.push({ i, dist, t });
    } else {
      current = [{ i, dist, t }];
      runs.push(current);
    }
    lastIndex = i;
  }

  const passes: Pass[] = [];

  for (const run of runs) {
    let best = run[0];
    for (const hit of run) {
      if (hit.dist < best.dist) best = hit;
    }
    const i = best.i;

    // Fenêtre d'environ 25 m de chaque côté pour un sens de déplacement stable
    let a = i;
    while (a > 0 && cum[i] - cum[a] < BEARING_WINDOW_M) a--;
    let b = i + 1;
    while (b < n - 1 && cum[b] - cum[i + 1] < BEARING_WINDOW_M) b++;

    const dx = xs[b] - xs[a];
    const dy = ys[b] - ys[a];
    let bearing: number | null = null;
    if (Math.hypot(dx, dy) >= MIN_BEARING_SPAN_M) {
      bearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
    }

    let timeMs: number | null = null;
    const t0 = rows[i][3];
    const t1 = rows[i + 1][3];
    if (t0 !== null && t1 !== null) {
      timeMs = t0 + best.t * (t1 - t0);
    }

    let speedKmh: number | null = null;
    let sum = 0;
    let count = 0;
    for (let k = a; k <= b; k++) {
      const v = rows[k][5];
      if (v !== null) {
        sum += v;
        count += 1;
      }
    }
    if (count > 0) {
      speedKmh = (sum / count) * 3.6;
    } else {
      const ta = rows[a][3];
      const tb = rows[b][3];
      if (ta !== null && tb !== null) {
        const seconds = (tb - ta) / 1000;
        if (seconds > 0) {
          const v = ((cum[b] - cum[a]) / seconds) * 3.6;
          if (v <= MAX_PLAUSIBLE_KMH) speedKmh = v;
        }
      }
    }

    passes.push({ segmentIndex: i, distanceM: best.dist, bearing, timeMs, speedKmh });
  }

  return passes;
}
