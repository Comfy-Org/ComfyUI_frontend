import type { NodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetState } from '@comfyorg/graph-model/widgetState'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { SafeControlWidget, WidgetValue } from '@/types/simplifiedWidget'

export interface WidgetErrorTarget {
  readonly executionId: NodeExecutionId
  readonly widgetName: string
}

interface WidgetValueTarget {
  readonly id: WidgetId
  readonly state: WidgetState
  readonly live?: { node: LGraphNode; widget: IBaseWidget }
  readonly errorTarget?: WidgetErrorTarget
  readonly nodeExecId: NodeExecutionId | null
  readonly controlWidget?: SafeControlWidget
  readonly linked: () => boolean
  readonly canUpdate?: (id: WidgetId) => boolean
}

function normalizeWidgetValue(value: unknown): WidgetValue {
  if (value === undefined || value === null) return value
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'object'
  )
    return value
  console.warn(`Invalid widget value type: ${typeof value}`, value)
  return undefined
}

export function createWidgetValueBinding(target: WidgetValueTarget) {
  const { id, state, live, errorTarget, nodeExecId, controlWidget } = target
  const store = useWidgetValueStore()
  const errors = useExecutionErrorStore()
  const canUpdate = () =>
    store.getWidget(id) === state &&
    !state.disabled &&
    !target.linked() &&
    !state.options.disabled &&
    !state.options.read_only &&
    target.canUpdate?.(id) !== false

  function updateHandler(newValue: WidgetValue) {
    if (!canUpdate()) return
    store.setValue(id, newValue)
    if (live) {
      const normalized = normalizeWidgetValue(newValue)
      live.widget.value = normalized
      live.widget.callback?.(normalized, app.canvas, live.node)
      live.node.widgets?.forEach((widget) => widget.triggerDraw?.())
    }
    const options = { min: state.options.min, max: state.options.max }
    if (errorTarget) {
      errors.clearWidgetRelatedErrors(
        errorTarget.executionId,
        errorTarget.widgetName,
        errorTarget.widgetName,
        newValue,
        options
      )
    }
    if (nodeExecId) {
      errors.clearWidgetRelatedErrors(
        nodeExecId,
        state.name,
        state.name,
        newValue,
        options
      )
    }
  }

  return {
    value: normalizeWidgetValue(state.value),
    options:
      target.linked() || state.disabled || state.options.read_only
        ? { ...state.options, disabled: true }
        : { ...state.options },
    updateHandler,
    controlWidget: controlWidget && {
      value: controlWidget.value,
      update: (value: WidgetValue) => {
        if (canUpdate()) controlWidget.update(value)
      }
    }
  }
}
