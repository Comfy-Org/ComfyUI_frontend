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

export function computeLegacyWidgetShadow(
  widgets: readonly IBaseWidget[],
  widgetsValues: ArrayLike<unknown> | undefined
): LegacyWidgetShadowEntry[] {
  const shadow: LegacyWidgetShadowEntry[] = []
  if (
    !widgetsValues ||
    !Number.isSafeInteger(widgetsValues.length) ||
    widgetsValues.length < 0
  )
    return shadow

  let i = 0
  for (const [widgetIndex, widget] of widgets.entries()) {
    if (widget.serialize === false) continue
    if (i >= widgetsValues.length) break
    if (!(i in widgetsValues)) break
    shadow.push({ widgetIndex, name: widget.name, value: widgetsValues[i++] })
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
