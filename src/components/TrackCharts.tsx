"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = {
  d: number;
  t: number | null;
  ele: number | null;
  speed: number | null;
  hr: number | null;
  lat: number;
  lon: number;
};

type Profile = {
  points: Point[];
  hasEle: boolean;
  hasSpeed: boolean;
  hasHr: boolean;
};

type Props = {
  activityId: string | number;
  onHover: (position: { lat: number; lon: number } | null) => void;
};

const AXIS_TICK = { fill: "#a1a1aa", fontSize: 12 };
const TOOLTIP_STYLE = {
  background: "#0e1219",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#e4e4e7",
};

function stats(values: (number | null)[]) {
  const list = values.filter((v): v is number => v !== null);
  if (list.length === 0) return null;
  const sum = list.reduce((a, b) => a + b, 0);
  return { min: Math.min(...list), max: Math.max(...list), avg: sum / list.length };
}

function fmt(n: number, digits = 0): string {
  return n.toFixed(digits).replace(".", ",");
}

type BlockProps = {
  title: string;
  summary: string;
  data: Point[];
  dataKey: "ele" | "speed" | "hr";
  color: string;
  unit: string;
  gradientId: string;
  onIndex: (index: number | null) => void;
};

function ChartBlock({ title, summary, data, dataKey, color, unit, gradientId, onIndex }: BlockProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-zinc-400">{summary}</div>
      </div>
      <div className="mt-2 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            syncId="track"
            onMouseMove={(state: unknown) => {
              const raw = (state as { activeTooltipIndex?: unknown } | null)?.activeTooltipIndex;
              const index = Number(raw);
              onIndex(raw !== undefined && raw !== null && Number.isFinite(index) ? index : null);
            }}
            onMouseLeave={() => onIndex(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="d"
              type="number"
              domain={[0, "dataMax"]}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${Math.round(Number(v))} km`}
              minTickGap={32}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(label) => `${Number(label).toFixed(1).replace(".", ",")} km`}
              formatter={(v) => `${v} ${unit}`}
              separator=" : "
              labelStyle={{ color: "#a1a1aa" }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              name={title}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function TrackCharts({ activityId, onHover }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/activities/${activityId}/track`)
      .then(async (res) => {
        if (!res.ok) throw new Error("track");
        setProfile(await res.json());
      })
      .catch(() => setFailed(true));
  }, [activityId]);

  const eleStats = useMemo(() => (profile ? stats(profile.points.map((p) => p.ele)) : null), [profile]);
  const speedStats = useMemo(() => (profile ? stats(profile.points.map((p) => p.speed)) : null), [profile]);
  const hrStats = useMemo(() => (profile ? stats(profile.points.map((p) => p.hr)) : null), [profile]);

  function handleIndex(index: number | null) {
    if (index === null || !profile) {
      onHover(null);
      return;
    }
    const point = profile.points[index];
    onHover(point ? { lat: point.lat, lon: point.lon } : null);
  }

  if (failed) {
    return <p className="mt-5 text-sm text-zinc-500">Profil indisponible pour cette sortie.</p>;
  }
  if (!profile) {
    return <p className="mt-5 text-sm text-zinc-500">Chargement des courbes…</p>;
  }
  if (!profile.hasEle && !profile.hasSpeed && !profile.hasHr) {
    return <p className="mt-5 text-sm text-zinc-500">Ce fichier ne contient pas de données de profil.</p>;
  }

  return (
    <div className="mt-5 grid gap-3">
      {profile.hasEle && eleStats && (
        <ChartBlock
          title="Altitude"
          summary={`min ${fmt(eleStats.min)} m · max ${fmt(eleStats.max)} m`}
          data={profile.points}
          dataKey="ele"
          color="#2dd4bf"
          unit="m"
          gradientId="grad-ele"
          onIndex={handleIndex}
        />
      )}
      {profile.hasSpeed && speedStats && (
        <ChartBlock
          title="Vitesse"
          summary={`moyenne ${fmt(speedStats.avg, 1)} km/h · max ${fmt(speedStats.max, 1)} km/h`}
          data={profile.points}
          dataKey="speed"
          color="#fb923c"
          unit="km/h"
          gradientId="grad-speed"
          onIndex={handleIndex}
        />
      )}
      {profile.hasHr && hrStats && (
        <ChartBlock
          title="Fréquence cardiaque"
          summary={`moyenne ${fmt(hrStats.avg)} bpm · max ${fmt(hrStats.max)} bpm`}
          data={profile.points}
          dataKey="hr"
          color="#f472b6"
          unit="bpm"
          gradientId="grad-hr"
          onIndex={handleIndex}
        />
      )}
    </div>
  );
}
