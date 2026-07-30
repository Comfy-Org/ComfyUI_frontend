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
  error: NodeValidationError,
  liftedSource: LiftedErrorExtraInfo | null
): boolean {
  if (candidateInputName === error.extra_info?.input_name) return true
  if (!liftedSource) return false

  return (
    candidateInputName === liftedSource.source_input_name &&
    candidateNodeIds.some(
      (id) => id != null && String(id) === liftedSource.source_execution_id
    )
  )
}

function matchesMissingModel(
  candidate: MissingModelCandidate,
  error: NodeValidationError,
  nodeId: NodeExecutionId
): boolean {
  if (candidate.isMissing === false) return false
  const candidateNodeIds = [candidate.sourceExecutionId, candidate.nodeId]
  const liftedSource = getLiftedErrorSource(error)
  if (!matchesErrorNodeId(candidateNodeIds, liftedSource, nodeId)) {
    return false
  }

  return (
    matchesErrorInputName(
      candidateNodeIds,
      candidate.widgetName,
      error,
      liftedSource
    ) || matchesReceivedValue(error.extra_info?.received_value, candidate.name)
  )
}

function matchesMissingMedia(
  candidate: MissingMediaCandidate,
  error: NodeValidationError,
  nodeId: NodeExecutionId
): boolean {
  if (candidate.isMissing === false) return false
  const candidateNodeIds = [candidate.nodeId]
  const liftedSource = getLiftedErrorSource(error)
  if (!matchesErrorNodeId(candidateNodeIds, liftedSource, nodeId)) {
    return false
  }

  return (
    matchesErrorInputName(
      candidateNodeIds,
      candidate.widgetName,
      error,
      liftedSource
    ) || matchesReceivedValue(error.extra_info?.received_value, candidate.name)
  )
}

export function getMissingResourceValidationErrorAbsorption(
  missingModels: readonly MissingModelCandidate[] | null | undefined,
  missingMedia: readonly MissingMediaCandidate[] | null | undefined,
  error: NodeValidationError,
  nodeId: NodeExecutionId
): 'missing_model' | 'missing_media' | null {
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
  promptError: PromptError | null | undefined,
  hasMissingNodes: boolean
): boolean {
  return isMissingNodePromptError(promptError) && hasMissingNodes
}
