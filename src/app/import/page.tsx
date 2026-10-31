"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";

type Result = {
  filename: string;
  status: "added" | "duplicate" | "error";
  id?: number;
  reason?: string;
};

const LABELS = {
  added: "Ajoutée",
  duplicate: "Déjà présente",
  error: "Erreur",
};

const COLORS = {
  added: "text-emerald-400",
  duplicate: "text-amber-400",
  error: "text-rose-400",
};

const BATCH_SIZE = 5;

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => /\.(gpx|fit)$/i.test(f.name));
    if (list.length === 0) {
      setResults([{ filename: "–", status: "error", reason: "Aucun fichier .gpx ou .fit" }]);
      return;
    }

    setBusy(true);
    const collected: Result[] = [];

    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      const batch = list.slice(i, i + BATCH_SIZE);
      const form = new FormData();
      for (const file of batch) {
        form.append("files", file);
      }
      try {
        const res = await fetch("/api/import", { method: "POST", body: form });
        const data = await res.json();
        collected.push(...(data.results ?? []));
      } catch {
        for (const file of batch) {
          collected.push({ filename: file.name, status: "error", reason: "Échec de l'envoi" });
        }
      }
    }

    setResults(collected);
    setBusy(false);
  }

  const added = results.filter((r) => r.status === "added").length;
  const duplicates = results.filter((r) => r.status === "duplicate").length;
  const errors = results.filter((r) => r.status === "error").length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-medium">Importation</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Dépose tes fichiers GPX ou FIT. Les doublons sont détectés automatiquement.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-8 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 transition-colors ${
          dragging ? "border-teal-300 bg-teal-300/5" : "border-white/20 hover:border-white/40"
        }`}
      >
        <Upload size={32} className="text-zinc-400" />
        <div className="mt-4 text-base">
          {busy ? "Import en cours…" : "Glisse tes fichiers ici ou clique pour choisir"}
        </div>
        <div className="mt-1 text-sm text-zinc-500">.gpx et .fit, plusieurs fichiers possibles</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".gpx,.fit"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {results.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 text-sm text-zinc-300">
            {added} ajoutée{added > 1 ? "s" : ""}, {duplicates} déjà présente
            {duplicates > 1 ? "s" : ""}, {errors} erreur{errors > 1 ? "s" : ""}
          </div>
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
            {results.map((r, index) => (
              <li key={r.filename + index} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="truncate">{r.filename}</span>
                <span className={`shrink-0 ${COLORS[r.status]}`}>
                  {LABELS[r.status]}
                  {r.reason ? " : " + r.reason : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
