import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
fs.mkdirSync(path.join(DATA_DIR, "activities"), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "backups"), { recursive: true });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS activities (
  id               INTEGER PRIMARY KEY,
  source           TEXT NOT NULL,
  external_id      TEXT,
  file_hash        TEXT NOT NULL UNIQUE,
  file_path        TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  sport            TEXT,
  start_time       TEXT NOT NULL,
  duration_s       INTEGER,
  moving_time_s    INTEGER,
  distance_m       REAL NOT NULL,
  elevation_gain_m REAL,
  avg_speed_ms     REAL,
  max_speed_ms     REAL,
  avg_hr           INTEGER,
  max_hr           INTEGER,
  calories         INTEGER,
  min_lat REAL, min_lon REAL, max_lat REAL, max_lon REAL,
  track_lod        BLOB,
  created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_activities_start ON activities(start_time);

CREATE TABLE IF NOT EXISTS activity_tracks (
  activity_id INTEGER PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
  points      BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY, ran_at TEXT, source TEXT, added INTEGER, status TEXT
);
`;

const globalForDb = globalThis as unknown as { __db?: Database.Database };

function open(): Database.Database {
  const instance = new Database(path.join(DATA_DIR, "velo.db"));
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  instance.exec(SCHEMA);
  return instance;
}

export const db = globalForDb.__db ?? open();
globalForDb.__db = db;