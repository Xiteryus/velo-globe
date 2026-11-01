export const RADII = [10, 25, 50, 100] as const;

export type PointPass = {
  activityId: number;
  name: string;
  startTime: string;
  timeMs: number | null;
  distanceM: number;
  directionId: string | null;
  bearing: number | null;
  speedKmh: number | null;
};

export type DirectionStat = {
  id: string;
  label: string;
  bearing: number;
  count: number;
  avgSpeedKmh: number | null;
  bestSpeedKmh: number | null;
};

export type PointAnalysis = {
  lat: number;
  lon: number;
  radius: number;
  totalPasses: number;
  activityCount: number;
  directions: DirectionStat[];
  passes: PointPass[];
};
