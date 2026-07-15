import { truncate } from 'es-toolkit/compat'

import type { BadgeData, CoreBadgeData, CoreBadgePart } from '@/types/badgeData'

import { LGraphBadge } from './LGraphBadge'
import type { LGraphNode } from './LGraphNode'
import { resolveBadgeIcon } from './badgeIconRegistry'

/** Legacy canvas joins the core parts into a single badge in this order. */
const CORE_JOIN_ORDER = [
  'id',
  'lifecycle',
  'source'
] as const satisfies readonly CoreBadgePart[]
const CORE_TEXT_LIMIT = 31

function joinedCoreText(coreRows: readonly CoreBadgeData[]): string {
  const byPart = new Map(coreRows.map((row) => [row.part, row.text]))
  return truncate(
    CORE_JOIN_ORDER.map((part) => byPart.get(part) ?? '')
      .filter((text) => text.length > 0)
      .join(' '),
    { length: CORE_TEXT_LIMIT }
  )
}

function buildDrawObjects(rows: readonly BadgeData[]): LGraphBadge[] {
  const badges: LGraphBadge[] = []

  const coreRows = rows.filter((row) => row.kind === 'core')
  const [firstCore] = coreRows
  if (firstCore) {
    const coreText = joinedCoreText(coreRows)
    if (coreText) {
      badges.push(
        new LGraphBadge({
          text: coreText,
          fgColor: firstCore.fgColor,
          bgColor: firstCore.bgColor
        })
      )
    }
  }

  for (const row of rows) {
    if (row.kind === 'core') continue
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

const EMPTY_BADGE_ROWS: readonly BadgeData[] = []

export function badgeRows(node: LGraphNode): readonly BadgeData[] {
  return rowsProvider?.(node) ?? EMPTY_BADGE_ROWS
}

type BadgeRowsProvider = typeof badgeRows

let rowsProvider: BadgeRowsProvider | undefined

/**
 * Installs the app-layer badge derivation. A seam so litegraph never
 * imports the derivation's store/pricing dependency graph.
 */
export function registerBadgeRowsProvider(provider: BadgeRowsProvider): void {
  if (rowsProvider && rowsProvider !== provider) {
    console.error('A badge rows provider is already registered')
    return
  }
  rowsProvider = provider
}

const drawCache = new WeakMap<
  LGraphNode,
  { rows: readonly BadgeData[]; badges: LGraphBadge[] }
>()

/**
 * The legacy canvas draw objects for a node's badge rows. The store
 * replaces a node's rows array wholesale per write, so array identity
 * doubles as the rebuild key.
 */
export function badgeDrawObjects(
  node: LGraphNode,
  rows: readonly BadgeData[]
): LGraphBadge[] {
  const cached = drawCache.get(node)
  if (cached?.rows === rows) return cached.badges
  const badges = buildDrawObjects(rows)
  drawCache.set(node, { rows, badges })
  return badges
}
