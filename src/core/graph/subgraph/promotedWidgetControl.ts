import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

import { useWidgetValueStore } from '@/stores/widgetValueStore'

export function getSerializablePromotedInputs(
  inputs: readonly INodeInputSlot[]
) {
  const store = useWidgetValueStore()
  return inputs.filter(
    (input): input is INodeInputSlot & { widgetId: WidgetId } =>
      input.widgetId !== undefined &&
      store.getWidget(input.widgetId)?.serialize !== false
  )
}

export function copyPromotedWidgetControl(
  sourceWidget: Readonly<IBaseWidget>,
  targetId: WidgetId
): void {
  if (!sourceWidget.widgetId) return
  const store = useWidgetValueStore()
  const sourceControl = store.getWidgetControl(sourceWidget.widgetId)
  if (!sourceControl) {
    store.deleteWidgetControl(targetId)
    return
  }
  const existing = store.getWidgetControl(targetId)
  store.registerWidgetControl(targetId, {
    mode: sourceControl.mode,
    filter:
      sourceControl.filter === undefined
        ? undefined
        : (existing?.filter ?? sourceControl.filter)
  })
}

export function clearPromotedWidget(
  input: INodeInputSlot,
  { retainControl = false }: { retainControl?: boolean } = {}
): void {
  input._widget?.onRemove?.()
  input._widget = undefined
  if (input.widgetId && !retainControl) {
    useWidgetValueStore().deleteWidgetControl(input.widgetId)
  }
}
