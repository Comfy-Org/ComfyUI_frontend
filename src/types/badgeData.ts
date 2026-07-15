export type CoreBadgePart = 'lifecycle' | 'id' | 'source'

export interface CoreBadgeData {
  kind: 'core'
  part: CoreBadgePart
  text: string
  fgColor?: string
  bgColor?: string
}

interface CreditsBadgeData {
  kind: 'credits'
  text: string
  iconKey?: string
  fgColor?: string
  bgColor?: string
}

/**
 * A badge row: plain presentation data projected from its sources
 * (settings, node definition, palette, pricing, connectivity). Icons are
 * referenced by key, never held as live objects. Core rows carry raw
 * source text plus which projection part they are, so each renderer
 * applies its own ordering, joining, and trimming. Extension badges are
 * not rows — they live on `node.badges`. Never serialized.
 */
export type BadgeData = CoreBadgeData | CreditsBadgeData
