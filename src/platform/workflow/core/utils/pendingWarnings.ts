import type {
  ComfyWorkflow,
  PendingWarnings
} from '@/platform/workflow/management/stores/comfyWorkflow'
import type { MissingNodeType } from '@/types/comfy'

const emptyToUndefined = <T>(arr: T[] | undefined): T[] | undefined =>
  arr?.length ? arr : undefined

function getMissingNodeKey(node: MissingNodeType): string {
  if (typeof node === 'string') return node
  if (node.nodeId != null) return String(node.nodeId)
  return node.type
}

export function dedupeMissingNodeTypes(
  types: readonly MissingNodeType[]
): MissingNodeType[] {
  const seen = new Set<string>()
  return types.filter((node) => {
    const key = getMissingNodeKey(node)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function removePendingMissingNodeTypesByType(
  currentTypes: readonly MissingNodeType[] | undefined,
  typesToRemove: readonly string[]
): MissingNodeType[] {
  const removeSet = new Set(typesToRemove)
  return dedupeMissingNodeTypes(
    (currentTypes ?? []).filter((node) => {
      const nodeType = typeof node === 'string' ? node : node.type
      return !removeSet.has(nodeType)
    })
  )
}

export function removePendingMissingNodeTypesByNodeId(
  currentTypes: readonly MissingNodeType[] | undefined,
  nodeId: string
): MissingNodeType[] {
  return dedupeMissingNodeTypes(
    (currentTypes ?? []).filter(
      (node) =>
        typeof node === 'string' || String(node.nodeId) !== String(nodeId)
    )
  )
}

export function removePendingMissingNodeTypesByExecutionIdPrefix(
  currentTypes: readonly MissingNodeType[] | undefined,
  prefix: string
): MissingNodeType[] {
  return dedupeMissingNodeTypes(
    (currentTypes ?? []).filter((node) => {
      if (typeof node === 'string' || node.nodeId == null) return true
      return !String(node.nodeId).startsWith(prefix)
    })
  )
}

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
