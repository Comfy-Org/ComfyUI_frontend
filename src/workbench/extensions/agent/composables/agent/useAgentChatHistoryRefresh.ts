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

type HistoryRefreshDeps = {
  listThreads: AgentRestClient['listThreads']
  history: Pick<ReturnType<typeof useAgentChatHistoryStore>, 'replaceAll'>
  untitledChat: () => string
  onFailure: (failure: HistoryRefreshFailure) => void
}

export function useAgentChatHistoryRefresh({
  listThreads,
  history,
  untitledChat,
  onFailure
}: HistoryRefreshDeps) {
  let latestStartedRefresh = 0
  let latestAppliedRefresh = 0
  const controller = new AbortController()

  onScopeDispose(() => controller.abort())

  function toChatSession(thread: AgentThreadSummary): ChatSession {
    const stamp = thread.last_message_at
    const updatedAt = stamp ? Date.parse(stamp) : Date.now()
    return {
      id: thread.id,
      title: thread.title || thread.preview || untitledChat(),
      updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt,
      titleSource: thread.title ? 'server' : 'fallback'
    }
  }

  async function refreshHistory(): Promise<void> {
    if (controller.signal.aborted) return
    const { signal } = controller
    const generation = ++latestStartedRefresh
    const result = await listThreads({ signal })
    if (signal.aborted || result.status === 'aborted') return
    if (result.status !== 'complete') {
      if (generation === latestStartedRefresh) onFailure(result)
      return
    }
    if (generation < latestAppliedRefresh) return
    const sessions = result.threads.map(toChatSession)
    history.replaceAll(sessions)
    latestAppliedRefresh = generation
  }

  return { refreshHistory }
}
