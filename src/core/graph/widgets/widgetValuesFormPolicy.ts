import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { setWidgetValuesFormPolicy } from '@/lib/litegraph/src/widgets/widgetValuesForm'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const VALUE_DEPENDENT_LAYOUT_INPUT_TYPES = new Set([
  'COMFY_AUTOGROW_V3',
  'COMFY_DYNAMICCOMBO_V3',
  'COMFY_DYNAMICGROUP_V3'
])

function widgetLayoutDependsOnValues(node: LGraphNode): boolean {
  const definition = useNodeDefStore().fromLGraphNode(node)
  return Object.values(definition?.inputs ?? {}).some((spec) =>
    VALUE_DEPENDENT_LAYOUT_INPUT_TYPES.has(spec.type)
  )
}

export function installWidgetValuesFormPolicy(): void {
  setWidgetValuesFormPolicy({
    widgetLayoutDependsOnValues
  })
}
