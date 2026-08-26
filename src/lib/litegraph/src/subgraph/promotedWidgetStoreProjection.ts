import { invokePromotedWidgetSourceCallback } from '@/core/graph/subgraph/promotedInputWidget'
import type { INodeInputSlot, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'

export function createPromotedWidgetStoreProjection(
  node: LGraphNode,
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
    // Canvas edits operate on a transient concrete widget (toConcreteWidget),
    // so the value setter above is never invoked; BaseWidget.setValue writes
    // its own local state and then calls this callback, which is the only
    // bridge back to the store.
    callback(next, canvas, _node, pos, e) {
      store.setValue(id, next)
      invokePromotedWidgetSourceCallback(node, input, next, canvas, pos, e)
    }
  }
  Object.defineProperty(widget, 'widgetId', {
    value: id,
    enumerable: false,
    configurable: true
  })
  return widget
}
