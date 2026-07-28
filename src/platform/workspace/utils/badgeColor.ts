// Muted, low-saturation badge palette (sampled from the Figma usage palette).
// Dark tones that read against the dark surface with a white monogram.
const BADGE_COLORS = [
  '#956252', // terracotta
  '#3e465f', // slate indigo
  '#424f45', // olive green
  '#90646e', // mauve rose
  '#6d5a7a', // muted purple
  '#4f6b6b', // muted teal
  '#7a6a4a', // khaki
  '#5a6270' // steel
]

/** Stable muted badge color for a user, keyed by name/email. */
export function userBadgeColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return BADGE_COLORS[hash % BADGE_COLORS.length]
}
