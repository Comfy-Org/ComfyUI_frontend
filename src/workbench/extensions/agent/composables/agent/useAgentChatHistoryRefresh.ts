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
  history: Pick<ReturnType<typeof useAgentChatHistoryStore>, 'replaceAll'>
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

  async function refreshHistory(
    uiTreatment: HistoryFailureTreatment = 'error_overlay'
  ): Promise<HistoryRefreshOutcome> {
    if (controller.signal.aborted) return 'aborted'
    const { signal } = controller
    const generation = ++latestStartedRefresh
    if (uiTreatment === 'error_overlay') latestSurfacedRefresh = generation
    const result = await listThreads({ signal })
    if (signal.aborted || result.status === 'aborted') return 'aborted'
    if (result.status !== 'complete') {
      if (!ownsFailure(generation, uiTreatment)) return 'superseded'
      onFailure(result, uiTreatment)
      return result.status
    }
    if (generation < latestAppliedRefresh) return 'superseded'
    const sessions = result.threads.map(toChatSession)
    history.replaceAll(sessions)
    latestAppliedRefresh = generation
    return 'complete'
  }

  return { refreshHistory }
}
