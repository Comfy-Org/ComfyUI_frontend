import { isValidUuid } from '@/utils/formatUtil'

export function areAgentWorkflowIdsEquivalent(
  existingId: string,
  incomingId: string
): boolean {
  if (existingId === incomingId) return true
  return (
    isValidUuid(existingId) &&
    isValidUuid(incomingId) &&
    existingId.toLowerCase() === incomingId.toLowerCase()
  )
}

export function canonicalAgentWorkflowId(workflowId: string): string {
  return isValidUuid(workflowId) ? workflowId.toLowerCase() : workflowId
}
