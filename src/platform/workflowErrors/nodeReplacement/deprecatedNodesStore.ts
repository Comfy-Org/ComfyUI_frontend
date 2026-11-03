import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  removePendingMissingNodeTypesByExecutionIdPrefix,
  removePendingMissingNodeTypesByNodeId,
  removePendingMissingNodeTypesByType
} from '@/platform/workflow/core/utils/pendingWarnings'
import { useNodeReplacementStore } from '@/platform/workflowErrors/nodeReplacement/nodeReplacementStore'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import {
  getExecutionIdByNode,
  isExecutionPathActive,
  mapUniqueNodes
} from '@/utils/graphTraversalUtil'

/** Installed nodes whose definition is deprecated and whose registered replacement can be created. */
export const useDeprecatedNodesStore = defineStore('deprecatedNodes', () => {
  const nodeTypes = ref<MissingNodeType[]>([])

  function entryFor(
    node: LGraphNode,
    nodeId: string
  ): MissingNodeType | undefined {
    if (!node.constructor.nodeData?.deprecated) return undefined
    const replacement = useNodeReplacementStore().getReplacementFor(node.type)
    if (!replacement) return undefined
    if (!(replacement.new_node_id in LiteGraph.registered_node_types))
      return undefined
    return { type: node.type, nodeId, isReplaceable: true, replacement }
  }

  function rescan(rootGraph: LGraph | undefined): void {
    if (!rootGraph) {
      nodeTypes.value = []
      return
    }
    nodeTypes.value = mapUniqueNodes(rootGraph, (node) => {
      const nodeId = getExecutionIdByNode(rootGraph, node)
      if (!nodeId || !isExecutionPathActive(rootGraph, nodeId)) return undefined
      return entryFor(node, nodeId)
    })
  }

  function addNode(node: LGraphNode, executionId: string): void {
    const entry = entryFor(node, executionId)
    if (!entry) return
    const listed = nodeTypes.value.some(
      (nodeType) =>
        typeof nodeType !== 'string' && nodeType.nodeId === executionId
    )
    if (!listed) nodeTypes.value = [...nodeTypes.value, entry]
  }

  function removeByType(types: string[]): void {
    nodeTypes.value = removePendingMissingNodeTypesByType(
      nodeTypes.value,
      types
    )
  }

  function removeByNodeId(executionId: string): void {
    nodeTypes.value = removePendingMissingNodeTypesByExecutionIdPrefix(
      removePendingMissingNodeTypesByNodeId(nodeTypes.value, executionId),
      `${executionId}:`
    )
  }

  return { nodeTypes, rescan, addNode, removeByType, removeByNodeId }
})
