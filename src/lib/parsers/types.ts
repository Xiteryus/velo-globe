export type TrackPoint = {
  lat: number;
  lon: number;
  ele: number | null;
  t: number | null; // epoch ms
  hr: number | null;
  speed: number | null; // m/s
};

export type ParsedActivity = {
  name: string;
  sport: string | null;
  startTime: string; // ISO UTC
  durationS: number | null;
  movingTimeS: number | null;
  distanceM: number | null;
  elevationGainM: number | null;
  avgSpeedMs: number | null;
  maxSpeedMs: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  points: TrackPoint[];
};