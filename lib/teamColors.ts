// 8 colours spaced across the usable hue wheel.
// Avoided: 45–165° (gold/amber/green), near-0° duplicates (pink/rose too close to red),
// and low-saturation greys (silver).
// Vivid, fully-saturated colours for dark backgrounds.
// Avoiding 45–165° (gold/green band). Ordered as complementary pairs so
// adjacent hash indices land on perceptual opposites: (red↔cyan),
// (orange↔violet), (magenta↔blue).
const PALETTE = [
  '#ff3d3d', // vivid red      ~  0°
  '#00dcff', // vivid cyan     ~192°
  '#ff8c00', // vivid orange   ~ 32°
  '#b03fff', // vivid violet   ~276°
  '#ff3d9a', // vivid magenta  ~326°
  '#3d80ff', // vivid blue     ~218°
];

export function teamColor(region: string): string | null {
  if (!region) return null;
  let hash = 5381;
  for (let i = 0; i < region.length; i++) {
    hash = ((hash << 5) + hash) ^ region.charCodeAt(i);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
