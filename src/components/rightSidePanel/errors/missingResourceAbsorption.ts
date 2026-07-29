import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { isImageNotLoadedValidationError } from '@/utils/executionErrorUtil'
import type { NodeValidationError } from '@/utils/executionErrorUtil'

function normalizePath(value: string): string {
  return value
    .replace(/[\\/]+/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase()
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
  error: NodeValidationError,
  nodeId: NodeExecutionId
): boolean {
  const errorNodeIds = [nodeId, error.extra_info?.source_execution_id]
    .filter((id) => id != null)
    .map(String)

  return candidateNodeIds.some(
    (candidateId) =>
      candidateId != null && errorNodeIds.includes(String(candidateId))
  )
}

function matchesMissingModel(
  candidate: MissingModelCandidate,
  error: NodeValidationError,
  nodeId: NodeExecutionId
): boolean {
  if (candidate.isMissing === false) return false
  if (
    !matchesErrorNodeId(
      [candidate.sourceExecutionId, candidate.nodeId],
      error,
      nodeId
    )
  ) {
    return false
  }

  return (
    candidate.widgetName === error.extra_info?.input_name ||
    matchesReceivedValue(error.extra_info?.received_value, candidate.name)
  )
}

function matchesMissingMedia(
  candidate: MissingMediaCandidate,
  error: NodeValidationError,
  nodeId: NodeExecutionId
): boolean {
  if (
    candidate.isMissing === false ||
    !matchesErrorNodeId([candidate.nodeId], error, nodeId)
  ) {
    return false
  }

  return (
    candidate.widgetName === error.extra_info?.input_name ||
    matchesReceivedValue(error.extra_info?.received_value, candidate.name)
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
