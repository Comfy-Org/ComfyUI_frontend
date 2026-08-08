import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { isSubgraph } from '@/utils/typeGuardUtil'

interface PromotedInputBoundary {
  hostExecutionId: NodeExecutionId
  inputName: string
}

function getHostExecutionId(executionId: string): NodeExecutionId | null {
  const separatorIndex = executionId.lastIndexOf(':')
  if (separatorIndex <= 0) return null
  return tryNormalizeNodeExecutionId(executionId.slice(0, separatorIndex))
}

/** Resolves promoted input boundaries from the innermost host outward. */
export function resolvePromotedInputBoundaryChain(
  rootGraph: LGraph,
  executionId: string,
  inputName: string
): PromotedInputBoundary[] {
  const chain: PromotedInputBoundary[] = []
  let currentExecutionId = executionId
  let currentInputName = inputName

  for (;;) {
    const node = getNodeByExecutionId(rootGraph, currentExecutionId)
    const graph = node?.graph
    if (!node || !graph || !isSubgraph(graph)) break

    const slot = node.inputs?.find((input) => input.name === currentInputName)
    if (slot?.link == null) break

    const subgraphInput = graph
      .getLink(slot.link)
      ?.resolve(graph)?.subgraphInput
    if (!subgraphInput) break

    const hostExecutionId = getHostExecutionId(currentExecutionId)
    if (!hostExecutionId || !getNodeByExecutionId(rootGraph, hostExecutionId)) {
      break
    }

    chain.push({ hostExecutionId, inputName: subgraphInput.name })
    currentExecutionId = hostExecutionId
    currentInputName = subgraphInput.name
  }

  return chain
}
