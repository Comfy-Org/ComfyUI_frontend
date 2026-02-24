import type { NodeExecutionId } from '@/types/nodeIdentification'
import type { ComfyNode } from '@/platform/workflow/validation/schemas/workflowSchema'
import { isSubgraphDefinition } from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * Returns all ancestor execution IDs for a given execution ID, including itself.
 *
 * Example: "65:70:63" → ["65", "65:70", "65:70:63"]
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
 */
export function getParentExecutionIds(
  executionId: string | NodeExecutionId
): NodeExecutionId[] {
  return getAncestorExecutionIds(executionId).slice(0, -1)
}

/** "def-A" → ["5", "10"] for each container node instantiating that subgraph definition. */
export function buildSubgraphExecutionPaths(
  rootNodes: ComfyNode[],
  allSubgraphDefs: unknown[]
): Map<string, string[]> {
  const subgraphDefIds = new Set(
    allSubgraphDefs.filter(isSubgraphDefinition).map((s) => s.id)
  )
  const pathMap = new Map<string, string[]>()

  const build = (nodes: ComfyNode[], parentPrefix: string) => {
    for (const n of nodes ?? []) {
      if (typeof n.type !== 'string' || !subgraphDefIds.has(n.type)) continue
      const path = parentPrefix ? `${parentPrefix}:${n.id}` : String(n.id)
      const existing = pathMap.get(n.type)
      if (existing) {
        existing.push(path)
      } else {
        pathMap.set(n.type, [path])
      }
      const innerDef = allSubgraphDefs.find(
        (s) => isSubgraphDefinition(s) && s.id === n.type
      )
      if (innerDef && isSubgraphDefinition(innerDef)) {
        build(innerDef.nodes, path)
      }
    }
  }

  build(rootNodes, '')
  return pathMap
}
