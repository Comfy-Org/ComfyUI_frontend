import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

const widgetRenderKeys = new WeakMap<IBaseWidget, string>()
let nextWidgetRenderKeyId = 0

export function getStableWidgetRenderKey(widget: IBaseWidget): string {
  const cachedKey = widgetRenderKeys.get(widget)
  if (cachedKey) return cachedKey

  const key = `widget:${nextWidgetRenderKeyId++}`
  widgetRenderKeys.set(widget, key)
  return key
}
