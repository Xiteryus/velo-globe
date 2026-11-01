"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ActivityGeo } from "@/lib/types";
import TrackCharts from "@/components/TrackCharts";
import { formatDate, formatDuration, formatElevation, formatKm, formatSpeed } from "@/lib/format";

const Globe = dynamic(() => import("@/components/globe/Globe"), { ssr: false });

type Detail = ActivityGeo & {
  description: string | null;
  sport: string | null;
  moving_time_s: number | null;
  max_speed_ms: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-lg font-medium">{value}</div>
    </div>
  );
}

export default function ActivityPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [activity, setActivity] = useState<Detail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [marker, setMarker] = useState<{ lon: number; lat: number } | null>(null);

  useEffect(() => {
    fetch(`/api/activities/${params.id}`).then(async (res) => {
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setActivity(data.activity);
      setName(data.activity.name);
      setDescription(data.activity.description ?? "");
    });
  }, [params.id]);

  const forGlobe = useMemo(() => (activity ? [activity] : []), [activity]);

  async function save() {
    const res = await fetch(`/api/activities/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    setStatus(res.ok ? "Enregistré" : "Échec de l'enregistrement");
    setTimeout(() => setStatus(""), 2500);
  }

  async function remove() {
    if (!window.confirm("Supprimer définitivement cette sortie ?")) return;
    const res = await fetch(`/api/activities/${params.id}`, { method: "DELETE" });
    if (res.ok) router.push("/history");
  }

  if (notFound) {
    return (
      <main className="px-6 py-10">
        <p>Sortie introuvable.</p>
        <Link href="/history" className="text-teal-300">
          Retour à l&apos;historique
        </Link>
      </main>
    );
  }

  if (!activity) {
    return <main className="px-6 py-10 text-zinc-400">Chargement…</main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/history" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Historique
      </Link>

      <div className="mt-3 text-sm text-zinc-400">{formatDate(activity.start_time)}</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 w-full bg-transparent text-2xl font-medium outline-none focus:border-b focus:border-teal-300/60"
      />

      <div className="mt-5 h-[420px] overflow-hidden rounded-2xl border border-white/10">
        <Globe activities={forGlobe} selectedId={null} onSelect={() => {}} marker={marker} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Distance" value={formatKm(activity.distance_m)} />
        <Stat label="Durée" value={formatDuration(activity.duration_s)} />
        <Stat label="Vitesse moyenne" value={formatSpeed(activity.avg_speed_ms)} />
        <Stat label="Vitesse maximale" value={formatSpeed(activity.max_speed_ms)} />
        <Stat label="Dénivelé positif" value={formatElevation(activity.elevation_gain_m)} />
        <Stat label="Temps en mouvement" value={formatDuration(activity.moving_time_s)} />
        <Stat label="FC moyenne" value={activity.avg_hr ? activity.avg_hr + " bpm" : "–"} />
        <Stat label="Calories" value={activity.calories ? activity.calories + " kcal" : "–"} />
      </div>

      <TrackCharts activityId={params.id} onHover={setMarker} />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description ou commentaires personnels"
        rows={4}
        className="mt-5 w-full rounded-xl border border-white/10 bg-[#0e1219] p-3 text-sm outline-none focus:border-teal-300/60"
      />

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-medium text-black hover:bg-teal-300"
        >
          Enregistrer
        </button>
        <button
          onClick={remove}
          className="rounded-lg border border-rose-400/50 px-4 py-2 text-sm text-rose-300 hover:bg-rose-400/10"
        >
          Supprimer
        </button>
        <span className="text-sm text-zinc-400">{status}</span>
      </div>
    </main>
  );
}
