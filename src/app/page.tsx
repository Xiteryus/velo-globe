"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import PointPanel from "@/components/PointPanel";
import type { PointAnalysis } from "@/lib/analysis/types";
import type { ActivityGeo } from "@/lib/types";
import { colorForYear, yearOf } from "@/lib/colors";
import { buildHeatmap } from "@/lib/heatmap";
import { formatDate, formatDuration, formatElevation } from "@/lib/format";

const Globe = dynamic(() => import("@/components/globe/Globe"), { ssr: false });

type Mode = "routes" | "heat" | "point";

const MODES: { id: Mode; label: string }[] = [
  { id: "routes", label: "Parcours" },
  { id: "heat", label: "Chaleur" },
  { id: "point", label: "Point" },
];

export default function Home() {
  const [activities, setActivities] = useState<ActivityGeo[]>([]);
  const [hiddenYears, setHiddenYears] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("routes");

  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [radius, setRadius] = useState(25);
  const [analysis, setAnalysis] = useState<PointAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/activities")
      .then((r) => r.json())
      .then((d) => setActivities(d.activities));
  }, []);

  // Analyse du point sélectionné
  useEffect(() => {
    if (mode !== "point" || !point) return;

    const controller = new AbortController();
    setLoading(true);
    setError("");

    fetch("/api/analysis/point", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: point.lat, lon: point.lon, radius }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erreur d'analyse");
        setAnalysis(data.analysis);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [mode, point, radius]);

  const years = useMemo(() => {
    const set = new Set(activities.map((a) => yearOf(a.start_time)));
    return Array.from(set).sort((x, y) => y - x);
  }, [activities]);

  const visible = useMemo(
    () => activities.filter((a) => !hiddenYears.includes(yearOf(a.start_time))),
    [activities, hiddenYears]
  );

  const heat = useMemo(() => (mode === "heat" ? buildHeatmap(visible) : null), [mode, visible]);

  const highlightIds = useMemo(
    () => (analysis ? Array.from(new Set(analysis.passes.map((p) => p.activityId))) : []),
    [analysis]
  );

  const selected = visible.find((a) => a.id === selectedId) ?? null;
  const totalKm = visible.reduce((sum, a) => sum + a.distance_m, 0) / 1000;

  function toggleYear(year: number) {
    setHiddenYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  }

  function changeMode(next: Mode) {
    setMode(next);
    setSelectedId(null);
    if (next !== "point") closeAnalysis();
  }

  function closeAnalysis() {
    setPoint(null);
    setAnalysis(null);
    setError("");
    setLoading(false);
  }

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#05070b] text-zinc-100">
      <div className="absolute inset-0">
        <Globe
          activities={visible}
          selectedId={mode === "routes" ? selectedId : null}
          onSelect={setSelectedId}
          showRoutes={mode !== "heat"}
          heatmap={heat}
          pickMode={mode === "point"}
          onPick={setPoint}
          analysis={mode === "point" && point ? { ...point, radius } : null}
          highlightIds={mode === "point" ? highlightIds : undefined}
        />
      </div>

      <div className="pointer-events-none absolute left-6 top-5">
        <div className="text-lg font-medium">Mes parcours</div>
        <div className="text-sm text-zinc-400">
          {visible.length} sortie{visible.length > 1 ? "s" : ""}
        </div>
      </div>

      <div className="absolute right-6 top-5 z-20 flex flex-wrap items-center justify-end gap-2">
        <div className="flex gap-1 rounded-full border border-white/10 bg-black/60 p-1 backdrop-blur">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => changeMode(m.id)}
              className={`rounded-full px-3 py-1 text-sm ${
                mode === m.id ? "bg-teal-400 text-black" : "text-zinc-300 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {years.map((year) => {
          const hidden = hiddenYears.includes(year);
          const color = colorForYear(year);
          return (
            <button
              key={year}
              onClick={() => toggleYear(year)}
              style={{ borderColor: color, color: hidden ? "#71717a" : color }}
              className={`rounded-full border bg-black/60 px-3 py-1 text-sm backdrop-blur ${
                hidden ? "opacity-50" : ""
              }`}
            >
              {year}
            </button>
          );
        })}
      </div>

      {mode === "point" && !point && (
        <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-sm backdrop-blur">
          Clique sur la carte (zoome sur la route) pour analyser les passages
        </div>
      )}

      {mode === "point" && point && (
        <PointPanel
          analysis={analysis}
          loading={loading}
          error={error}
          radius={radius}
          onRadius={setRadius}
          onClose={closeAnalysis}
        />
      )}

      {mode === "routes" && selected && (
        <div className="absolute bottom-8 left-6 w-72 rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur">
          <div className="text-xs text-zinc-400">{formatDate(selected.start_time)}</div>
          <div className="mb-3 mt-1 text-base font-medium">{selected.name}</div>
          <div className="flex gap-5">
            <div>
              <div className="text-lg font-medium">
                {(selected.distance_m / 1000).toFixed(1)} km
              </div>
              <div className="text-xs text-zinc-400">distance</div>
            </div>
            <div>
              <div className="text-lg font-medium">{formatDuration(selected.duration_s)}</div>
              <div className="text-xs text-zinc-400">durée</div>
            </div>
            <div>
              <div className="text-lg font-medium">{formatElevation(selected.elevation_gain_m)}</div>
              <div className="text-xs text-zinc-400">D+</div>
            </div>
          </div>
          <a
            href={`/history/${selected.id}`}
            className="mt-3 inline-block text-sm text-teal-300 hover:text-teal-200"
          >
            Voir la fiche détaillée
          </a>
        </div>
      )}

      {mode === "heat" && (
        <div className="pointer-events-none absolute bottom-8 left-6 w-64 rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur">
          <div className="text-sm font-medium">Fréquence de passage</div>
          <div
            className="mt-2 h-2.5 rounded-full"
            style={{
              background: "linear-gradient(to right, #3c148c, #c82896, #ff7828, #fff5aa)",
            }}
          />
          <div className="mt-1 flex justify-between text-xs text-zinc-400">
            <span>1 sortie</span>
            <span>le plus fréquent</span>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-8 right-6 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-right backdrop-blur">
        <div className="text-xs text-zinc-400">Distance affichée</div>
        <div className="text-2xl font-medium">{Math.round(totalKm).toLocaleString("fr-FR")} km</div>
      </div>
    </main>
  );
}
