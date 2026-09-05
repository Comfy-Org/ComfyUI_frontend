import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  IWidgetOptions
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
 * Formats a numeric widget value for legacy canvas rendering.
 *
 * Persisted workflows and extension-provided widgets can contain values that do
 * not match the current numeric widget type. Keep coercion at this runtime
 * boundary so an invalid value cannot throw and stop the canvas render loop.
 */
export function formatNumericWidgetValue(
  value: unknown,
  precision = 3
): string {
  let numericValue: number
  try {
    numericValue = Number(value)
  } catch {
    numericValue = Number.NaN
  }
  return numericValue.toFixed(precision)
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
    advanced: widget.options.advanced ?? widget.advanced,
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
