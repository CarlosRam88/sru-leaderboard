// 8 colours spaced across the usable hue wheel.
// Avoided: 45–165° (gold/amber/green), near-0° duplicates (pink/rose too close to red),
// and low-saturation greys (silver).
// 6 colours covering the usable hue wheel (avoiding 45–165° green/gold band).
// Dropped indigo (~232°) and fuchsia (~294°) — both sat too close to their
// neighbours. Ordered as complementary pairs so adjacent hash indices land
// on perceptual opposites: (red↔cyan), (orange↔purple), (pink↔blue).
const PALETTE = [
  '#f87171', // red-400    ~  0°
  '#22d3ee', // cyan-400   ~188°
  '#fb923c', // orange-400 ~ 24°
  '#c084fc', // purple-400 ~272°
  '#f472b6', // pink-400   ~322°
  '#60a5fa', // blue-400   ~212°
];

export function teamColor(region: string): string | null {
  if (!region) return null;
  let hash = 5381;
  for (let i = 0; i < region.length; i++) {
    hash = ((hash << 5) + hash) ^ region.charCodeAt(i);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
