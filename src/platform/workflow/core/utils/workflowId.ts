import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  generateUUID,
  isValidUuid
} from '@comfyorg/shared-frontend-utils/formatUtil'

type WorkflowWithId = ComfyWorkflowJSON & { id: string }

function hasWorkflowId(
  workflowData: ComfyWorkflowJSON
): workflowData is WorkflowWithId {
  return isValidUuid(workflowData.id)
}

export function getLegacyWorkflowId(
  id: string | undefined
): string | undefined {
  return id && !isValidUuid(id) ? id : undefined
}

export function ensureWorkflowId(
  workflowData: ComfyWorkflowJSON,
  fallbackId?: string
): WorkflowWithId {
  if (hasWorkflowId(workflowData)) return workflowData
  return {
    ...workflowData,
    id: isValidUuid(fallbackId) ? fallbackId : generateUUID()
  }
}

export function areWorkflowIdsEquivalent(
  existingId: string | undefined,
  incomingId: string | undefined,
  existingLegacyId?: string
): boolean {
  if (isValidUuid(existingId) && isValidUuid(incomingId)) {
    return existingId.toLowerCase() === incomingId.toLowerCase()
  }

  const incomingLegacyId = getLegacyWorkflowId(incomingId)
  if (incomingLegacyId) {
    return (
      incomingLegacyId === existingLegacyId || incomingLegacyId === existingId
    )
  }

  return !existingId || !incomingId
}
