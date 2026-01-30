import { watch } from 'vue'

import type { LGraphNode, Subgraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useGraphErrorStateStore } from '@/stores/graphErrorStateStore'
import { parseNodeLocatorId } from '@/types/nodeIdentification'
import {
  findSubgraphByUuid,
  forEachNode,
  forEachSubgraphNode
} from '@/utils/graphTraversalUtil'

export function useGraphErrorState(): void {
  const store = useGraphErrorStateStore()

  watch(
    () => store.version,
    () => {
      const rootGraph = app.rootGraph
      if (!rootGraph) return

      forEachNode(rootGraph, (node) => {
        node.has_errors = false
        if (node.inputs) {
          for (const slot of node.inputs) {
            slot.hasErrors = false
          }
        }
      })

      for (const [nodeId, keys] of store.keysByNode) {
        if (keys.size === 0) continue

        const parsed = parseNodeLocatorId(nodeId)
        if (!parsed) continue

        const targetGraph = parsed.subgraphUuid
          ? findSubgraphByUuid(rootGraph, parsed.subgraphUuid)
          : rootGraph
        if (!targetGraph) continue

        const node = targetGraph.getNodeById(parsed.localNodeId)
        if (!node) continue

        node.has_errors = true

        for (const key of keys) {
          const error = store.errorsByKey.get(key)
          if (error && error.target.kind === 'slot' && node.inputs) {
            const slotName = error.target.slotName
            const slot = node.inputs.find((s) => s.name === slotName)
            if (slot) {
              slot.hasErrors = true
            }
          }
        }

        propagateErrorToParents(node)
      }
    },
    { immediate: true }
  )
}

function propagateErrorToParents(node: LGraphNode): void {
  const subgraph = node.graph as Subgraph | undefined
  if (!subgraph || subgraph.isRootGraph) return

  const subgraphId = subgraph.id
  if (!subgraphId) return

  forEachSubgraphNode(app.rootGraph, subgraphId, (subgraphNode) => {
    subgraphNode.has_errors = true
    propagateErrorToParents(subgraphNode)
  })
}
