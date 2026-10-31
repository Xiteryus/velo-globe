"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDate, formatDuration, formatElevation, formatKm, formatSpeed } from "@/lib/format";

type Row = {
  id: number;
  name: string;
  description: string | null;
  start_time: string;
  distance_m: number;
  duration_s: number | null;
  elevation_gain_m: number | null;
  avg_speed_ms: number | null;
};

type SortKey = "date" | "distance" | "duration";

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const selectClass = "rounded-lg border border-white/10 bg-[#0e1219] px-3 py-2 text-sm";

export default function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [descending, setDescending] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => {
        setRows(d.activities);
        setLoaded(true);
      });
  }, []);

  const years = useMemo(() => {
    const set = new Set(rows.map((r) => new Date(r.start_time).getUTCFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      const d = new Date(r.start_time);
      if (year !== "all" && d.getUTCFullYear() !== Number(year)) return false;
      if (month !== "all" && d.getUTCMonth() !== Number(month)) return false;
      if (q) {
        const haystack = (r.name + " " + (r.description ?? "")).toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const value = (r: Row): number => {
      if (sortKey === "distance") return r.distance_m;
      if (sortKey === "duration") return r.duration_s ?? 0;
      return new Date(r.start_time).getTime();
    };

    filtered.sort((a, b) => (descending ? value(b) - value(a) : value(a) - value(b)));
    return filtered;
  }, [rows, query, year, month, sortKey, descending]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-medium">Historique</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {shown.length} sortie{shown.length > 1 ? "s" : ""} sur {rows.length}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une sortie"
          className="min-w-56 flex-1 rounded-lg border border-white/10 bg-[#0e1219] px-3 py-2 text-sm outline-none focus:border-teal-300/60"
        />
        <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass}>
          <option value="all">Toutes les années</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectClass}>
          <option value="all">Tous les mois</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className={selectClass}
        >
          <option value="date">Trier par date</option>
          <option value="distance">Trier par distance</option>
          <option value="duration">Trier par durée</option>
        </select>
        <button onClick={() => setDescending((v) => !v)} className={selectClass}>
          {descending ? "Décroissant" : "Croissant"}
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.9fr_0.7fr] gap-2 border-b border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-400">
          <div>Nom</div>
          <div>Date</div>
          <div>Distance</div>
          <div>Durée</div>
          <div>Vitesse moy.</div>
          <div>D+</div>
        </div>
        {shown.map((r) => (
          <Link
            key={r.id}
            href={`/history/${r.id}`}
            className="grid grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.9fr_0.7fr] gap-2 border-b border-white/5 px-4 py-3 text-sm last:border-b-0 hover:bg-white/5"
          >
            <div className="truncate font-medium">{r.name}</div>
            <div className="text-zinc-300">{formatDate(r.start_time)}</div>
            <div>{formatKm(r.distance_m)}</div>
            <div>{formatDuration(r.duration_s)}</div>
            <div>{formatSpeed(r.avg_speed_ms)}</div>
            <div>{formatElevation(r.elevation_gain_m)}</div>
          </Link>
        ))}
        {loaded && shown.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">
            Aucune sortie ne correspond.
          </div>
        )}
      </div>
    </main>
  );
}
