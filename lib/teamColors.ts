const PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#84cc16', // lime
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
];

export function teamColor(region: string): string | null {
  if (!region) return null;
  let hash = 5381;
  for (let i = 0; i < region.length; i++) {
    hash = ((hash << 5) + hash) ^ region.charCodeAt(i);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
