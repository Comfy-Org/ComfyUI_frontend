import { truncate } from 'es-toolkit/compat'

import type { BadgeData, CoreBadgePart } from '@/types/badgeData'

import { LGraphBadge } from './LGraphBadge'
import { resolveBadgeIcon } from './badgeIconRegistry'

/** Legacy canvas joins the core parts into a single badge in this order. */
const CORE_JOIN_ORDER: CoreBadgePart[] = ['id', 'lifecycle', 'source']
const CORE_TEXT_LIMIT = 31

function joinedCoreText(coreRows: BadgeData[]): string {
  const byPart = new Map(coreRows.map((row) => [row.part, row.text]))
  return truncate(
    CORE_JOIN_ORDER.map((part) => byPart.get(part) ?? '')
      .filter((text) => text.length > 0)
      .join(' '),
    { length: CORE_TEXT_LIMIT }
  )
}

function buildDrawObjects(rows: readonly BadgeData[]): LGraphBadge[] {
  const coreRows = rows.filter((row) => row.kind === 'core')
  const otherRows = rows.filter((row) => row.kind !== 'core')

  const badges: LGraphBadge[] = []
  const coreText = joinedCoreText(coreRows)
  if (coreText) {
    badges.push(
      new LGraphBadge({
        text: coreText,
        fgColor: coreRows[0].fgColor,
        bgColor: coreRows[0].bgColor
      })
    )
  }
  for (const row of otherRows) {
    badges.push(
      new LGraphBadge({
        text: row.text,
        fgColor: row.fgColor,
        bgColor: row.bgColor,
        iconOptions: row.iconKey ? resolveBadgeIcon(row.iconKey) : undefined
      })
    )
  }
  return badges
}

const drawCache = new WeakMap<object, { key: string; badges: LGraphBadge[] }>()

/**
 * The legacy canvas draw objects for a node's badge rows, rebuilt only
 * when the row content changes.
 */
export function badgeDrawObjects(
  node: object,
  rows: readonly BadgeData[]
): LGraphBadge[] {
  const key = JSON.stringify(rows)
  const cached = drawCache.get(node)
  if (cached?.key === key) return cached.badges
  const badges = buildDrawObjects(rows)
  drawCache.set(node, { key, badges })
  return badges
}
