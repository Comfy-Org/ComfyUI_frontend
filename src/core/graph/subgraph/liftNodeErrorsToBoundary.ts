import { groupBy, partition } from 'es-toolkit'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { NodeError } from '@/schemas/apiSchema'
import {
  createNodeExecutionId,
  parseNodeExecutionId
} from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { isImageNotLoadedValidationError } from '@/utils/executionErrorUtil'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { isSubgraph } from '@/utils/typeGuardUtil'

type NodeValidationError = NodeError['errors'][number]

interface LiftedSurface {
  hostExecId: NodeExecutionId
  hostInputName: string
  hostTitle: string
}

interface ErrorPlacement {
  sourceExecId: string
  targetExecId: string
  targetTitle?: string
  error: NodeValidationError
}

// Mirrors validationErrorResolver's node-level type classification; keep in sync.
const NODE_LEVEL_ERROR_TYPES = new Set([
  'exception_during_validation',
  'dependency_cycle'
])

function isNodeLevelError(error: NodeValidationError): boolean {
  return (
    NODE_LEVEL_ERROR_TYPES.has(error.type) ||
    isImageNotLoadedValidationError(error)
  )
}

function getHostExecutionId(executionId: string): NodeExecutionId | null {
  const nodeIds = parseNodeExecutionId(executionId)
  if (!nodeIds || nodeIds.length < 2) return null

  return createNodeExecutionId(nodeIds.slice(0, -1))
}

function resolveLiftedSurface(
  rootGraph: LGraph,
  executionId: string,
  inputName: string
): LiftedSurface | null {
  const node = getNodeByExecutionId(rootGraph, executionId)
  const graph = node?.graph
  if (!node || !graph || !isSubgraph(graph)) return null

  const slot = node.inputs?.find((input) => input.name === inputName)
  if (!slot || slot.link == null) return null

  const link = graph.getLink(slot.link)
  if (!link?.originIsIoNode) return null

  const subgraphInput = graph.inputNode.slots[link.origin_slot]
  if (!subgraphInput) return null

  const hostExecId = getHostExecutionId(executionId)
  if (!hostExecId) return null

  const hostNode = getNodeByExecutionId(rootGraph, hostExecId)
  if (!hostNode) return null

  const hostInputName = subgraphInput.name
  return (
    resolveLiftedSurface(rootGraph, hostExecId, hostInputName) ?? {
      hostExecId,
      hostInputName,
      hostTitle: hostNode.title
    }
  )
}

function createEmptyNodeError(nodeError: NodeError): NodeError {
  return {
    ...nodeError,
    errors: []
  }
}

function createLiftedHostEntry(hostTitle: string): NodeError {
  return {
    class_type: hostTitle,
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
    inputName && !isNodeLevelError(error)
      ? resolveLiftedSurface(rootGraph, executionId, inputName)
      : null

  if (!inputName || !surface) {
    return {
      sourceExecId: executionId,
      targetExecId: executionId,
      error
    }
  }

  return {
    sourceExecId: executionId,
    targetExecId: surface.hostExecId,
    targetTitle: surface.hostTitle,
    error: {
      ...error,
      extra_info: {
        ...error.extra_info,
        input_name: surface.hostInputName,
        source_execution_id: executionId,
        source_input_name: inputName
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
      : createLiftedHostEntry(targetPlacements[0]?.targetTitle ?? '')

    const [ownErrors, liftedErrors] = partition(
      targetPlacements,
      (placement) => placement.sourceExecId === targetExecId
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
