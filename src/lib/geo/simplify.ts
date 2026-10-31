import type { TrackPoint } from "../parsers/types";

// Douglas-Peucker itératif, en mètres sur une projection locale
export function simplify(points: TrackPoint[], epsilonM = 8): TrackPoint[] {
  const n = points.length;
  if (n < 3) return points;

  const lat0 = (points[0].lat * Math.PI) / 180;
  const kx = 111320 * Math.cos(lat0);
  const ky = 110540;
  const xs = points.map((p) => p.lon * kx);
  const ys = points.map((p) => p.lat * ky);

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: number[] = [0, n - 1];

  while (stack.length > 0) {
    const end = stack.pop() as number;
    const start = stack.pop() as number;
    const dx = xs[end] - xs[start];
    const dy = ys[end] - ys[start];
    const len2 = dx * dx + dy * dy;
    let maxDist = 0;
    let index = -1;

    for (let i = start + 1; i < end; i++) {
      let d: number;
      if (len2 === 0) {
        d = Math.hypot(xs[i] - xs[start], ys[i] - ys[start]);
      } else {
        d = Math.abs(dy * xs[i] - dx * ys[i] + xs[end] * ys[start] - ys[end] * xs[start]) / Math.sqrt(len2);
      }
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }

    if (index !== -1 && maxDist > epsilonM) {
      keep[index] = 1;
      stack.push(start, index, index, end);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
}

// Encodage compact [lon, lat, lon, lat, ...] en Float64
export function encodeLod(points: TrackPoint[]): Buffer {
  const arr = new Float64Array(points.length * 2);
  points.forEach((p, i) => {
    arr[i * 2] = p.lon;
    arr[i * 2 + 1] = p.lat;
  });
  return Buffer.from(arr.buffer);
}