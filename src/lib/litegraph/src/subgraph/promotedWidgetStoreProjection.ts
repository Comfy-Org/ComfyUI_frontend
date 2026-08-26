import type { INodeInputSlot } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'

export function createPromotedWidgetStoreProjection(
  input: INodeInputSlot,
  id: WidgetId
): IBaseWidget {
  const store = useWidgetValueStore()
  const widget: IBaseWidget = {
    get name() {
      return store.getWidget(id)?.name ?? input.name
    },
    get label() {
      return store.getWidget(id)?.label ?? input.label ?? input.name
    },
    set label(next) {
      const state = store.getWidget(id)
      if (state) state.label = next
    },
    get y() {
      return store.getWidget(id)?.y ?? 0
    },
    set y(next) {
      const state = store.getWidget(id)
      if (state) state.y = next
    },
    get type() {
      return store.getWidget(id)?.type ?? 'text'
    },
    get options() {
      return store.getWidget(id)?.options ?? {}
    },
    get value() {
      return store.getWidget(id)?.value
    },
    set value(next) {
      store.setValue(id, next)
    },
    callback(next) {
      store.setValue(id, next)
    }
  }
  Object.defineProperty(widget, 'widgetId', {
    value: id,
    enumerable: false,
    configurable: true
  })
  return widget
}
