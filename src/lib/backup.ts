import archiver from "archiver";
import extract from "extract-zip";
import fs from "node:fs";
import path from "node:path";
import { db, DATA_DIR } from "./db";

const BACKUP_DIR = path.join(DATA_DIR, "backups");
const ACTIVITIES_DIR = path.join(DATA_DIR, "activities");

export const BACKUP_NAME = /^[A-Za-z0-9._-]+\.zip$/;

export type BackupInfo = {
  name: string;
  size: number;
  created: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function stamp(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${date}-${time}`;
}

export function backupPath(name: string): string | null {
  if (!BACKUP_NAME.test(name)) return null;
  const full = path.join(BACKUP_DIR, name);
  return fs.existsSync(full) ? full : null;
}

export function listBackups(): BackupInfo[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((n) => BACKUP_NAME.test(n))
    .map((n) => {
      const st = fs.statSync(path.join(BACKUP_DIR, n));
      return { name: n, size: st.size, created: st.mtime.toISOString() };
    })
    .sort((a, b) => b.created.localeCompare(a.created));
}

export async function createBackup(label = "velo-backup"): Promise<string> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const name = `${label}-${stamp()}.zip`;
  const zipPath = path.join(BACKUP_DIR, name);
  const snapshot = path.join(BACKUP_DIR, `.snapshot-${Date.now()}.db`);

  // Copie cohérente de la base, même pendant que l'appli tourne
  await db.backup(snapshot);

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 6 } });
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.file(snapshot, { name: "velo.db" });
    if (fs.existsSync(ACTIVITIES_DIR)) {
      archive.directory(ACTIVITIES_DIR, "activities");
    }
    void archive.finalize();
  });

  fs.rmSync(snapshot, { force: true });
  return name;
}

export async function restoreFromZip(
  zipPath: string
): Promise<{ restored: number; safety: string }> {
  const tmp = fs.mkdtempSync(path.join(DATA_DIR, "restore-"));

  try {
    await extract(zipPath, { dir: tmp });

    const dbFile = path.join(tmp, "velo.db");
    if (!fs.existsSync(dbFile)) {
      throw new Error("Archive invalide : velo.db est introuvable");
    }

    // Filet de sécurité avant d'écraser quoi que ce soit
    const safety = await createBackup("avant-restauration");

    db.prepare("ATTACH DATABASE ? AS src").run(dbFile);
    try {
      const run = db.transaction(() => {
        db.exec("DELETE FROM activity_tracks");
        db.exec("DELETE FROM activities");
        db.exec("DELETE FROM settings");
        db.exec("DELETE FROM sync_log");
        db.exec("INSERT INTO activities SELECT * FROM src.activities");
        db.exec("INSERT INTO activity_tracks SELECT * FROM src.activity_tracks");
        db.exec("INSERT INTO settings SELECT * FROM src.settings");
        db.exec("INSERT INTO sync_log SELECT * FROM src.sync_log");
      });
      run();
    } finally {
      db.exec("DETACH DATABASE src");
    }

    const extractedActivities = path.join(tmp, "activities");
    fs.rmSync(ACTIVITIES_DIR, { recursive: true, force: true });
    fs.mkdirSync(ACTIVITIES_DIR, { recursive: true });
    if (fs.existsSync(extractedActivities)) {
      fs.cpSync(extractedActivities, ACTIVITIES_DIR, { recursive: true });
    }

    const row = db.prepare("SELECT COUNT(*) AS n FROM activities").get() as { n: number };
    return { restored: row.n, safety };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
