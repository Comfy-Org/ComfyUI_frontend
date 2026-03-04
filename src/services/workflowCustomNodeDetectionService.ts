import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { collectAllNodes } from '@/utils/graphTraversalUtil'

/**
 * Collects the unique set of node types used in a graph that are not
 * part of the core ComfyUI node definitions (i.e. custom/extension nodes).
 */
export function detectCustomNodeTypes(
  graph: LGraph | Subgraph | null | undefined,
  coreNodeDefs: Record<string, ComfyNodeDefImpl | undefined>
): string[] {
  if (!graph) return []

  const customNodes = collectAllNodes(graph, ({ type }) => {
    return !!type && !coreNodeDefs[type]
  })

  return [...new Set(customNodes.map((node) => node.type!))]
}
