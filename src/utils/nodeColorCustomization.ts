import type { ColorOption } from '@/lib/litegraph/src/interfaces'
import { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { isColorable } from '@/lib/litegraph/src/utils/type'

import {
  deriveCustomNodeHeaderColor,
  getDefaultCustomNodeColor as getDefaultCustomNodeColorValue,
  normalizeNodeColor
} from '@/utils/nodeColorPersistence'

function isColorableNodeOrGroup(
  item: unknown
): item is (LGraphNode | LGraphGroup) & {
  getColorOption(): ColorOption | null
} {
  return (
    isColorable(item) &&
    (item instanceof LGraphNode || item instanceof LGraphGroup)
  )
}

export function getDefaultCustomNodeColor(): string {
  return getDefaultCustomNodeColorValue()
}

export function applyCustomColorToItem(
  item: LGraphNode | LGraphGroup,
  color: string,
  options: { darkerHeader: boolean }
): string {
  const normalized = normalizeNodeColor(color)

  if (item instanceof LGraphGroup) {
    item.color = normalized
    return normalized
  }

  item.bgcolor = normalized
  item.color = deriveCustomNodeHeaderColor(normalized, options.darkerHeader)
  return normalized
}

export function applyCustomColorToItems(
  items: Iterable<unknown>,
  color: string,
  options: { darkerHeader: boolean }
): string {
  const normalized = normalizeNodeColor(color)

  for (const item of items) {
    if (item instanceof LGraphNode || item instanceof LGraphGroup) {
      applyCustomColorToItem(item, normalized, options)
    }
  }

  return normalized
}

function getAppliedColorFromItem(
  item: (LGraphNode | LGraphGroup) & {
    getColorOption(): ColorOption | null
  }
): string | null {
  const presetColor = item.getColorOption()
  if (presetColor) {
    return item instanceof LGraphGroup ? presetColor.groupcolor : presetColor.bgcolor
  }

  return item instanceof LGraphGroup ? item.color ?? null : item.bgcolor ?? null
}

function getCustomColorFromItem(
  item: (LGraphNode | LGraphGroup) & {
    getColorOption(): ColorOption | null
  }
): string | null {
  if (item.getColorOption()) return null

  return item instanceof LGraphGroup ? item.color ?? null : item.bgcolor ?? null
}

function getSharedColor(
  items: unknown[],
  selector: (
    item: (LGraphNode | LGraphGroup) & { getColorOption(): ColorOption | null }
  ) => string | null
): string | null {
  const validItems = items.filter(isColorableNodeOrGroup)
  if (validItems.length === 0) return null

  const firstColor = selector(validItems[0])
  return validItems.every((item) => selector(item) === firstColor) ? firstColor : null
}

export function getSharedAppliedColor(items: unknown[]): string | null {
  return getSharedColor(items, getAppliedColorFromItem)
}

export function getSharedCustomColor(items: unknown[]): string | null {
  return getSharedColor(items, getCustomColorFromItem)
}

export {
  NODE_COLOR_DARKER_HEADER_SETTING_ID,
  NODE_COLOR_FAVORITES_SETTING_ID,
  NODE_COLOR_RECENTS_SETTING_ID,
  NODE_COLOR_SWATCH_LIMIT,
  deriveCustomNodeHeaderColor,
  normalizeNodeColor,
  toggleFavoriteNodeColor,
  upsertRecentNodeColor
} from '@/utils/nodeColorPersistence'
