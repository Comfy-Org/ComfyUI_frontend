/** Display order of badge kinds. */
export const BADGE_KIND_ORDER = ['core', 'credits', 'extension'] as const

export type BadgeKind = (typeof BADGE_KIND_ORDER)[number]

export type CoreBadgePart = 'lifecycle' | 'id' | 'source'

/**
 * A badge row: plain presentation data projected from its sources
 * (settings, node definition, palette, pricing, connectivity). Icons are
 * referenced by key, never held as live objects. Core rows carry raw
 * source text plus which projection part they are, so each renderer
 * applies its own ordering, joining, and trimming. Never serialized.
 */
export interface BadgeData {
  kind: BadgeKind
  text: string
  part?: CoreBadgePart
  fgColor?: string
  bgColor?: string
  iconKey?: string
}
