import { db } from "./db";
import { importFile } from "./import";
import {
  downloadActivityFile,
  isCycling,
  searchActivities,
  setSetting,
} from "./garmin";

export type SyncReport = {
  found: number;
  cycling: number;
  added: number;
  duplicates: number;
  skipped: number;
  errors: string[];
};

const PAGE_SIZE = 50;
const MAX_ACTIVITIES = 5000;
const PAUSE_MS = 300;

const findByExternal = db.prepare("SELECT id FROM activities WHERE external_id = ?");
const linkExternal = db.prepare(
  "UPDATE activities SET external_id = ? WHERE id = ? AND external_id IS NULL"
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function syncGarmin(sinceDate: string): Promise<SyncReport> {
  const started = new Date();
  const endDate = isoDate(new Date(started.getTime() + 24 * 3600 * 1000));

  const report: SyncReport = {
    found: 0,
    cycling: 0,
    added: 0,
    duplicates: 0,
    skipped: 0,
    errors: [],
  };

  let start = 0;
  while (start < MAX_ACTIVITIES) {
    const page = await searchActivities(start, PAGE_SIZE, sinceDate, endDate);
    if (page.length === 0) break;
    report.found += page.length;

    for (const item of page) {
      if (!isCycling(item)) {
        report.skipped += 1;
        continue;
      }
      report.cycling += 1;

      if (findByExternal.get(item.id)) {
        report.duplicates += 1;
        continue;
      }

      try {
        const file = await downloadActivityFile(item.id);
        if (!file) {
          report.skipped += 1;
          continue;
        }

        const result = importFile(file.name, file.data, {
          source: "garmin",
          externalId: item.id,
          name: item.name ?? undefined,
        });

        if (result.status === "added") {
          report.added += 1;
        } else if (result.status === "duplicate") {
          report.duplicates += 1;
          if (result.id !== undefined) linkExternal.run(item.id, result.id);
        } else if (result.reason && result.reason.includes("Aucun tracé GPS")) {
          report.skipped += 1; // par exemple une sortie sur home-trainer
        } else {
          report.errors.push(`${item.id} : ${result.reason ?? "erreur"}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "erreur";
        report.errors.push(`${item.id} : ${message}`);
      }

      await sleep(PAUSE_MS);
    }

    if (page.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }

  setSetting("garmin_last_sync", started.toISOString());
  return report;
}
