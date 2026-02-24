import type { NodeExecutionId } from '@/types/nodeIdentification'
import type { ComfyNode } from '@/platform/workflow/validation/schemas/workflowSchema'
import { isSubgraphDefinition } from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * Returns all ancestor execution IDs for a given execution ID, including itself.
 *
 * Example: "65:70:63" → ["65", "65:70", "65:70:63"]
 * @knipIgnoreUsedByStackedPR
 */
export function getAncestorExecutionIds(
  executionId: string | NodeExecutionId
): NodeExecutionId[] {
  const parts = executionId.split(':')
  return Array.from({ length: parts.length }, (_, i) =>
    parts.slice(0, i + 1).join(':')
  )
}

/**
 * Returns all ancestor execution IDs for a given execution ID, excluding itself.
 *
 * Example: "65:70:63" → ["65", "65:70"]
 * @knipIgnoreUsedByStackedPR
 */
export function getParentExecutionIds(
  executionId: string | NodeExecutionId
): NodeExecutionId[] {
  return getAncestorExecutionIds(executionId).slice(0, -1)
}

/**
 * "def-A" → ["5", "10"] for each container node instantiating that subgraph definition.
 * @knipIgnoreUsedByStackedPR
 */
export function buildSubgraphExecutionPaths(
  rootNodes: ComfyNode[],
  allSubgraphDefs: unknown[]
): Map<string, string[]> {
  const subgraphDefMap = new Map(
    allSubgraphDefs.filter(isSubgraphDefinition).map((s) => [s.id, s])
  )
  const pathMap = new Map<string, string[]>()
  const visited = new Set<string>()

  const build = (nodes: ComfyNode[], parentPrefix: string) => {
    for (const n of nodes ?? []) {
      if (typeof n.type !== 'string' || !subgraphDefMap.has(n.type)) continue
      const path = parentPrefix ? `${parentPrefix}:${n.id}` : String(n.id)
      const existing = pathMap.get(n.type)
      if (existing) {
        existing.push(path)
      } else {
        pathMap.set(n.type, [path])
      }

      if (visited.has(n.type)) continue
      visited.add(n.type)

      const innerDef = subgraphDefMap.get(n.type)
      if (innerDef) {
        build(innerDef.nodes, path)
      }

      visited.delete(n.type)
    }
  }

  build(rootNodes, '')
  return pathMap
}
