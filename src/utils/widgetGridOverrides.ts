import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

const GRID_OVERRIDES_PROPERTY_KEY = 'gridOverrides'

const gridTrackValidityCache = new Map<string, boolean>()

export function isValidGridTrack(value: string): boolean {
  const cached = gridTrackValidityCache.get(value)
  if (cached !== undefined) return cached
  const valid =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('grid-template-rows', value)
  gridTrackValidityCache.set(value, valid)
  return valid
}

/**
 * Maps widget name -> CSS grid-template-rows track value
 * (e.g. '200px', 'minmax(150px, 300px)', '1fr', 'auto').
 * Persisted on `node.properties.gridOverrides`.
 */
export type WidgetGridOverrides = Record<string, string>

export function readGridOverrides(
  node: LGraphNode
): WidgetGridOverrides | undefined {
  const raw = node.properties?.[GRID_OVERRIDES_PROPERTY_KEY]
  if (!raw || typeof raw !== 'object') return undefined
  const entries = Object.entries(raw as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  )
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries)
}

function writeGridOverrides(
  node: LGraphNode,
  overrides: WidgetGridOverrides
): void {
  if (Object.keys(overrides).length === 0) {
    if (node.properties) delete node.properties[GRID_OVERRIDES_PROPERTY_KEY]
    return
  }
  node.properties ??= {}
  node.properties[GRID_OVERRIDES_PROPERTY_KEY] = overrides
}

export function setGridOverride(
  node: LGraphNode,
  widgetName: string,
  value: string
): void {
  const current = readGridOverrides(node) ?? {}
  current[widgetName] = value
  writeGridOverrides(node, current)
}

export function clearGridOverride(node: LGraphNode, widgetName: string): void {
  const current = readGridOverrides(node) ?? {}
  delete current[widgetName]
  writeGridOverrides(node, current)
}

export function clearAllGridOverrides(node: LGraphNode): void {
  writeGridOverrides(node, {})
}
