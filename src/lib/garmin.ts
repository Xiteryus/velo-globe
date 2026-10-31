import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import extract from "extract-zip";
import { db, DATA_DIR } from "./db";

const BASE = "https://personal.connectapi.garmin.com";
const TOKEN_URL = `${BASE}/personalapitoken-service/personal-api/personal-api-key/token`;
const KEY_DIR = path.join(DATA_DIR, "secrets");
const KEY_FILE = path.join(KEY_DIR, "garmin-personal-key");

export class GarminError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

type Cached = { token: string; expiresAt: number };
const globalForGarmin = globalThis as unknown as { __garminToken?: Cached | null };

export function hasKey(): boolean {
  return fs.existsSync(KEY_FILE);
}

export function saveKey(key: string): void {
  fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(KEY_FILE, key.trim(), { mode: 0o600 });
  globalForGarmin.__garminToken = null;
}

export function deleteKey(): void {
  fs.rmSync(KEY_FILE, { force: true });
  globalForGarmin.__garminToken = null;
}

function readKey(): string {
  if (!hasKey()) throw new GarminError("Aucune clé Garmin enregistrée");
  const key = fs.readFileSync(KEY_FILE, "utf8").trim();
  if (!key) throw new GarminError("La clé Garmin enregistrée est vide");
  return key;
}

function jwtExpiry(token: string): number | null {
  try {
    const part = token.split(".")[1];
    const json = Buffer.from(part, "base64url").toString("utf8");
    const exp = JSON.parse(json).exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

async function getToken(force = false): Promise<string> {
  const nowS = Date.now() / 1000;
  const cached = globalForGarmin.__garminToken;
  if (!force && cached && cached.expiresAt - nowS > 3600) return cached.token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `ApiKey ${readKey()}` },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new GarminError("Clé refusée par Garmin (expirée, supprimée ou incorrecte)", res.status);
    }
    throw new GarminError(`Échange de la clé impossible (HTTP ${res.status})`, res.status);
  }

  const text = (await res.text()).trim();
  let token = text;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "string") {
      token = parsed;
    } else if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const found = obj.access_token ?? obj.accessToken ?? obj.token;
      if (typeof found !== "string") {
        throw new GarminError(
          "Réponse de jeton inattendue (champs : " + Object.keys(obj).join(", ") + ")"
        );
      }
      token = found;
    }
  } catch (err) {
    if (err instanceof GarminError) throw err;
    // ce n'est pas du JSON : on garde le texte brut
  }

  const expiresAt = jwtExpiry(token) ?? nowS + 23 * 3600;
  globalForGarmin.__garminToken = { token, expiresAt };
  return token;
}

async function authedGet(pathAndQuery: string): Promise<Response> {
  let token = await getToken();
  let res = await fetch(BASE + pathAndQuery, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    token = await getToken(true);
    res = await fetch(BASE + pathAndQuery, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  if (!res.ok) {
    throw new GarminError(`Garmin a répondu HTTP ${res.status}`, res.status);
  }
  return res;
}

export async function checkKey(): Promise<void> {
  await getToken(true);
}

export type GarminItem = {
  id: string;
  name: string | null;
  typeKey: string | null;
  startLocal: string | null;
};

function toItem(raw: Record<string, unknown>): GarminItem | null {
  const id = raw.activityId;
  if (typeof id !== "number" && typeof id !== "string") return null;

  let typeKey: string | null = null;
  const type = raw.activityType;
  if (type && typeof type === "object") {
    const key = (type as Record<string, unknown>).typeKey;
    if (typeof key === "string") typeKey = key;
  } else if (typeof type === "string") {
    typeKey = type;
  }

  return {
    id: String(id),
    name: typeof raw.activityName === "string" ? raw.activityName : null,
    typeKey,
    startLocal: typeof raw.startTimeLocal === "string" ? raw.startTimeLocal : null,
  };
}

export async function searchActivities(
  start: number,
  limit: number,
  startDate?: string,
  endDate?: string
): Promise<GarminItem[]> {
  const params = new URLSearchParams();
  params.set("start", String(start));
  params.set("limit", String(limit));
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);

  const res = await authedGet(
    `/activitylist-service/activities/search/activities?${params.toString()}`
  );
  const data: unknown = await res.json();

  let list: unknown[] | null = null;
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const candidate = obj.activities ?? obj.activityList ?? obj.items ?? obj.content;
    if (Array.isArray(candidate)) list = candidate;
    else
      throw new GarminError(
        "Format de liste inattendu (champs : " + Object.keys(obj).join(", ") + ")"
      );
  }
  if (!list) throw new GarminError("Format de liste inattendu");

  const items: GarminItem[] = [];
  for (const entry of list) {
    if (entry && typeof entry === "object") {
      const item = toItem(entry as Record<string, unknown>);
      if (item) items.push(item);
    }
  }
  return items;
}

export function isCycling(item: GarminItem): boolean {
  if (!item.typeKey) return true; // type inconnu : l'import vérifiera le tracé GPS
  const t = item.typeKey.toLowerCase();
  return t.includes("cycling") || t.includes("biking") || t.includes("ride");
}

// Télécharge l'activité (ZIP) et renvoie le fichier FIT ou GPX qu'il contient
export async function downloadActivityFile(
  id: string
): Promise<{ name: string; data: Buffer } | null> {
  const res = await authedGet(`/download-service/files/activity/${encodeURIComponent(id)}`);
  const zipBytes = Buffer.from(await res.arrayBuffer());

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "garmin-"));
  try {
    const zipPath = path.join(tmp, "activity.zip");
    fs.writeFileSync(zipPath, zipBytes);
    const out = path.join(tmp, "out");
    await extract(zipPath, { dir: out });

    const files = fs.readdirSync(out, { recursive: true }).map(String);
    const pick =
      files.find((f) => f.toLowerCase().endsWith(".fit")) ??
      files.find((f) => f.toLowerCase().endsWith(".gpx"));
    if (!pick) return null;

    return { name: path.basename(pick), data: fs.readFileSync(path.join(out, pick)) };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}
