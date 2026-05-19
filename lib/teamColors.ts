// 8 colours spaced across the usable hue wheel.
// Avoided: 45–165° (gold/amber/green), near-0° duplicates (pink/rose too close to red),
// and low-saturation greys (silver).
// Vivid, fully-saturated colours for dark backgrounds.
// Avoiding 45–165° (gold/green band). Ordered as complementary pairs.
const PALETTE = [
  '#ff3d3d', // vivid red      ~  0°
  '#00dcff', // vivid cyan     ~192°
  '#ff8c00', // vivid orange   ~ 32°
  '#b03fff', // vivid violet   ~276°
  '#ff3d9a', // vivid magenta  ~326°
  '#3d80ff', // vivid blue     ~218°
];

// Assigns colours by sorted team rank so no two teams ever share a colour.
// allRegions must be the full deduplicated list from the sheet (already sorted).
export function teamColor(region: string, allRegions: string[]): string | null {
  if (!region || allRegions.length === 0) return null;
  const idx = allRegions.indexOf(region);
  return idx >= 0 ? PALETTE[idx % PALETTE.length] : null;
}
