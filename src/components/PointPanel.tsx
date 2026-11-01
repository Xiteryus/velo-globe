"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RADII, type PointAnalysis, type PointPass } from "@/lib/analysis/types";

type Props = {
  analysis: PointAnalysis | null;
  loading: boolean;
  error: string;
  radius: number;
  onRadius: (radius: number) => void;
  onClose: () => void;
};

export const DIRECTION_COLORS = ["#2dd4bf", "#fb923c", "#f472b6", "#60a5fa", "#a3e635", "#facc15"];
const UNKNOWN_COLOR = "#71717a";
const AXIS_TICK = { fill: "#a1a1aa", fontSize: 11 };

function colorOf(directionId: string | null): string {
  if (directionId === null) return UNKNOWN_COLOR;
  const index = "ABCDEFGH".indexOf(directionId);
  return DIRECTION_COLORS[index >= 0 ? index % DIRECTION_COLORS.length : 0];
}

function fmt1(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

function when(p: PointPass): number {
  return p.timeMs ?? Date.parse(p.startTime);
}

function formatWhen(p: PointPass): string {
  if (p.timeMs !== null) {
    return new Date(p.timeMs).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return (
    new Date(p.startTime).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) + " (heure inconnue)"
  );
}

export default function PointPanel({ analysis, loading, error, radius, onRadius, onClose }: Props) {
  const [sortBy, setSortBy] = useState<"date" | "speed">("date");

  const bestByDirection = useMemo(() => {
    const map = new Map<string, number>();
    if (!analysis) return map;
    for (const d of analysis.directions) {
      if (d.bestSpeedKmh !== null) map.set(d.id, d.bestSpeedKmh);
    }
    return map;
  }, [analysis]);

  const chartData = useMemo(() => {
    if (!analysis) return [];
    return analysis.passes
      .filter((p) => p.speedKmh !== null)
      .sort((a, b) => when(a) - when(b))
      .map((p) => ({
        label: new Date(when(p)).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }),
        speed: p.speedKmh as number,
        color: colorOf(p.directionId),
        name: p.name,
      }));
  }, [analysis]);

  const sorted = useMemo(() => {
    if (!analysis) return [];
    const list = [...analysis.passes];
    if (sortBy === "speed") {
      list.sort((a, b) => (b.speedKmh ?? -1) - (a.speedKmh ?? -1));
    } else {
      list.sort((a, b) => when(b) - when(a));
    }
    return list;
  }, [analysis, sortBy]);

  return (
    <aside className="absolute bottom-28 right-6 top-20 z-10 flex w-96 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0d13]/90 backdrop-blur">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-base font-medium">Analyse d&apos;un point</div>
          {analysis && (
            <div className="text-xs text-zinc-500">
              {analysis.lat.toFixed(5)}, {analysis.lon.toFixed(5)}
            </div>
          )}
        </div>
        <button onClick={onClose} aria-label="Fermer" className="text-zinc-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="flex gap-1 px-4 pt-3">
        {RADII.map((r) => (
          <button
            key={r}
            onClick={() => onRadius(r)}
            className={`rounded-full px-3 py-1 text-sm ${
              radius === r ? "bg-teal-400 text-black" : "border border-white/10 text-zinc-300 hover:text-white"
            }`}
          >
            {r} m
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
        {error && <div className="text-sm text-rose-300">{error}</div>}
        {loading && !analysis && <div className="text-sm text-zinc-400">Analyse en cours…</div>}

        {analysis && (
          <div className={loading ? "opacity-60" : ""}>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-xl font-medium">{analysis.totalPasses}</div>
                <div className="text-xs text-zinc-400">passage{analysis.totalPasses > 1 ? "s" : ""}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-xl font-medium">{analysis.activityCount}</div>
                <div className="text-xs text-zinc-400">sortie{analysis.activityCount > 1 ? "s" : ""}</div>
              </div>
            </div>

            {analysis.totalPasses === 0 && (
              <p className="mt-3 text-sm text-zinc-400">
                Aucune sortie n&apos;est passée à moins de {analysis.radius} m. Zoome davantage avant de cliquer, ou
                augmente le rayon.
              </p>
            )}

            {analysis.directions.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Sens de circulation</div>
                <ul className="space-y-1.5">
                  {analysis.directions.map((d) => (
                    <li key={d.id} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span
                            className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium text-black"
                            style={{ background: colorOf(d.id) }}
                          >
                            {d.id}
                          </span>
                          {d.label}
                        </span>
                        <span className="text-zinc-400">
                          {d.count} passage{d.count > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">
                        {d.avgSpeedKmh !== null && d.bestSpeedKmh !== null
                          ? `Vitesse moyenne ${fmt1(d.avgSpeedKmh)} km/h · meilleure ${fmt1(d.bestSpeedKmh)} km/h`
                          : "Pas de vitesse disponible"}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {chartData.length > 1 && (
              <div className="mt-4">
                <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                  Vitesse à chaque passage
                </div>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={20} />
                      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} />
                      <Tooltip
                        contentStyle={{
                          background: "#0e1219",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12,
                          color: "#e4e4e7",
                        }}
                        cursor={{ fill: "rgba(255,255,255,0.05)" }}
                        formatter={(v) => `${v} km/h`}
                        separator=" : "
                        labelStyle={{ color: "#a1a1aa" }}
                      />
                      <Bar dataKey="speed" name="Vitesse" radius={[3, 3, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {analysis.passes.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Passages</div>
                  <div className="flex gap-1 text-xs">
                    <button
                      onClick={() => setSortBy("date")}
                      className={sortBy === "date" ? "text-teal-300" : "text-zinc-400 hover:text-white"}
                    >
                      Date
                    </button>
                    <span className="text-zinc-600">·</span>
                    <button
                      onClick={() => setSortBy("speed")}
                      className={sortBy === "speed" ? "text-teal-300" : "text-zinc-400 hover:text-white"}
                    >
                      Vitesse
                    </button>
                  </div>
                </div>
                <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
                  {sorted.map((p, index) => {
                    const best = p.directionId ? bestByDirection.get(p.directionId) : undefined;
                    let delta = "";
                    if (p.speedKmh !== null && best !== undefined) {
                      delta = p.speedKmh >= best ? "meilleur" : "−" + fmt1(best - p.speedKmh);
                    }
                    return (
                      <li key={p.activityId + "-" + index} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium text-black"
                          style={{ background: colorOf(p.directionId) }}
                          title={p.directionId ? "Sens " + p.directionId : "Sens indéterminé"}
                        >
                          {p.directionId ?? "?"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link href={`/history/${p.activityId}`} className="block truncate hover:text-teal-300">
                            {p.name}
                          </Link>
                          <div className="text-xs text-zinc-500">{formatWhen(p)}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div>{p.speedKmh !== null ? fmt1(p.speedKmh) + " km/h" : "–"}</div>
                          {delta && <div className="text-xs text-zinc-500">{delta}</div>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
