import type { LGraphNode } from '@/lib/litegraph/src/types/entityRegistry'

import type {
  IBaseWidget,
  IWidgetOptions,
  TWidgetValue
} from '@/lib/litegraph/src/types/widgets'
import type { WidgetRenderState } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'
import type { UUID } from '@/utils/uuid'

import { evaluateMathExpression } from '@/lib/litegraph/src/utils/mathParser'

/**
 * The step value for numeric widgets.
 * Use {@link IWidgetOptions.step2} if available, otherwise fallback to
 * {@link IWidgetOptions.step} which is scaled up by 10x in the legacy frontend logic.
 */
export function getWidgetStep(options: IWidgetOptions): number {
  return options.step2 || (options.step || 10) * 0.1
}

/**
 * Coerces a numeric widget value for legacy canvas rendering.
 *
 * Persisted workflows and extension-provided widgets can contain values that do
 * not match the current numeric widget type. Keep coercion at this runtime
 * boundary so an invalid value cannot throw and stop the canvas render loop.
 */
export function coerceNumericWidgetValue(value: unknown): number {
  try {
    return Number(value)
  } catch {
    return Number.NaN
  }
}

export function formatNumericWidgetValue(
  value: unknown,
  precision = 3
): string {
  return coerceNumericWidgetValue(value).toFixed(precision)
}

function coerceNumericString(value: string): number | string {
  if (!/^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?\s*$/i.test(value))
    return value
  const parsed = Number(value)
  const representable = Number.isInteger(parsed)
    ? Number.isSafeInteger(parsed)
    : Number.isFinite(parsed)
  return representable ? parsed : value
}

function coerceBooleanString(value: string): boolean | string {
  switch (value.trim().toLowerCase()) {
    case 'true':
      return true
    case 'false':
      return false
    default:
      return value
  }
}

/**
 * Converts a saved numeric or `true`/`false` string to the value type of a
 * numeric or toggle widget, and returns any other value unchanged.
 */
export function coerceRestoredWidgetValue(
  widget: Pick<IBaseWidget, 'type' | 'options'>,
  value: TWidgetValue
): TWidgetValue {
  if (typeof value !== 'string') return value
  switch (widget.type) {
    case 'toggle':
      return coerceBooleanString(value)
    case 'number':
    case 'slider':
    case 'knob':
    case 'gradientslider':
      return coerceNumericString(value)
    case 'color':
      return 'format' in widget.options && widget.options.format === 'int'
        ? coerceNumericString(value)
        : value
    default:
      return value
  }
}

export function evaluateInput(input: string): number | undefined {
  const result = evaluateMathExpression(input)
  if (result !== undefined) {
    if (!isFinite(result)) return undefined
    return result
  }
  const newValue = Number(input)
  if (!isFinite(newValue)) return undefined
  return newValue
}

export function findComboValueIndex(
  values: readonly (string | number)[],
  currentValue: string | number
): number {
  const exactIndex = values.indexOf(currentValue)
  return exactIndex === -1
    ? values.findIndex((value) => String(value) === String(currentValue))
    : exactIndex
}

export function getWidgetIds(
  widgets: readonly { readonly widgetId?: WidgetId }[]
): WidgetId[] {
  return widgets
    .map((widget) => widget.widgetId)
    .filter((id): id is WidgetId => id !== undefined)
}

function isDOMBackedWidget(widget: Readonly<IBaseWidget>): boolean {
  if ('isDOMWidget' in widget && typeof widget.isDOMWidget === 'boolean') {
    return widget.isDOMWidget
  }
  return (
    ('element' in widget && !!widget.element) ||
    ('component' in widget && !!widget.component)
  )
}

export function deriveWidgetRenderState(
  widget: Readonly<IBaseWidget>
): WidgetRenderState {
  return {
    hasLayoutSize: typeof widget.computeLayoutSize === 'function',
    isDOMWidget: isDOMBackedWidget(widget),
    tooltip: widget.tooltip
  }
}

export function resolveNodeRootGraphId(
  node: Pick<LGraphNode, 'graph'>
): UUID | undefined
export function resolveNodeRootGraphId(
  node: Pick<LGraphNode, 'graph'>,
  fallbackGraphId: UUID
): UUID
export function resolveNodeRootGraphId(
  node: Pick<LGraphNode, 'graph'>,
  fallbackGraphId?: UUID
): UUID | undefined {
  return node.graph?.rootGraph.id ?? fallbackGraphId
}
