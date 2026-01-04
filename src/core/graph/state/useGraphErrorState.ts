import { watch } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import {
  forEachNode,
  forEachSubgraphNode,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'

import { useGraphStateStore } from './graphStateStore'

const propagateErrorToParents = (node: LGraphNode): void => {
  const subgraph = node.graph
  if (!subgraph || subgraph.isRootGraph) return

  forEachSubgraphNode(app.rootGraph, subgraph.id, (subgraphNode) => {
    subgraphNode.has_errors = true
    propagateErrorToParents(subgraphNode)
  })
}

export const useGraphErrorState = () => {
  const store = useGraphStateStore()

  watch(
    () => store.stateRef,
    () => {
      if (!app.rootGraph) return

      forEachNode(app.rootGraph, (node) => {
        node.has_errors = false
      })

      for (const locatorId of store.getNodesWithErrors()) {
        const node = getNodeByLocatorId(app.rootGraph, locatorId)
        if (!node) continue

        node.has_errors = true
        propagateErrorToParents(node)
      }
    },
    { immediate: true }
  )
}
