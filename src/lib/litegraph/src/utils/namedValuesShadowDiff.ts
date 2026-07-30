import { isEqual } from 'es-toolkit'

import type { IBaseWidget } from '../types/widgets'

export interface NamedValuesShadowDiffResult {
  mismatchWidgetCount: number
  checkedWidgetCount: number
}

export function computeLegacyWidgetShadow(
  widgets: readonly IBaseWidget[],
  widgetsValues: unknown[] | undefined
): Map<string, unknown> {
  const shadow = new Map<string, unknown>()
  if (!widgetsValues) return shadow

  let i = 0
  for (const widget of widgets) {
    if (widget.serialize === false) continue
    if (i >= widgetsValues.length) break
    shadow.set(widget.name, widgetsValues[i++])
  }
  return shadow
}

export function diffNamedValuesShadow(
  named: Record<string, unknown>,
  legacy: Map<string, unknown>
): NamedValuesShadowDiffResult | null {
  if (legacy.size === 0) return null

  const widgetNames = new Set([...legacy.keys(), ...Object.keys(named)])
  let mismatchWidgetCount = 0
  for (const name of widgetNames) {
    if (!isEqual(named[name], legacy.get(name))) mismatchWidgetCount++
  }

  return { mismatchWidgetCount, checkedWidgetCount: widgetNames.size }
}
