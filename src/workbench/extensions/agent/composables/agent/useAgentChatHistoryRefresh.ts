import { onScopeDispose } from 'vue'

import type { AgentThreadSummary } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type {
  AgentRestClient,
  ThreadListing
} from '@/workbench/extensions/agent/services/agent/agentRestClient'
import type {
  ChatSession,
  useAgentChatHistoryStore
} from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

type HistoryRefreshFailure = Extract<
  ThreadListing,
  { status: 'incomplete' | 'failed' }
>

type HistoryFailureTreatment = 'error_overlay' | 'none'
type HistoryRefreshOutcome = ThreadListing['status'] | 'superseded'

type HistoryRefreshDeps = {
  listThreads: AgentRestClient['listThreads']
  history: Pick<
    ReturnType<typeof useAgentChatHistoryStore>,
    'replaceAll' | 'sessions'
  >
  untitledChat: () => string
  onFailure: (
    failure: HistoryRefreshFailure,
    uiTreatment: HistoryFailureTreatment
  ) => void
}

export function useAgentChatHistoryRefresh({
  listThreads,
  history,
  untitledChat,
  onFailure
}: HistoryRefreshDeps) {
  let latestStartedRefresh = 0
  let latestAppliedRefresh = 0
  let latestSurfacedRefresh = 0
  const newestSighting = new Map<
    string,
    { generation: number; session: ChatSession }
  >()
  const coveredAt = new Map<string | undefined, number>()
  const controller = new AbortController()

  onScopeDispose(() => controller.abort())

  function toChatSession(thread: AgentThreadSummary): ChatSession {
    const lastActivityAt = [
      thread.last_message_at,
      thread.updated_at,
      thread.created_at
    ]
      .map((stamp) => Date.parse(stamp))
      .find((time) => !Number.isNaN(time))
    return {
      id: thread.id,
      title: thread.title || thread.preview || untitledChat(),
      updatedAt: lastActivityAt ?? Date.now(),
      lastActivityAt,
      titleSource: thread.title ? 'server' : 'fallback',
      workflowId: thread.workflow_id || undefined
    }
  }

  function ownsFailure(
    generation: number,
    uiTreatment: HistoryFailureTreatment
  ): boolean {
    const failureOwner =
      uiTreatment === 'error_overlay'
        ? latestSurfacedRefresh
        : latestStartedRefresh
    return generation === failureOwner && generation > latestAppliedRefresh
  }

  function coverage(workflowId?: string): number {
    const full = coveredAt.get(undefined) ?? 0
    return workflowId ? Math.max(full, coveredAt.get(workflowId) ?? 0) : full
  }

  function record(
    generation: number,
    sessions: ChatSession[],
    workflowId?: string
  ): void {
    for (const session of sessions) {
      if (generation > (newestSighting.get(session.id)?.generation ?? 0))
        newestSighting.set(session.id, { generation, session })
    }
    coveredAt.set(
      workflowId,
      Math.max(coveredAt.get(workflowId) ?? 0, generation)
    )
  }

  function visibleSessions(candidates: ChatSession[]): ChatSession[] {
    const visible = new Map<
      string,
      { generation: number; session: ChatSession }
    >()
    for (const cached of candidates) {
      const sighting = newestSighting.get(cached.id) ?? {
        generation: 0,
        session: cached
      }
      const shown =
        !visible.has(cached.id) &&
        sighting.generation >= coverage(sighting.session.workflowId)
      if (shown) visible.set(cached.id, sighting)
    }
    return [...visible.values()]
      .sort((a, b) => b.generation - a.generation)
      .map(({ session }) => session)
  }

  function pruneCovered(): void {
    const full = coveredAt.get(undefined) ?? 0
    for (const [id, { generation }] of newestSighting) {
      if (generation < full) newestSighting.delete(id)
    }
    for (const [key, covered] of coveredAt) {
      if (key !== undefined && covered <= full) coveredAt.delete(key)
    }
  }

  function applyListing(
    generation: number,
    sessions: ChatSession[],
    workflowId?: string
  ): void {
    record(generation, sessions, workflowId)
    history.replaceAll(visibleSessions([...sessions, ...history.sessions]))
    pruneCovered()
  }

  function applyRefreshResult(
    result: ThreadListing,
    generation: number,
    uiTreatment: HistoryFailureTreatment,
    workflowId?: string
  ): HistoryRefreshOutcome {
    if (controller.signal.aborted || result.status === 'aborted')
      return 'aborted'
    if (result.status !== 'complete') {
      if (!ownsFailure(generation, uiTreatment)) return 'superseded'
      onFailure(result, uiTreatment)
      return result.status
    }
    if (generation < (coveredAt.get(undefined) ?? 0)) return 'superseded'
    const superseded = generation < coverage(workflowId)
    applyListing(generation, result.threads.map(toChatSession), workflowId)
    latestAppliedRefresh = Math.max(latestAppliedRefresh, generation)
    return superseded ? 'superseded' : 'complete'
  }

  async function refreshHistory(
    uiTreatment: HistoryFailureTreatment = 'error_overlay',
    workflowId?: string
  ): Promise<HistoryRefreshOutcome> {
    if (controller.signal.aborted) return 'aborted'
    const { signal } = controller
    const generation = ++latestStartedRefresh
    if (uiTreatment === 'error_overlay') latestSurfacedRefresh = generation
    const result = await listThreads({ signal, workflowId })
    return applyRefreshResult(result, generation, uiTreatment, workflowId)
  }

  return { refreshHistory }
}
