const NAMES = [
  "nord",
  "nord-est",
  "est",
  "sud-est",
  "sud",
  "sud-ouest",
  "ouest",
  "nord-ouest",
];

export function compassName(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  return NAMES[Math.round(normalized / 45) % 8];
}

export function angularDiff(a: number, b: number): number {
  return Math.abs((((a - b + 540) % 360) + 360) % 360 - 180);
}

export type BearingGroup = { bearing: number; count: number };

// Regroupe des sens de déplacement : un tracé aller et retour donne deux groupes,
// un carrefour peut en donner davantage
export function groupDirections(
  bearings: (number | null)[],
  toleranceDeg = 40
): { assignment: (number | null)[]; groups: BearingGroup[] } {
  type Acc = { sin: number; cos: number };
  const acc: Acc[] = [];

  const meanOf = (c: Acc): number => ((Math.atan2(c.sin, c.cos) * 180) / Math.PI + 360) % 360;

  for (const b of bearings) {
    if (b === null) continue;
    let best = -1;
    let bestDiff = toleranceDeg + 1;
    for (let k = 0; k < acc.length; k++) {
      const diff = angularDiff(b, meanOf(acc[k]));
      if (diff < bestDiff) {
        bestDiff = diff;
        best = k;
      }
    }
    const rad = (b * Math.PI) / 180;
    if (best === -1) {
      acc.push({ sin: Math.sin(rad), cos: Math.cos(rad) });
    } else {
      acc[best].sin += Math.sin(rad);
      acc[best].cos += Math.cos(rad);
    }
  }

  const means = acc.map(meanOf);
  const counts: number[] = means.map(() => 0);

  const raw: (number | null)[] = bearings.map((b) => {
    if (b === null || means.length === 0) return null;
    let best = 0;
    let bestDiff = Infinity;
    for (let k = 0; k < means.length; k++) {
      const diff = angularDiff(b, means[k]);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = k;
      }
    }
    counts[best] += 1;
    return best;
  });

  const order = counts
    .map((_, index) => index)
    .filter((index) => counts[index] > 0)
    .sort((x, y) => counts[y] - counts[x]);

  const remap = new Map<number, number>();
  order.forEach((oldIndex, newIndex) => remap.set(oldIndex, newIndex));

  const groups: BearingGroup[] = order.map((oldIndex) => ({
    bearing: means[oldIndex],
    count: counts[oldIndex],
  }));
  const assignment = raw.map((r) => (r === null ? null : (remap.get(r) ?? null)));

  return { assignment, groups };
}
