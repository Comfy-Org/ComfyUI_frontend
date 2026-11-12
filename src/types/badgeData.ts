/** The display order shared by badge renderers. */
export const CORE_PART_ORDER = ['id', 'lifecycle', 'source'] as const

export type CoreBadgePart = (typeof CORE_PART_ORDER)[number]

export interface CoreBadgeData {
  kind: 'core'
  part: CoreBadgePart
  text: string
  bgColor?: string
  fgColor?: string
}

interface CreditsBadgeData {
  kind: 'credits'
  text: string
  bgColor?: string
  fgColor?: string
}

/**
 * A badge row: plain presentation data projected from its sources
 * (settings, node definition, palette, pricing, connectivity).
 * Core rows carry raw source text plus which projection part they are.
 * They are emitted in display order; renderers only join and trim them.
 * Extension badges are not rows — they live on `node.badges`.
 * Never serialized.
 */
export type BadgeData = CoreBadgeData | CreditsBadgeData
