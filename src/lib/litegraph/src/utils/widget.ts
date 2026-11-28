import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'

import type { IBaseWidget, IWidgetOptions } from '@comfyorg/graph-model/widgets'
import type {
  WidgetRenderer,
  WidgetRenderState
} from '@/stores/widgetValueStore'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { parseWidgetId, widgetId } from '@comfyorg/graph-model/widgetId'
import type { UUID } from '@/utils/uuid'

import { IS_CONTROL_WIDGET } from '@/core/graph/widgets/controlWidgetMarker'
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

function prefersDOMElement(widget: Readonly<IBaseWidget>): boolean {
  return (
    isDOMBackedWidget(widget) &&
    'element' in widget &&
    !!widget.element &&
    !(
      'vueNodeRenderer' in widget.options &&
      widget.options.vueNodeRenderer === 'native'
    )
  )
}

/** The renderer a live widget demands over the one registered for its type, if any. */
export function widgetRenderer(
  widget: Readonly<IBaseWidget>
): WidgetRenderer | undefined {
  if (prefersDOMElement(widget)) return 'dom'
  if (!isDOMBackedWidget(widget) && typeof widget.draw === 'function')
    return 'legacy'
  return undefined
}

/** The id of the control-after-generate widget linked to a widget, if any. */
export function controlWidgetId(
  widget: Readonly<IBaseWidget>,
  id: WidgetId | undefined
): WidgetId | undefined {
  const control = widget.linkedWidgets?.find(
    (linked) => linked[IS_CONTROL_WIDGET]
  )
  if (!control || !id) return undefined
  const { graphId, nodeId } = parseWidgetId(id)
  return widgetId(graphId, nodeId, control.name)
}

export function deriveWidgetRenderState(
  widget: Readonly<IBaseWidget>,
  id: WidgetId | undefined
): WidgetRenderState {
  return {
    control: controlWidgetId(widget, id),
    isDOMWidget: isDOMBackedWidget(widget),
    renderer: widgetRenderer(widget),
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
