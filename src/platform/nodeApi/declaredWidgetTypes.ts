import type { LGraphNode } from '@/lib/litegraph/src/types/entityRegistry'
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
    if (declaredWidgetTypes.get(type) !== constructor) return
    declaredWidgetTypes.delete(type)
    useWidgetStore().unregisterCustomWidget(type)
  }
}

export function constructDeclaredWidget(
  node: LGraphNode,
  type: string,
  name: string,
  options: object,
  value: unknown
): ReturnType<ComfyWidgetConstructor> | undefined {
  const constructor = declaredWidgetTypes.get(type)
  if (!constructor) return undefined
  const inputData = [
    type,
    { ...options, default: value }
  ] as Parameters<ComfyWidgetConstructor>[2]
  return constructor(node, name, inputData, undefined as never)
}
