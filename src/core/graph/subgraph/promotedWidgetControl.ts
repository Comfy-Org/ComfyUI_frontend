import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'

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
