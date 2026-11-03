import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

import { useWidgetValueStore } from '@/stores/widgetValueStore'

export function copyPromotedWidgetControl(
  sourceWidget: Readonly<IBaseWidget>,
  targetId: WidgetId
): void {
  if (!sourceWidget.widgetId) return
  const store = useWidgetValueStore()
  const sourceControl = store.getWidgetControl(sourceWidget.widgetId)
  if (!sourceControl) return
  store.registerWidgetControl(targetId, {
    mode: sourceControl.mode,
    filter: sourceControl.filter
  })
}

export function clearPromotedWidgetControl(input: INodeInputSlot): void {
  input._widget?.onRemove?.()
  input._widget = undefined
  if (input.widgetId) {
    useWidgetValueStore().deleteWidgetControl(input.widgetId)
  }
}
