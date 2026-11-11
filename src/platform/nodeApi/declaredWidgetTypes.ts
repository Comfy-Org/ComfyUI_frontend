import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'
import { useApp } from '@/scripts/appInstance'
import { useWidgetStore } from '@/stores/widgetStore'
import type { ComfyWidgetConstructor } from '@/types/comfy'

const declaredWidgetTypes = new Map<string, ComfyWidgetConstructor>()

export function registerDeclaredWidget(
  type: string,
  constructor: ComfyWidgetConstructor
): () => void {
  declaredWidgetTypes.set(type, constructor)
  useWidgetStore().registerCustomWidgets({ [type]: constructor })
  return () => {
    if (declaredWidgetTypes.get(type) === constructor) {
      declaredWidgetTypes.delete(type)
    }
    useWidgetStore().unregisterCustomWidget(type, constructor)
  }
}

export function constructDeclaredWidget(
  node: LGraphNode,
  type: string,
  name: string,
  options: object,
  value: unknown
): ReturnType<ComfyWidgetConstructor> | undefined {
  if (!declaredWidgetTypes.has(type)) return undefined
  const constructor = useWidgetStore().widgets.get(type)
  if (!constructor) return undefined
  const inputData = [
    type,
    { ...options, default: value }
  ] as Parameters<ComfyWidgetConstructor>[2]
  const result = constructor(node, name, inputData, useApp())
  if (result && 'type' in result) return { widget: result }
  return result?.widget ? { ...result, widget: result.widget } : undefined
}
