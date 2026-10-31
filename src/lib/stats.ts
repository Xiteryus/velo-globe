export type Ride = {
  id: number;
  name: string;
  start_time: string;
  distance_m: number;
  duration_s: number | null;
  elevation_gain_m: number | null;
  avg_speed_ms: number | null;
};

export type Metric = "distance" | "rides" | "elevation" | "duration";
export type Granularity = "week" | "month" | "year";

const MONTH_SHORT = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (copy.getDay() + 6) % 7; // lundi = 0
  copy.setDate(copy.getDate() - offset);
  return copy;
}

function periodStart(d: Date, g: Granularity): Date {
  if (g === "week") return startOfWeek(d);
  if (g === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
  return new Date(d.getFullYear(), 0, 1);
}

function nextPeriod(d: Date, g: Granularity): Date {
  const next = new Date(d);
  if (g === "week") next.setDate(next.getDate() + 7);
  else if (g === "month") next.setMonth(next.getMonth() + 1);
  else next.setFullYear(next.getFullYear() + 1);
  return next;
}

function periodKey(d: Date, g: Granularity): string {
  return dayKey(periodStart(d, g));
}

function periodLabel(d: Date, g: Granularity): string {
  if (g === "week") {
    return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  }
  if (g === "month") {
    return `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  }
  return String(d.getFullYear());
}

function metricValue(ride: Ride, metric: Metric): number {
  if (metric === "distance") return ride.distance_m / 1000;
  if (metric === "elevation") return ride.elevation_gain_m ?? 0;
  if (metric === "duration") return (ride.duration_s ?? 0) / 3600;
  return 1;
}

export type SeriesPoint = { label: string; value: number };

export function buildSeries(rides: Ride[], metric: Metric, g: Granularity): SeriesPoint[] {
  if (rides.length === 0) return [];

  const buckets = new Map<string, number>();
  let min = new Date(rides[0].start_time);
  let max = new Date(rides[0].start_time);

  for (const ride of rides) {
    const d = new Date(ride.start_time);
    if (d < min) min = d;
    if (d > max) max = d;
    const key = periodKey(d, g);
    buckets.set(key, (buckets.get(key) ?? 0) + metricValue(ride, metric));
  }

  const points: SeriesPoint[] = [];
  const last = periodStart(max, g);
  let cursor = periodStart(min, g);

  while (cursor <= last) {
    const value = buckets.get(dayKey(cursor)) ?? 0;
    points.push({ label: periodLabel(cursor, g), value: Math.round(value * 10) / 10 });
    cursor = nextPeriod(cursor, g);
  }

  return points;
}

export type Summary = {
  totalKm: number;
  yearKm: number;
  monthKm: number;
  weekKm: number;
  count: number;
  totalDurationS: number;
  totalElevationM: number;
  avgKmPerRide: number;
  longest: Ride | null;
  bestDayKm: number;
  bestDayLabel: string;
  avgSpeedKmh: number | null;
};

export function summarize(rides: Ride[]): Summary {
  const now = new Date();
  const weekStart = startOfWeek(now);

  let totalM = 0;
  let yearM = 0;
  let monthM = 0;
  let weekM = 0;
  let durationS = 0;
  let elevationM = 0;
  let distWithDuration = 0;
  let timeWithDuration = 0;
  let longest: Ride | null = null;
  const perDay = new Map<string, number>();

  for (const ride of rides) {
    const d = new Date(ride.start_time);
    totalM += ride.distance_m;
    if (d.getFullYear() === now.getFullYear()) yearM += ride.distance_m;
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
      monthM += ride.distance_m;
    }
    if (d >= weekStart) weekM += ride.distance_m;

    if (ride.duration_s && ride.duration_s > 0) {
      durationS += ride.duration_s;
      distWithDuration += ride.distance_m;
      timeWithDuration += ride.duration_s;
    }
    elevationM += ride.elevation_gain_m ?? 0;

    if (longest === null || ride.distance_m > longest.distance_m) longest = ride;

    const key = dayKey(d);
    perDay.set(key, (perDay.get(key) ?? 0) + ride.distance_m);
  }

  let bestDayM = 0;
  let bestDayKey = "";
  for (const [key, value] of perDay) {
    if (value > bestDayM) {
      bestDayM = value;
      bestDayKey = key;
    }
  }

  let bestDayLabel = "";
  if (bestDayKey) {
    const parts = bestDayKey.split("-");
    const day = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    bestDayLabel = day.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  return {
    totalKm: totalM / 1000,
    yearKm: yearM / 1000,
    monthKm: monthM / 1000,
    weekKm: weekM / 1000,
    count: rides.length,
    totalDurationS: durationS,
    totalElevationM: elevationM,
    avgKmPerRide: rides.length > 0 ? totalM / 1000 / rides.length : 0,
    longest,
    bestDayKm: bestDayM / 1000,
    bestDayLabel,
    avgSpeedKmh: timeWithDuration > 0 ? (distWithDuration / timeWithDuration) * 3.6 : null,
  };
}

export type CumulativeRow = { month: string } & Record<string, number | string | null>;

// Kilomètres cumulés mois par mois, une courbe par année
export function cumulativeByYear(rides: Ride[]): { rows: CumulativeRow[]; years: number[] } {
  const perYear = new Map<number, number[]>();

  for (const ride of rides) {
    const d = new Date(ride.start_time);
    const year = d.getFullYear();
    if (!perYear.has(year)) perYear.set(year, new Array(12).fill(0));
    const months = perYear.get(year) as number[];
    months[d.getMonth()] += ride.distance_m / 1000;
  }

  const years = Array.from(perYear.keys()).sort((a, b) => a - b);
  const now = new Date();
  const rows: CumulativeRow[] = [];

  for (let m = 0; m < 12; m++) {
    const row: CumulativeRow = { month: MONTH_SHORT[m] };
    for (const year of years) {
      const months = perYear.get(year) as number[];
      const isFuture = year === now.getFullYear() && m > now.getMonth();
      if (isFuture) {
        row[String(year)] = null;
      } else {
        let sum = 0;
        for (let i = 0; i <= m; i++) sum += months[i];
        row[String(year)] = Math.round(sum * 10) / 10;
      }
    }
    rows.push(row);
  }

  return { rows, years };
}
