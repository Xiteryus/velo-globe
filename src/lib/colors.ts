const PALETTE = [
  "#2dd4bf",
  "#fb923c",
  "#f472b6",
  "#60a5fa",
  "#a3e635",
  "#facc15",
  "#c084fc",
];

export function yearOf(iso: string): number {
  return new Date(iso).getUTCFullYear();
}

export function colorForYear(year: number): string {
  const index = ((year % PALETTE.length) + PALETTE.length) % PALETTE.length;
  return PALETTE[index];
}
