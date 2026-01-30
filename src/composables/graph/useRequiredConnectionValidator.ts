import { useDebounceFn } from '@vueuse/core'
import { onUnmounted } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useGraphErrorStateStore } from '@/stores/graphErrorStateStore'
import type { GraphError } from '@/stores/graphErrorStateStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { forEachNode } from '@/utils/graphTraversalUtil'

export function useRequiredConnectionValidator(): void {
  const errorStore = useGraphErrorStateStore()
  const nodeDefStore = useNodeDefStore()

  function validate(): void {
    const rootGraph = app.rootGraph
    if (!rootGraph) return

    const errors: GraphError[] = []

    forEachNode(rootGraph, (node: LGraphNode) => {
      const nodeDef = nodeDefStore.nodeDefsByName[node.type ?? '']
      if (!nodeDef?.input?.required) return

      const subgraphId =
        node.graph && !node.graph.isRootGraph ? node.graph.id : null
      const locatorId = subgraphId
        ? createNodeLocatorId(subgraphId, node.id)
        : String(node.id)

      for (const inputName of Object.keys(nodeDef.input.required)) {
        const slot = node.inputs?.find((s) => s.name === inputName)

        const hasConnection = slot?.link !== null && slot?.link !== undefined
        const hasWidgetValue = hasWidgetValueForInput(node, inputName)

        if (!hasConnection && !hasWidgetValue) {
          errors.push({
            key: `frontend:missing:${locatorId}:${inputName}`,
            source: 'frontend',
            target: { kind: 'slot', nodeId: locatorId, slotName: inputName },
            code: 'MISSING_REQUIRED_INPUT'
          })
        }
      }
    })

    errorStore.execute({ type: 'REPLACE_SOURCE', source: 'frontend', errors })
  }

  function hasWidgetValueForInput(
    node: LGraphNode,
    inputName: string
  ): boolean {
    if (!node.widgets) return false
    const widget = node.widgets.find((w) => w.name === inputName)
    if (!widget) return false
    return (
      widget.value !== undefined && widget.value !== null && widget.value !== ''
    )
  }

  const debouncedValidate = useDebounceFn(validate, 200)

  api.addEventListener('graphChanged', debouncedValidate)

  onUnmounted(() => {
    api.removeEventListener('graphChanged', debouncedValidate)
  })

  validate()
}
