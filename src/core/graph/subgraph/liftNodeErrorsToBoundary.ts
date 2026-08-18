import { groupBy, partition } from 'es-toolkit'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { NodeError } from '@/schemas/apiSchema'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { isNodeLevelValidationError } from '@/utils/executionErrorUtil'
import type { NodeValidationError } from '@/utils/executionErrorUtil'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { isSubgraph } from '@/utils/typeGuardUtil'

export interface LiftedErrorExtraInfo {
  input_name: string
  source_execution_id: string
  source_input_name: string
}

export interface LiftedSurface {
  hostExecId: NodeExecutionId
  hostInputName: string
}

interface ErrorPlacement {
  kind: 'own' | 'lifted'
  targetExecId: string
  error: NodeValidationError
}

export function getLiftedErrorSource(
  error: NodeValidationError
): LiftedErrorExtraInfo | null {
  const extraInfo = error.extra_info
  if (!extraInfo) return null

  const { input_name, source_execution_id, source_input_name } = extraInfo
  if (
    typeof input_name !== 'string' ||
    typeof source_execution_id !== 'string' ||
    typeof source_input_name !== 'string'
  ) {
    return null
  }

  return { input_name, source_execution_id, source_input_name }
}

function getHostExecutionId(executionId: string): NodeExecutionId | null {
  const separatorIndex = executionId.lastIndexOf(':')
  if (separatorIndex <= 0) return null
  return tryNormalizeNodeExecutionId(executionId.slice(0, separatorIndex))
}

/**
 * Boundary surfaces that expose `(executionId, inputName)`, innermost first.
 * Walks one host per level and stops at the last resolvable surface, so an
 * unresolvable deeper host falls back to the shallower one (fail-open).
 */
export function resolveLiftChain(
  rootGraph: LGraph,
  executionId: string,
  inputName: string
): LiftedSurface[] {
  const chain: LiftedSurface[] = []
  let currentExecId = executionId
  let currentInputName = inputName

  for (;;) {
    const node = getNodeByExecutionId(rootGraph, currentExecId)
    const graph = node?.graph
    if (!node || !graph || !isSubgraph(graph)) break

    const slot = node.inputs?.find((input) => input.name === currentInputName)
    if (slot?.link == null) break

    const subgraphInput = graph
      .getLink(slot.link)
      ?.resolve(graph)?.subgraphInput
    if (!subgraphInput) break

    const hostExecId = getHostExecutionId(currentExecId)
    if (!hostExecId || !getNodeByExecutionId(rootGraph, hostExecId)) break

    chain.push({ hostExecId, hostInputName: subgraphInput.name })
    currentExecId = hostExecId
    currentInputName = subgraphInput.name
  }

  return chain
}

function createEmptyNodeError(nodeError: NodeError): NodeError {
  return {
    ...nodeError,
    errors: []
  }
}

// Lifted host entries use the host title for display; SubgraphNode.type is a UUID.
function createLiftedHostEntry(
  rootGraph: LGraph,
  hostExecId: string
): NodeError {
  return {
    class_type:
      getNodeByExecutionId(rootGraph, hostExecId)?.title ?? hostExecId,
    dependent_outputs: [],
    errors: []
  }
}

function toErrorPlacement(
  rootGraph: LGraph,
  executionId: string,
  error: NodeValidationError
): ErrorPlacement {
  const inputName = error.extra_info?.input_name
  const surface =
    inputName && !isNodeLevelValidationError(error)
      ? resolveLiftChain(rootGraph, executionId, inputName).at(-1)
      : undefined

  if (!inputName || !surface) {
    return {
      kind: 'own',
      targetExecId: executionId,
      error
    }
  }

  const liftedExtraInfo: LiftedErrorExtraInfo = {
    input_name: surface.hostInputName,
    source_execution_id: executionId,
    source_input_name: inputName
  }

  return {
    kind: 'lifted',
    targetExecId: surface.hostExecId,
    error: {
      ...error,
      extra_info: {
        ...error.extra_info,
        ...liftedExtraInfo
      }
    }
  }
}

export function liftNodeErrorsToBoundary(
  rootGraph: LGraph,
  nodeErrors: Record<string, NodeError>
): Record<string, NodeError> {
  const output: Record<string, NodeError> = {}
  const placements = Object.entries(nodeErrors).flatMap(
    ([executionId, nodeError]) =>
      nodeError.errors.map((error) =>
        toErrorPlacement(rootGraph, executionId, error)
      )
  )

  for (const [executionId, nodeError] of Object.entries(nodeErrors)) {
    if (nodeError.errors.length === 0) {
      output[executionId] = createEmptyNodeError(nodeError)
    }
  }

  const placementsByTarget = groupBy(
    placements,
    (placement) => placement.targetExecId
  )

  for (const [targetExecId, targetPlacements] of Object.entries(
    placementsByTarget
  )) {
    const baseEntry = nodeErrors[targetExecId]
      ? createEmptyNodeError(nodeErrors[targetExecId])
      : createLiftedHostEntry(rootGraph, targetExecId)

    const [ownErrors, liftedErrors] = partition(
      targetPlacements,
      (placement) => placement.kind === 'own'
    )

    output[targetExecId] = {
      ...baseEntry,
      errors: [...ownErrors, ...liftedErrors].map(
        (placement) => placement.error
      )
    }
  }

  return output
}
