"use client";
import GarminSection from "@/components/GarminSection";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RotateCcw, Trash2 } from "lucide-react";

type Backup = {
  name: string;
  size: number;
  created: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",") + " Mo";
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const buttonClass =
  "flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10";

export default function SettingsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/backup");
    const data = await res.json();
    setBackups(data.backups);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function create() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/backup", { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? `Sauvegarde créée : ${data.name}` : `Erreur : ${data.error}`);
    setBusy(false);
    refresh();
  }

  async function restore(name: string) {
    const ok = window.confirm(
      "Restaurer cette sauvegarde ? Les données actuelles seront remplacées (une sauvegarde de sécurité est créée avant)."
    );
    if (!ok) return;
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/backup/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setMessage(
      res.ok
        ? `Restauration terminée : ${data.restored} sorties. Sécurité : ${data.safety}`
        : `Erreur : ${data.error}`
    );
    setBusy(false);
    refresh();
  }

  async function restoreFromFile(file: File) {
    const ok = window.confirm(
      `Restaurer depuis « ${file.name} » ? Les données actuelles seront remplacées (une sauvegarde de sécurité est créée avant).`
    );
    if (!ok) return;
    setBusy(true);
    setMessage("");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/backup/restore", { method: "POST", body: form });
    const data = await res.json();
    setMessage(
      res.ok
        ? `Restauration terminée : ${data.restored} sorties. Sécurité : ${data.safety}`
        : `Erreur : ${data.error}`
    );
    setBusy(false);
    refresh();
  }

  async function remove(name: string) {
    if (!window.confirm("Supprimer cette sauvegarde ?")) return;
    await fetch(`/api/backup/${name}`, { method: "DELETE" });
    refresh();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-medium">Paramètres</h1>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Sauvegardes</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Chaque sauvegarde contient la base de données et tes fichiers GPX/FIT d&apos;origine.
            </p>
          </div>
          <button
            onClick={create}
            disabled={busy}
            className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-medium text-black hover:bg-teal-300 disabled:opacity-50"
          >
            {busy ? "En cours…" : "Créer une sauvegarde"}
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm">
            {message}
          </div>
        )}

        <ul className="mt-4 divide-y divide-white/10 rounded-xl border border-white/10">
          {backups.map((b) => (
            <li key={b.name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{b.name}</div>
                <div className="text-xs text-zinc-400">
                  {formatWhen(b.created)} · {formatSize(b.size)}
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`/api/backup/${b.name}`} className={buttonClass}>
                  <Download size={14} /> Télécharger
                </a>
                <button onClick={() => restore(b.name)} disabled={busy} className={buttonClass}>
                  <RotateCcw size={14} /> Restaurer
                </button>
                <button onClick={() => remove(b.name)} disabled={busy} className={buttonClass}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
          {backups.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">Aucune sauvegarde.</li>
          )}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Restaurer depuis un fichier</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Choisis un fichier de sauvegarde (.zip) téléchargé auparavant.
        </p>
        <button onClick={() => fileRef.current?.click()} disabled={busy} className={`${buttonClass} mt-3`}>
          Choisir un fichier .zip
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) restoreFromFile(file);
            e.target.value = "";
          }}
        />
      </section>

      <GarminSection />
    </main>
  );
}
