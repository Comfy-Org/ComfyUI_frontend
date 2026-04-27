import type {
  ComfyWorkflow,
  PendingWarnings
} from '@/platform/workflow/management/stores/comfyWorkflow'

function hasPendingWarnings(warnings: PendingWarnings | null | undefined) {
  return (
    !!warnings?.missingNodeTypes?.length ||
    !!warnings?.missingModelCandidates?.length ||
    !!warnings?.missingMediaCandidates?.length
  )
}

export function normalizePendingWarnings(
  warnings: PendingWarnings | null | undefined
): PendingWarnings | null {
  if (!hasPendingWarnings(warnings)) return null

  return {
    missingNodeTypes: warnings?.missingNodeTypes?.length
      ? warnings.missingNodeTypes
      : undefined,
    missingModelCandidates: warnings?.missingModelCandidates?.length
      ? warnings.missingModelCandidates
      : undefined,
    missingMediaCandidates: warnings?.missingMediaCandidates?.length
      ? warnings.missingMediaCandidates
      : undefined
  }
}

export function updatePendingWarnings(
  workflow: Pick<ComfyWorkflow, 'pendingWarnings'> | null | undefined,
  updates: Partial<PendingWarnings>
) {
  if (!workflow) return

  workflow.pendingWarnings = normalizePendingWarnings({
    ...workflow.pendingWarnings,
    ...updates
  })
}
