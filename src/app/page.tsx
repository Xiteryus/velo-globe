"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { ActivityGeo } from "@/lib/types";
import { colorForYear, yearOf } from "@/lib/colors";

const Globe = dynamic(() => import("@/components/globe/Globe"), { ssr: false });

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "–";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

export default function Home() {
  const [activities, setActivities] = useState<ActivityGeo[]>([]);
  const [hiddenYears, setHiddenYears] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/activities")
      .then((r) => r.json())
      .then((d) => setActivities(d.activities));
  }, []);

  const years = useMemo(() => {
    const set = new Set(activities.map((a) => yearOf(a.start_time)));
    return Array.from(set).sort((x, y) => y - x);
  }, [activities]);

  const visible = useMemo(
    () => activities.filter((a) => !hiddenYears.includes(yearOf(a.start_time))),
    [activities, hiddenYears]
  );

  const selected = visible.find((a) => a.id === selectedId) ?? null;
  const totalKm = visible.reduce((sum, a) => sum + a.distance_m, 0) / 1000;

  function toggleYear(year: number) {
    setHiddenYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  }

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#05070b] text-zinc-100">
      <div className="absolute inset-0">
        <Globe activities={visible} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      <div className="pointer-events-none absolute left-6 top-5">
        <div className="text-lg font-medium">Mes parcours</div>
        <div className="text-sm text-zinc-400">
          {visible.length} sortie{visible.length > 1 ? "s" : ""}
        </div>
      </div>

      <div className="absolute right-6 top-5 flex gap-2">
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

      {selected && (
        <div className="absolute bottom-8 left-6 w-72 rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur">
          <div className="text-xs text-zinc-400">
            {new Date(selected.start_time).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
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
              <div className="text-lg font-medium">
                {selected.elevation_gain_m !== null
                  ? Math.round(selected.elevation_gain_m) + " m"
                  : "–"}
              </div>
              <div className="text-xs text-zinc-400">D+</div>
            </div>
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
