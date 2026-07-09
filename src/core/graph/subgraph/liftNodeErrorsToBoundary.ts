import { groupBy, partition } from 'es-toolkit'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { NodeError } from '@/schemas/apiSchema'
import {
  createNodeExecutionId,
  parseNodeExecutionId
} from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { isNodeLevelValidationError } from '@/utils/executionErrorUtil'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { isSubgraph } from '@/utils/typeGuardUtil'

type NodeValidationError = NodeError['errors'][number]

export interface LiftedErrorExtraInfo {
  input_name: string
  source_execution_id: string
  source_input_name: string
}

interface LiftedSurface {
  hostExecId: NodeExecutionId
  hostInputName: string
  hostTitle: string
}

interface OwnErrorPlacement {
  kind: 'own'
  targetExecId: string
  error: NodeValidationError
}

interface LiftedErrorPlacement {
  kind: 'lifted'
  targetExecId: string
  targetTitle: string
  error: NodeValidationError
}

type ErrorPlacement = OwnErrorPlacement | LiftedErrorPlacement

export function getLiftedErrorSource(
  error: NodeError['errors'][number]
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

// Lifted host entries use the host title for display; SubgraphNode.type is a UUID.
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
    inputName && !isNodeLevelValidationError(error)
      ? resolveLiftedSurface(rootGraph, executionId, inputName)
      : null

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
    targetTitle: surface.hostTitle,
    error: {
      ...error,
      extra_info: {
        ...error.extra_info,
        ...liftedExtraInfo
      }
    }
  }
}

function getLiftedTargetTitle(placements: ErrorPlacement[]): string {
  const liftedPlacement = placements.find(
    (placement): placement is LiftedErrorPlacement =>
      placement.kind === 'lifted'
  )
  if (!liftedPlacement) {
    throw new Error('Expected lifted placement to provide a target title')
  }
  return liftedPlacement.targetTitle
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
      : createLiftedHostEntry(getLiftedTargetTitle(targetPlacements))

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
