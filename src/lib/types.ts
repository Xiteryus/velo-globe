export type ActivityGeo = {
  id: number;
  name: string;
  start_time: string;
  distance_m: number;
  duration_s: number | null;
  elevation_gain_m: number | null;
  avg_speed_ms: number | null;
  coords: number[]; // [lon, lat, lon, lat, ...]
};
