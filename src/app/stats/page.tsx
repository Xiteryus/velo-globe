"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colorForYear } from "@/lib/colors";
import { formatDuration, formatKm } from "@/lib/format";
import {
  buildSeries,
  cumulativeByYear,
  summarize,
  type Granularity,
  type Metric,
  type Ride,
} from "@/lib/stats";

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: "distance", label: "Kilomètres", unit: "km" },
  { id: "rides", label: "Sorties", unit: "sorties" },
  { id: "elevation", label: "Dénivelé", unit: "m" },
  { id: "duration", label: "Temps sur le vélo", unit: "h" },
];

const GRANULARITIES: { id: Granularity; label: string }[] = [
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
  { id: "year", label: "Année" },
];

const AXIS_TICK = { fill: "#a1a1aa", fontSize: 12 };
const TOOLTIP_STYLE = {
  background: "#0e1219",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#e4e4e7",
};

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-xl font-medium">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-full px-3 py-1 text-sm transition-colors ${
            value === o.id ? "bg-teal-400 text-black" : "text-zinc-300 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function km0(n: number): string {
  return Math.round(n).toLocaleString("fr-FR") + " km";
}

export default function StatsPage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [metric, setMetric] = useState<Metric>("distance");
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [year, setYear] = useState("all");

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => {
        setRides(d.activities);
        setLoaded(true);
      });
  }, []);

  const summary = useMemo(() => summarize(rides), [rides]);
  const cumulative = useMemo(() => cumulativeByYear(rides), [rides]);

  const years = useMemo(() => {
    const set = new Set(rides.map((r) => new Date(r.start_time).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [rides]);

  const filtered = useMemo(
    () => (year === "all" ? rides : rides.filter((r) => new Date(r.start_time).getFullYear() === Number(year))),
    [rides, year]
  );

  const series = useMemo(() => buildSeries(filtered, metric, granularity), [filtered, metric, granularity]);
  const current = METRICS.find((m) => m.id === metric) ?? METRICS[0];

  if (loaded && rides.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-medium">Statistiques</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Aucune sortie pour l&apos;instant.{" "}
          <Link href="/import" className="text-teal-300">
            Importe des fichiers GPX ou FIT
          </Link>{" "}
          pour voir tes statistiques.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-medium">Statistiques</h1>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Distance totale" value={km0(summary.totalKm)} />
        <Card label="Cette année" value={km0(summary.yearKm)} />
        <Card label="Ce mois-ci" value={km0(summary.monthKm)} />
        <Card label="Cette semaine" value={km0(summary.weekKm)} />
        <Card label="Sorties" value={String(summary.count)} />
        <Card label="Temps sur le vélo" value={formatDuration(summary.totalDurationS)} />
        <Card label="Dénivelé cumulé" value={Math.round(summary.totalElevationM).toLocaleString("fr-FR") + " m"} />
        <Card
          label="Vitesse moyenne globale"
          value={summary.avgSpeedKmh ? summary.avgSpeedKmh.toFixed(1).replace(".", ",") + " km/h" : "–"}
        />
        <Card label="Distance moyenne par sortie" value={summary.avgKmPerRide.toFixed(1).replace(".", ",") + " km"} />
        <Card
          label="Plus longue sortie"
          value={summary.longest ? formatKm(summary.longest.distance_m) : "–"}
          hint={summary.longest?.name}
        />
        <Card
          label="Plus grande distance en un jour"
          value={summary.bestDayKm.toFixed(1).replace(".", ",") + " km"}
          hint={summary.bestDayLabel}
        />
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Évolution</h2>
          <div className="flex flex-wrap gap-3">
            <Pills options={METRICS} value={metric} onChange={setMetric} />
            <Pills options={GRANULARITIES} value={granularity} onChange={setGranularity} />
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0e1219] px-3 py-1.5 text-sm"
            >
              <option value="all">Toutes les années</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 h-80 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                formatter={(v) => `${v} ${current.unit}`}
                separator=" : "
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Bar dataKey="value" name={current.label} fill="#2dd4bf" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Comparer les années (kilomètres cumulés)</h2>
        <div className="mt-4 h-80 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulative.rows}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v) => `${v} km`}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Legend />
              {cumulative.years.map((y) => (
                <Line
                  key={y}
                  type="monotone"
                  dataKey={String(y)}
                  stroke={colorForYear(y)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}
