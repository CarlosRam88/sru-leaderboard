// 8 colours spaced across the usable hue wheel.
// Avoided: 45–165° (gold/amber/green), near-0° duplicates (pink/rose too close to red),
// and low-saturation greys (silver).
const PALETTE = [
  '#f87171', // red-400        ~  0°
  '#fb923c', // orange-400     ~ 24°
  '#22d3ee', // cyan-400       ~188°
  '#60a5fa', // blue-400       ~212°
  '#818cf8', // indigo-400     ~232°
  '#c084fc', // purple-400     ~272°
  '#e879f9', // fuchsia-400    ~294°
  '#f472b6', // pink-400       ~322°
];

export function teamColor(region: string): string | null {
  if (!region) return null;
  let hash = 5381;
  for (let i = 0; i < region.length; i++) {
    hash = ((hash << 5) + hash) ^ region.charCodeAt(i);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
