import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { PromptError } from '@/schemas/apiSchema'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { getLiftedErrorSource } from '@/core/graph/subgraph/liftNodeErrorsToBoundary'
import type { LiftedErrorExtraInfo } from '@/core/graph/subgraph/liftNodeErrorsToBoundary'
import {
  isImageNotLoadedValidationError,
  isMissingNodePromptError
} from '@/utils/executionErrorUtil'
import type { NodeValidationError } from '@/utils/executionErrorUtil'

export type MissingResourceAbsorption = 'missing_model' | 'missing_media'

function normalizePath(value: string): string {
  return value.replace(/[\\/]+/g, '/').replace(/\/+$/, '')
}

function matchesReceivedValue(
  receivedValue: unknown,
  candidateName: string
): boolean {
  if (receivedValue == null) return false

  return normalizePath(String(receivedValue)) === normalizePath(candidateName)
}

function isEligibleValidationError(error: NodeValidationError): boolean {
  return (
    error.type === 'value_not_in_list' || isImageNotLoadedValidationError(error)
  )
}

function matchesErrorNodeId(
  candidateNodeIds: readonly (string | number | null | undefined)[],
  liftedSource: LiftedErrorExtraInfo | null,
  nodeId: NodeExecutionId
): boolean {
  const errorNodeIds = [nodeId, liftedSource?.source_execution_id]
    .filter((id) => id != null)
    .map(String)

  return candidateNodeIds.some(
    (candidateId) =>
      candidateId != null && errorNodeIds.includes(String(candidateId))
  )
}

function matchesErrorInputName(
  candidateNodeIds: readonly (string | number | null | undefined)[],
  candidateInputName: string,
  errorInputName: string | undefined,
  liftedSource: LiftedErrorExtraInfo | null
): boolean {
  if (candidateInputName === errorInputName) return true
  if (!liftedSource) return false

  return (
    candidateInputName === liftedSource.source_input_name &&
    candidateNodeIds.some(
      (id) => id != null && String(id) === liftedSource.source_execution_id
    )
  )
}

function matchesCandidate(
  candidateNodeIds: readonly (string | number | null | undefined)[],
  candidateInputName: string,
  candidateName: string,
  isMissing: boolean | undefined,
  error: NodeValidationError,
  nodeId: NodeExecutionId
): boolean {
  if (isMissing !== true) return false
  const liftedSource = getLiftedErrorSource(error)
  if (!matchesErrorNodeId(candidateNodeIds, liftedSource, nodeId)) {
    return false
  }

  if (
    matchesErrorInputName(
      candidateNodeIds,
      candidateInputName,
      error.extra_info?.input_name,
      liftedSource
    )
  ) {
    return true
  }
  // Value equality alone is too weak a signal when the error names an input:
  // a same-valued sibling widget's genuinely blocking error must stay red.
  if (error.extra_info?.input_name != null) return false
  return matchesReceivedValue(error.extra_info?.received_value, candidateName)
}

function matchesMissingModel(
  candidate: MissingModelCandidate,
  error: NodeValidationError,
  nodeId: NodeExecutionId
): boolean {
  return matchesCandidate(
    [candidate.sourceExecutionId, candidate.nodeId],
    candidate.widgetName,
    candidate.name,
    candidate.isMissing,
    error,
    nodeId
  )
}

function matchesMissingMedia(
  candidate: MissingMediaCandidate,
  error: NodeValidationError,
  nodeId: NodeExecutionId
): boolean {
  return matchesCandidate(
    [candidate.nodeId],
    candidate.widgetName,
    candidate.name,
    candidate.isMissing,
    error,
    nodeId
  )
}

export function getMissingResourceValidationErrorAbsorption(
  missingModels: readonly MissingModelCandidate[] | null,
  missingMedia: readonly MissingMediaCandidate[] | null,
  error: NodeValidationError,
  nodeId: NodeExecutionId
): MissingResourceAbsorption | null {
  if (!isEligibleValidationError(error)) return null

  if (
    missingModels?.some((candidate) =>
      matchesMissingModel(candidate, error, nodeId)
    )
  ) {
    return 'missing_model'
  }
  if (
    missingMedia?.some((candidate) =>
      matchesMissingMedia(candidate, error, nodeId)
    )
  ) {
    return 'missing_media'
  }
  return null
}

export function isMissingNodePromptErrorAbsorbed(
  promptError: PromptError | null,
  hasMissingNodes: boolean
): boolean {
  return isMissingNodePromptError(promptError) && hasMissingNodes
}
