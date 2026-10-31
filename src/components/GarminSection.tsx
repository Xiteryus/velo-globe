"use client";

import { useCallback, useEffect, useState } from "react";

type Status = { hasKey: boolean; lastSync: string | null };

type Report = {
  since: string;
  found: number;
  cycling: number;
  added: number;
  duplicates: number;
  skipped: number;
  errors: string[];
};

type TestItem = {
  id: string;
  name: string | null;
  typeKey: string | null;
  startLocal: string | null;
};

const buttonClass =
  "rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-50";

export default function GarminSection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [testItems, setTestItems] = useState<TestItem[] | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/garmin");
    setStatus(await res.json());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function saveKey() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/garmin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await res.json();
    if (res.ok) {
      setKey("");
      setMessage("Clé enregistrée et validée par Garmin.");
    } else {
      setMessage("Erreur : " + data.error);
    }
    setBusy(false);
    refresh();
  }

  async function removeKey() {
    if (!window.confirm("Supprimer la clé Garmin enregistrée ?")) return;
    await fetch("/api/garmin", { method: "DELETE" });
    setReport(null);
    setTestItems(null);
    setMessage("Clé supprimée.");
    refresh();
  }

  async function test() {
    setBusy(true);
    setMessage("");
    setTestItems(null);
    const res = await fetch("/api/garmin/test", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setTestItems(data.items);
      setMessage(`Connexion OK : ${data.items.length} activité(s) récente(s) lue(s).`);
    } else {
      setMessage("Erreur : " + data.error);
    }
    setBusy(false);
  }

  async function sync(mode: "last" | "year" | "all") {
    if (mode === "all" && !window.confirm("Importer tout l'historique peut prendre plusieurs minutes. Continuer ?")) {
      return;
    }
    setBusy(true);
    setMessage(mode === "all" ? "Synchronisation en cours, ne ferme pas cette page…" : "Synchronisation en cours…");
    setReport(null);
    const res = await fetch("/api/garmin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = await res.json();
    if (res.ok) {
      setReport(data);
      setMessage("Synchronisation terminée.");
    } else {
      setMessage("Erreur : " + data.error);
    }
    setBusy(false);
    refresh();
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium">Garmin Connect</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Accès en lecture seule à tes propres activités via la clé d&apos;API personnelle de Garmin. La clé
        reste sur ton ordinateur et n&apos;est jamais renvoyée au navigateur.
      </p>

      {status && !status.hasKey && (
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Colle ta clé d'API personnelle"
            autoComplete="off"
            className="min-w-72 flex-1 rounded-lg border border-white/10 bg-[#0e1219] px-3 py-2 text-sm outline-none focus:border-teal-300/60"
          />
          <button
            onClick={saveKey}
            disabled={busy || key.trim().length < 10}
            className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-medium text-black hover:bg-teal-300 disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      )}

      {status && status.hasKey && (
        <div className="mt-4">
          <div className="text-sm text-zinc-300">
            Clé enregistrée.{" "}
            {status.lastSync
              ? "Dernière synchronisation : " +
                new Date(status.lastSync).toLocaleString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Aucune synchronisation pour l'instant."}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={test} disabled={busy} className={buttonClass}>
              Tester la connexion
            </button>
            <button onClick={() => sync("last")} disabled={busy} className={buttonClass}>
              Synchroniser les nouveautés
            </button>
            <button onClick={() => sync("year")} disabled={busy} className={buttonClass}>
              Importer les 12 derniers mois
            </button>
            <button onClick={() => sync("all")} disabled={busy} className={buttonClass}>
              Importer tout l&apos;historique
            </button>
            <button onClick={removeKey} disabled={busy} className={buttonClass}>
              Supprimer la clé
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm">{message}</div>
      )}

      {testItems && (
        <ul className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10 text-sm">
          {testItems.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 px-4 py-2">
              <span className="truncate">{i.name ?? "(sans nom)"}</span>
              <span className="shrink-0 text-zinc-400">
                {i.typeKey ?? "type inconnu"} · {i.startLocal ?? "date inconnue"}
              </span>
            </li>
          ))}
          {testItems.length === 0 && <li className="px-4 py-2 text-zinc-500">Aucune activité.</li>}
        </ul>
      )}

      {report && (
        <div className="mt-3 rounded-xl border border-white/10 px-4 py-3 text-sm">
          <div>
            {report.added} ajoutée(s), {report.duplicates} déjà présente(s), {report.skipped} ignorée(s) (autres
            sports ou sans tracé GPS), {report.errors.length} erreur(s) sur {report.found} activité(s) trouvée(s)
            depuis le {report.since}.
          </div>
          {report.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-rose-300">
              {report.errors.slice(0, 10).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
