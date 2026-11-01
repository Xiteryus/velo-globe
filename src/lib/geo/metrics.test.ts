import { describe, expect, it } from "vitest";
import type { TrackPoint } from "../parsers/types";
import { elevationGain, haversine, totalDistance } from "./metrics";

function pt(lat: number, lon: number, ele: number | null = null): TrackPoint {
  return { lat, lon, ele, t: null, hr: null, speed: null };
}

describe("haversine", () => {
  it("renvoie 0 pour deux points identiques", () => {
    expect(haversine(pt(45, 5), pt(45, 5))).toBe(0);
  });

  it("1 degré de latitude vaut environ 111,2 km", () => {
    const d = haversine(pt(45, 5), pt(46, 5));
    expect(d).toBeGreaterThan(111000);
    expect(d).toBeLessThan(111400);
  });

  it("1 degré de longitude à 60° de latitude vaut environ 55,6 km", () => {
    const d = haversine(pt(60, 5), pt(60, 6));
    expect(d).toBeGreaterThan(55400);
    expect(d).toBeLessThan(55800);
  });
});

describe("totalDistance", () => {
  it("additionne les tronçons", () => {
    const d = totalDistance([pt(45, 5), pt(45.001, 5), pt(45.002, 5)]);
    expect(d).toBeCloseTo(222.4, 0);
  });
});

describe("elevationGain", () => {
  it("ignore le bruit de l'altimètre", () => {
    const gain = elevationGain([100, 101, 100, 101, 100].map((e) => pt(45, 5, e)));
    expect(gain).toBe(0);
  });

  it("cumule une montée régulière", () => {
    const gain = elevationGain([100, 110, 120, 130].map((e) => pt(45, 5, e)));
    expect(gain).toBe(30);
  });

  it("cumule chaque montée après une descente", () => {
    const gain = elevationGain([100, 150, 100, 150].map((e) => pt(45, 5, e)));
    expect(gain).toBe(100);
  });

  it("renvoie null sans altitude", () => {
    expect(elevationGain([pt(45, 5), pt(45.1, 5)])).toBeNull();
  });
});
