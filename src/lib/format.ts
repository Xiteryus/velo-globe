export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "–";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

export function formatKm(meters: number): string {
  return (meters / 1000).toFixed(1).replace(".", ",") + " km";
}

export function formatSpeed(ms: number | null): string {
  if (ms === null || ms === undefined) return "–";
  return (ms * 3.6).toFixed(1).replace(".", ",") + " km/h";
}

export function formatElevation(m: number | null): string {
  if (m === null || m === undefined) return "–";
  return Math.round(m) + " m";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
