import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  removePendingMissingNodeTypesByExecutionIdPrefix,
  removePendingMissingNodeTypesByNodeId,
  removePendingMissingNodeTypesByType
} from '@/platform/workflow/core/utils/pendingWarnings'
import { useNodeReplacementStore } from '@/platform/workflowErrors/nodeReplacement/nodeReplacementStore'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import {
  collectAllNodes,
  getExecutionIdByNode
} from '@/utils/graphTraversalUtil'

/** Installed nodes whose definition is deprecated and whose registered replacement can be created. */
export const useDeprecatedNodesStore = defineStore('deprecatedNodes', () => {
  const nodeTypes = ref<MissingNodeType[]>([])

  function rescan(rootGraph: LGraph): void {
    const replacements = useNodeReplacementStore()
    const { nodeDefsByName } = useNodeDefStore()
    nodeTypes.value = collectAllNodes(rootGraph).flatMap(
      (node): MissingNodeType[] => {
        if (!node.type || !nodeDefsByName[node.type]?.deprecated) return []
        const replacement = replacements.getReplacementFor(node.type)
        if (!replacement) return []
        if (!(replacement.new_node_id in LiteGraph.registered_node_types))
          return []
        return [
          {
            type: node.type,
            nodeId: getExecutionIdByNode(rootGraph, node) ?? String(node.id),
            isReplaceable: true,
            replacement
          }
        ]
      }
    )
  }

  function removeByType(types: string[]): void {
    nodeTypes.value = removePendingMissingNodeTypesByType(
      nodeTypes.value,
      types
    )
  }

  /** Removes the node with execution id `executionId` and every node inside it. */
  function removeByNodeId(executionId: string): void {
    nodeTypes.value = removePendingMissingNodeTypesByExecutionIdPrefix(
      removePendingMissingNodeTypesByNodeId(nodeTypes.value, executionId),
      `${executionId}:`
    )
  }

  return { nodeTypes, rescan, removeByType, removeByNodeId }
})
