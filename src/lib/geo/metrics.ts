import type { TrackPoint } from "../parsers/types";

const R = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: TrackPoint, b: TrackPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function totalDistance(points: TrackPoint[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += haversine(points[i - 1], points[i]);
  }
  return sum;
}

// Dénivelé positif avec hystérésis pour ignorer le bruit de l'altimètre
export function elevationGain(points: TrackPoint[], threshold = 3): number | null {
  const elevations = points.map((p) => p.ele).filter((e): e is number => e !== null);
  if (elevations.length < 2) return null;
  let gain = 0;
  let ref = elevations[0];
  for (const e of elevations) {
    if (e - ref >= threshold) {
      gain += e - ref;
      ref = e;
    } else if (ref - e >= threshold) {
      ref = e;
    }
  }
  return gain;
}

export function bbox(points: TrackPoint[]) {
  let minLat = Infinity;
  let minLon = Infinity;
  let maxLat = -Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, minLon, maxLat, maxLon };
}