import { describe, expect, it } from "vitest";
import { compassName, groupDirections } from "./direction";
import { distanceToSegment, findPasses, type TrackRow } from "./passes";

const LAT0 = 45;
const LON0 = 5;
const M_LAT = 111132;
const M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const T0 = 1_700_000_000_000;

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  if (from <= to) {
    for (let x = from; x <= to; x += step) out.push(x);
  } else {
    for (let x = from; x >= to; x -= step) out.push(x);
  }
  return out;
}

// Positions est-ouest (mètres) sur une ligne située à `northM` mètres au nord du point analysé.
// Un point par seconde ; temps et vitesse optionnels.
function path(
  eastM: number[],
  options: { northM?: number; withTime?: boolean; speedMs?: number | null } = {}
): TrackRow[] {
  const northM = options.northM ?? 0;
  const withTime = options.withTime ?? true;
  const speedMs = options.speedMs ?? null;
  return eastM.map((x, i) => [
    LAT0 + northM / M_LAT,
    LON0 + x / M_LON,
    null,
    withTime ? T0 + i * 1000 : null,
    null,
    speedMs,
  ]);
}

describe("distanceToSegment", () => {
  it("mesure la distance perpendiculaire", () => {
    const r = distanceToSegment(-10, 5, 10, 5);
    expect(r.dist).toBeCloseTo(5, 6);
    expect(r.t).toBeCloseTo(0.5, 6);
  });

  it("se limite aux extrémités du segment", () => {
    const r = distanceToSegment(10, 0, 20, 0);
    expect(r.dist).toBeCloseTo(10, 6);
    expect(r.t).toBe(0);
  });
});

describe("findPasses", () => {
  it("détecte un passage unique, son sens et sa vitesse", () => {
    const passes = findPasses(path(range(-300, 300, 10)), LAT0, LON0, 25);
    expect(passes).toHaveLength(1);
    expect(passes[0].distanceM).toBeLessThan(5);
    expect(passes[0].bearing).toBeGreaterThan(87);
    expect(passes[0].bearing).toBeLessThan(93);
    expect(passes[0].speedKmh).toBeGreaterThan(35);
    expect(passes[0].speedKmh).toBeLessThan(37);
    expect(passes[0].timeMs).not.toBeNull();
  });

  it("reconnaît le sens inverse", () => {
    const passes = findPasses(path(range(300, -300, 10)), LAT0, LON0, 25);
    expect(passes).toHaveLength(1);
    expect(passes[0].bearing).toBeGreaterThan(267);
    expect(passes[0].bearing).toBeLessThan(273);
  });

  it("respecte le rayon de recherche", () => {
    const track = path(range(-300, 300, 10), { northM: 30 });
    expect(findPasses(track, LAT0, LON0, 25)).toHaveLength(0);
    const wide = findPasses(track, LAT0, LON0, 50);
    expect(wide).toHaveLength(1);
    expect(wide[0].distanceM).toBeGreaterThan(29);
    expect(wide[0].distanceM).toBeLessThan(31);
  });

  it("compte deux passages pour un aller et retour dans une même sortie", () => {
    const outAndBack = [...range(-300, 600, 10), ...range(590, -300, 10)];
    const passes = findPasses(path(outAndBack), LAT0, LON0, 25);
    expect(passes).toHaveLength(2);
    const bearings = passes.map((p) => Math.round(p.bearing ?? -1)).sort((a, b) => a - b);
    expect(bearings[0]).toBeGreaterThan(85);
    expect(bearings[0]).toBeLessThan(95);
    expect(bearings[1]).toBeGreaterThan(265);
    expect(bearings[1]).toBeLessThan(275);
  });

  it("ne compte qu'un passage lors d'un arrêt dans le rayon", () => {
    const withStop = [
      ...range(-100, -10, 10),
      ...Array.from({ length: 20 }, () => 0),
      ...range(10, 100, 10),
    ];
    expect(findPasses(path(withStop), LAT0, LON0, 25)).toHaveLength(1);
  });

  it("n'invente aucune vitesse sans horodatage ni vitesse enregistrée", () => {
    const passes = findPasses(path(range(-300, 300, 10), { withTime: false }), LAT0, LON0, 25);
    expect(passes).toHaveLength(1);
    expect(passes[0].speedKmh).toBeNull();
    expect(passes[0].timeMs).toBeNull();
  });

  it("utilise la vitesse enregistrée dans le fichier quand elle existe", () => {
    const passes = findPasses(
      path(range(-300, 300, 10), { speedMs: 8 }),
      LAT0,
      LON0,
      25
    );
    expect(passes[0].speedKmh).toBeCloseTo(28.8, 1);
  });
});

describe("sens de circulation", () => {
  it("sépare deux sens opposés", () => {
    const { assignment, groups } = groupDirections([90, 92, 270, 268, 88]);
    expect(groups).toHaveLength(2);
    expect(groups[0].count).toBe(3);
    expect(groups[1].count).toBe(2);
    expect(assignment).toEqual([0, 0, 1, 1, 0]);
  });

  it("gère un sens inconnu", () => {
    const { assignment } = groupDirections([null, 90]);
    expect(assignment).toEqual([null, 0]);
  });

  it("nomme les points cardinaux", () => {
    expect(compassName(0)).toBe("nord");
    expect(compassName(359)).toBe("nord");
    expect(compassName(45)).toBe("nord-est");
    expect(compassName(90)).toBe("est");
    expect(compassName(270)).toBe("ouest");
  });
});
