/** Legacy canvas joins the core parts into a single badge in this order. */
export const CORE_JOIN_ORDER = ['id', 'lifecycle', 'source'] as const

export type CoreBadgePart = (typeof CORE_JOIN_ORDER)[number]

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
 * Core rows carry raw source text plus which projection part they are,
 * so each renderer applies its own ordering, joining, and trimming.
 * Extension badges are not rows — they live on `node.badges`.
 * Never serialized.
 */
export type BadgeData = CoreBadgeData | CreditsBadgeData
