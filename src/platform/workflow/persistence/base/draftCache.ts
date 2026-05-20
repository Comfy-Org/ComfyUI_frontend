export interface WorkflowDraftSnapshot {
  data: string
  updatedAt: number
  name: string
  isTemporary: boolean
}

export interface DraftCacheState {
  drafts: Record<string, WorkflowDraftSnapshot>
  order: string[]
}

export const MAX_DRAFTS = 32

export function createDraftCacheState(
  drafts: Record<string, WorkflowDraftSnapshot> = {},
  order: string[] = []
): DraftCacheState {
  return { drafts, order }
}

export function touchEntry(order: string[], path: string): string[] {
  const next = order.filter((entry) => entry !== path)
  next.push(path)
  return next
}

export function upsertDraft(
  state: DraftCacheState,
  path: string,
  snapshot: WorkflowDraftSnapshot,
  limit: number = MAX_DRAFTS
): DraftCacheState {
  const effectiveLimit = Math.max(1, limit)
  const drafts = { ...state.drafts, [path]: snapshot }
  const order = touchEntry(state.order, path)

  while (order.length > effectiveLimit) {
    const oldest = order.shift()
    if (!oldest) continue
    if (oldest !== path) {
      delete drafts[oldest]
    }
  }

  return createDraftCacheState(drafts, order)
}

export function removeDraft(
  state: DraftCacheState,
  path: string
): DraftCacheState {
  if (!(path in state.drafts)) return state
  const drafts = { ...state.drafts }
  delete drafts[path]
  const order = state.order.filter((entry) => entry !== path)
  return createDraftCacheState(drafts, order)
}

export function moveDraft(
  state: DraftCacheState,
  oldPath: string,
  newPath: string,
  name: string
): DraftCacheState {
  const draft = state.drafts[oldPath]
  if (!draft) return state
  const updatedDraft = { ...draft, name }
  const drafts = { ...state.drafts }
  delete drafts[oldPath]
  drafts[newPath] = updatedDraft
  const order = touchEntry(
    state.order.filter((entry) => entry !== oldPath && entry !== newPath),
    newPath
  )
  return createDraftCacheState(drafts, order)
}

export function mostRecentDraftPath(order: string[]): string | null {
  return order.length ? order[order.length - 1] : null
}
