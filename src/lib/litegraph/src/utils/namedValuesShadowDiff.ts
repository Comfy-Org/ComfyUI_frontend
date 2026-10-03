import { isEqual } from 'es-toolkit'

import type { IBaseWidget } from '../types/widgets'

export interface NamedValuesShadowDiffResult {
  mismatchWidgetCount: number
  checkedWidgetCount: number
}

export interface LegacyWidgetShadowEntry {
  widgetIndex: number
  name: string
  value: unknown
}

/**
 * Pairs each serialised widget with the value the positional legacy walk in
 * `LGraphNode.configure()` would give it. Mirrors `configure()`: the input is
 * normalised with `Array.from()`, so sparse slots and array-likes without an
 * index are read positionally as `undefined` rather than ending the walk.
 */
export function computeLegacyWidgetShadow(
  widgets: readonly IBaseWidget[],
  widgetsValues: ArrayLike<unknown> | undefined
): LegacyWidgetShadowEntry[] {
  const shadow: LegacyWidgetShadowEntry[] = []
  if (!widgetsValues) return shadow

  const positional = Array.from(widgetsValues)
  let i = 0
  for (const [widgetIndex, widget] of widgets.entries()) {
    if (widget.serialize === false) continue
    if (i >= positional.length) break
    shadow.push({ widgetIndex, name: widget.name, value: positional[i++] })
  }
  return shadow
}

export function diffNamedValuesShadow(
  named: Record<string, unknown>,
  legacy: readonly LegacyWidgetShadowEntry[]
): NamedValuesShadowDiffResult | null {
  if (legacy.length === 0) return null

  const legacyNames = new Set(legacy.map((entry) => entry.name))
  const namedOnlyCount = Object.keys(named).filter(
    (name) => !legacyNames.has(name)
  ).length

  const mismatchWidgetCount =
    legacy.filter((entry) => !isEqual(named[entry.name], entry.value)).length +
    namedOnlyCount

  return {
    mismatchWidgetCount,
    checkedWidgetCount: legacy.length + namedOnlyCount
  }
}
