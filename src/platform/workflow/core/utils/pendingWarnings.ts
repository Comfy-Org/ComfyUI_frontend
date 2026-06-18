import type {
  ComfyWorkflow,
  PendingWarnings
} from '@/platform/workflow/management/stores/comfyWorkflow'

const emptyToUndefined = <T>(arr: T[] | undefined): T[] | undefined =>
  arr?.length ? arr : undefined

export function normalizePendingWarnings(
  warnings: PendingWarnings | null | undefined
): PendingWarnings | null {
  if (!warnings) return null

  const normalized: PendingWarnings = {
    missingNodeTypes: emptyToUndefined(warnings.missingNodeTypes),
    missingModelCandidates: emptyToUndefined(warnings.missingModelCandidates),
    missingMediaCandidates: emptyToUndefined(warnings.missingMediaCandidates)
  }

  return Object.values(normalized).some(Boolean) ? normalized : null
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
