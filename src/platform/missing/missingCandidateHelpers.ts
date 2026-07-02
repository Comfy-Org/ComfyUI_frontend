import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { getAncestorExecutionIds } from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { getActiveGraphNodeIds } from '@/utils/graphTraversalUtil'

interface VerificationAbortController {
  create(): AbortController
  abort(): void
}

export function createVerificationAbortController(): VerificationAbortController {
  let controller: AbortController | null = null
  return {
    create() {
      controller?.abort()
      controller = new AbortController()
      return controller
    },
    abort() {
      controller?.abort()
      controller = null
    }
  }
}

/**
 * Set of all execution ID prefixes derived from the given node IDs,
 * including the nodes themselves.
 *
 * Example: node "65:70:63" → Set { "65", "65:70", "65:70:63" }
 */
export function computeAncestorExecutionIds(
  nodeIds: Iterable<string>
): Set<NodeExecutionId> {
  const ids = new Set<NodeExecutionId>()
  for (const nodeId of nodeIds) {
    for (const id of getAncestorExecutionIds(nodeId)) {
      ids.add(id)
    }
  }
  return ids
}

export function computeActiveGraphIds(
  currentGraph: LGraph | null,
  ancestorExecutionIds: Set<NodeExecutionId>
): Set<string> {
  if (!app.rootGraph) return new Set()
  return getActiveGraphNodeIds(
    app.rootGraph,
    currentGraph ?? app.rootGraph,
    ancestorExecutionIds
  )
}
