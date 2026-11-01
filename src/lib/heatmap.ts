import type { ActivityGeo } from "./types";

export type HeatmapImage = {
  url: string;
  west: number;
  south: number;
  east: number;
  north: number;
};

const MAX_SIZE = 2048;
const PADDING_DEG = 0.01;

// Filtre maximum séparable : élargit les traits
function dilate(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let best = 0;
      const from = Math.max(0, x - r);
      const to = Math.min(w - 1, x + r);
      for (let k = from; k <= to; k++) {
        if (src[row + k] > best) best = src[row + k];
      }
      tmp[row + x] = best;
    }
  }

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let best = 0;
      const from = Math.max(0, y - r);
      const to = Math.min(h - 1, y + r);
      for (let k = from; k <= to; k++) {
        if (tmp[k * w + x] > best) best = tmp[k * w + x];
      }
      out[y * w + x] = best;
    }
  }

  return out;
}

// Flou en boîte (rayon 1), pour adoucir les bords
function smooth(src: Float32Array, w: number, h: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const a = x > 0 ? src[row + x - 1] : src[row + x];
      const c = x < w - 1 ? src[row + x + 1] : src[row + x];
      tmp[row + x] = (a + src[row + x] + c) / 3;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = y > 0 ? tmp[(y - 1) * w + x] : tmp[y * w + x];
      const c = y < h - 1 ? tmp[(y + 1) * w + x] : tmp[y * w + x];
      out[y * w + x] = (a + tmp[y * w + x] + c) / 3;
    }
  }

  return out;
}

const STOPS: { at: number; rgb: [number, number, number] }[] = [
  { at: 0.0, rgb: [60, 20, 140] },
  { at: 0.35, rgb: [200, 40, 150] },
  { at: 0.7, rgb: [255, 120, 40] },
  { at: 1.0, rgb: [255, 245, 170] },
];

function ramp(t: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i].at) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const f = (t - a.at) / (b.at - a.at);
      return [
        a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f,
        a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f,
        a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f,
      ];
    }
  }
  return STOPS[STOPS.length - 1].rgb;
}

export function buildHeatmap(activities: ActivityGeo[]): HeatmapImage | null {
  const valid = activities.filter((a) => a.coords.length >= 4);
  if (valid.length === 0) return null;

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const a of valid) {
    for (let i = 0; i < a.coords.length; i += 2) {
      const lon = a.coords[i];
      const lat = a.coords[i + 1];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  const west = minLon - PADDING_DEG;
  const east = maxLon + PADDING_DEG;
  const south = minLat - PADDING_DEG;
  const north = maxLat + PADDING_DEG;

  const lonSpan = east - west;
  const latSpan = north - south;
  const scale = MAX_SIZE / Math.max(lonSpan, latSpan); // pixels par degré
  const width = Math.max(2, Math.ceil(lonSpan * scale));
  const height = Math.max(2, Math.ceil(latSpan * scale));

  const counts = new Float32Array(width * height);
  const stamps = new Uint32Array(width * height);

  // Une sortie ne compte qu'une fois par pixel
  for (let a = 0; a < valid.length; a++) {
    const c = valid[a].coords;
    const stamp = a + 1;
    let px = (c[0] - west) * scale;
    let py = (north - c[1]) * scale;

    for (let i = 2; i < c.length; i += 2) {
      const x = (c[i] - west) * scale;
      const y = (north - c[i + 1]) * scale;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x - px), Math.abs(y - py))));

      for (let s = 0; s <= steps; s++) {
        const ix = Math.round(px + ((x - px) * s) / steps);
        const iy = Math.round(py + ((y - py) * s) / steps);
        if (ix < 0 || iy < 0 || ix >= width || iy >= height) continue;
        const k = iy * width + ix;
        if (stamps[k] !== stamp) {
          stamps[k] = stamp;
          counts[k] += 1;
        }
      }
      px = x;
      py = y;
    }
  }

  const metersPerPixel = 111320 / scale;
  const radius = Math.min(6, Math.max(1, Math.round(15 / metersPerPixel)));
  const field = smooth(dilate(counts, width, height, radius), width, height);

  let max = 1;
  for (let i = 0; i < field.length; i++) {
    if (field[i] > max) max = field[i];
  }
  const logMax = Math.log1p(max);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const image = ctx.createImageData(width, height);
  for (let i = 0; i < field.length; i++) {
    const v = field[i];
    if (v < 0.15) continue; // transparent
    const norm = Math.log1p(v) / logMax;
    const t = Math.min(1, 0.12 + 0.88 * norm);
    const [r, g, b] = ramp(t);
    const o = i * 4;
    image.data[o] = r;
    image.data[o + 1] = g;
    image.data[o + 2] = b;
    image.data[o + 3] = Math.round(255 * Math.min(1, 0.45 + 0.7 * t));
  }
  ctx.putImageData(image, 0, 0);

  return { url: canvas.toDataURL("image/png"), west, south, east, north };
}
