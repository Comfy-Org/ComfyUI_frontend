import { unref } from 'vue'
import type { MaybeRef } from 'vue'

import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { collectAllNodes } from '@/utils/graphTraversalUtil'

type NodeDefLookup = Record<string, unknown>

const isNodeMissingDefinition = (
  node: LGraphNode,
  nodeDefsByName: NodeDefLookup
) => {
  const nodeName = node?.type
  if (!nodeName) return false
  return !nodeDefsByName[nodeName]
}

export const collectMissingNodes = (
  graph: LGraph | Subgraph | null | undefined,
  nodeDefsByName: MaybeRef<NodeDefLookup>
): LGraphNode[] => {
  if (!graph) return []
  const lookup = unref(nodeDefsByName) ?? {}
  return collectAllNodes(graph, (node) => isNodeMissingDefinition(node, lookup))
}

export const graphHasMissingNodes = (
  graph: LGraph | Subgraph | null | undefined,
  nodeDefsByName: MaybeRef<NodeDefLookup>
) => {
  return collectMissingNodes(graph, nodeDefsByName).length > 0
}
