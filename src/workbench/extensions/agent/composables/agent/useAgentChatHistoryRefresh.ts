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

type HistoryRefreshFailure = Extract<ThreadListing, { status: 'failed' }>

type HistoryRefreshPartial = Extract<ThreadListing, { status: 'incomplete' }>

type HistoryListing = Extract<
  ThreadListing,
  { status: 'complete' | 'incomplete' }
>

type HistoryRefreshDeps = {
  listThreads: AgentRestClient['listThreads']
  history: Pick<
    ReturnType<typeof useAgentChatHistoryStore>,
    'replaceAll' | 'sessions'
  >
  untitledChat: () => string
  /** The listing could not be read at all; nothing was fetched. */
  onFailure: (failure: HistoryRefreshFailure) => void
  /**
   * The listing stopped before its last page. The threads it did reach are
   * already applied, so this is a notice, not an error.
   */
  onPartial: (partial: HistoryRefreshPartial) => void
}

export function useAgentChatHistoryRefresh({
  listThreads,
  history,
  untitledChat,
  onFailure,
  onPartial
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

  /**
   * A truncated listing cannot speak for the threads its missing pages would
   * have carried, so keep the sessions already on screen instead of letting a
   * partial page set delete them.
   */
  function withRetainedSessions(fetched: ChatSession[]): ChatSession[] {
    const fetchedIds = new Set(fetched.map(({ id }) => id))
    return [
      ...fetched,
      ...history.sessions.filter(({ id }) => !fetchedIds.has(id))
    ]
  }

  /**
   * Applies a listing unless a later refresh already won. A stale listing is
   * dropped rather than applied, so it can neither re-add a deleted chat nor
   * trim a newer list.
   */
  function applyListing(listing: HistoryListing, generation: number): void {
    if (generation < latestAppliedRefresh) return
    const fetched = listing.threads.map(toChatSession)
    history.replaceAll(
      listing.status === 'complete' ? fetched : withRetainedSessions(fetched)
    )
    latestAppliedRefresh = generation
  }

  async function refreshHistory(): Promise<void> {
    if (controller.signal.aborted) return
    const { signal } = controller
    const generation = ++latestStartedRefresh
    const result = await listThreads({ signal })
    if (signal.aborted || result.status === 'aborted') return
    const isLatest = generation === latestStartedRefresh
    if (result.status === 'failed') {
      if (isLatest) onFailure(result)
      return
    }
    applyListing(result, generation)
    if (result.status === 'incomplete' && isLatest) onPartial(result)
  }

  return { refreshHistory }
}
