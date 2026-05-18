import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'

const widgetRenderKeys = new WeakMap<IBaseWidget, string>()
let nextWidgetRenderKeyId = 0

export function getStableWidgetRenderKey(widget: IBaseWidget): string {
  const cachedKey = widgetRenderKeys.get(widget)
  if (cachedKey) return cachedKey

  const prefix = isPromotedWidgetView(widget) ? 'promoted' : 'widget'
  const key = `${prefix}:${nextWidgetRenderKeyId++}`

  widgetRenderKeys.set(widget, key)
  return key
}
