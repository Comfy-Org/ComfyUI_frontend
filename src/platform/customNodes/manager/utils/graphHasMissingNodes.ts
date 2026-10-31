import { unref } from 'vue'
import type { MaybeRef } from 'vue'

import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@comfyorg/litegraph/litegraph'
import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { collectAllNodes } from '@comfyorg/litegraph/utils/graphTraversalUtil'

export type NodeDefLookup = Record<string, ComfyNodeDefImpl | undefined>

const isNodeMissingDefinition = (
  node: LGraphNode,
  nodeDefsByName: NodeDefLookup
) => {
  const nodeName = node.type
  if (!nodeName) return false
  return !nodeDefsByName[nodeName]
}

export const collectMissingNodes = (
  graph: LGraph | Subgraph | null | undefined,
  nodeDefsByName: MaybeRef<NodeDefLookup>
): LGraphNode[] => {
  if (!graph) return []
  const lookup = unref(nodeDefsByName)
  return collectAllNodes(graph, (node) => isNodeMissingDefinition(node, lookup))
}

export const graphHasMissingNodes = (
  graph: LGraph | Subgraph | null | undefined,
  nodeDefsByName: MaybeRef<NodeDefLookup>
) => {
  return collectMissingNodes(graph, nodeDefsByName).length > 0
}
