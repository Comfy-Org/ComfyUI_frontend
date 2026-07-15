/** Display order of badge kinds; see domain-glossary.md § Badges. */
export const BADGE_KIND_ORDER = ['core', 'credits', 'extension'] as const

export type BadgeKind = (typeof BADGE_KIND_ORDER)[number]

/**
 * A badge row: plain presentation data projected from its sources
 * (settings, node definition, palette, pricing, connectivity). Icons are
 * referenced by key, never held as live objects. Never serialized.
 */
export interface BadgeData {
  kind: BadgeKind
  text: string
  fgColor?: string
  bgColor?: string
  iconKey?: string
}
