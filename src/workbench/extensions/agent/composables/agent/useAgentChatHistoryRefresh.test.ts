import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import type {
  AgentRestClient,
  ThreadListing
} from '../../services/agent/agentRestClient'
import { useAgentChatHistoryStore } from '../../stores/agent/agentChatHistoryStore'
import { useAgentChatHistoryRefresh } from './useAgentChatHistoryRefresh'

function completedListing(id: string): ThreadListing {
  return {
    status: 'complete',
    threads: [
      {
        id,
        title: id,
        preview: '',
        workflow_id: '',
        status: 'active',
        message_count: 1,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-20T00:00:00Z',
        last_message_at: '2026-10-01T00:00:00Z'
      }
    ]
  }
}

function deferredListing() {
  let resolve!: (result: ThreadListing) => void
  const promise = new Promise<ThreadListing>((resolveResult) => {
    resolve = resolveResult
  })
  return { promise, resolve }
}

function setup() {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const history = useAgentChatHistoryStore()
  history.replaceAll([
    { id: 'kept', title: 'Kept', titleSource: 'server', updatedAt: 1 }
  ])
  const listThreads = vi.fn<AgentRestClient['listThreads']>(async () => ({
    status: 'complete',
    threads: []
  }))
  const onFailure = vi.fn()
  const refresh = scope.run(() =>
    useAgentChatHistoryRefresh({
      listThreads,
      history,
      untitledChat: () => 'Untitled chat',
      onFailure
    })
  )
  assert.exists(refresh)
  return { ...refresh, scope, history, listThreads, onFailure }
}

const missingCursor: ThreadListing = {
  status: 'incomplete',
  reason: 'missing_cursor'
}
const requestFailure: ThreadListing = {
  status: 'failed',
  cause: new TypeError('Failed to fetch')
}

const failures = [
  missingCursor,
  { status: 'incomplete', reason: 'repeated_cursor' },
  requestFailure
] satisfies ThreadListing[]

const lateResults = [
  { name: 'success', result: completedListing('older') },
  { name: 'incomplete listing', result: missingCursor },
  { name: 'request failure', result: requestFailure }
]

describe('useAgentChatHistoryRefresh', () => {
  it.for(failures)(
    'retains history and reports a $status outcome',
    async (failure) => {
      const { history, listThreads, onFailure, refreshHistory } = setup()
      listThreads.mockResolvedValueOnce(failure)

      await refreshHistory()

      expect(history.sessions.map(({ id }) => id)).toEqual(['kept'])
      expect(onFailure).toHaveBeenCalledExactlyOnceWith(failure)
    }
  )

  it.for(lateResults)(
    'ignores an older $name after a newer refresh succeeds',
    async ({ result }) => {
      const { history, listThreads, onFailure, refreshHistory } = setup()
      const older = deferredListing()
      listThreads.mockReturnValueOnce(older.promise)
      const olderRefresh = refreshHistory()
      listThreads.mockResolvedValueOnce(completedListing('newer'))
      await refreshHistory()

      older.resolve(result)
      await olderRefresh

      expect(history.sessions.map(({ id }) => id)).toEqual(['newer'])
      expect(onFailure).not.toHaveBeenCalled()
    }
  )

  it('applies an older successful refresh after a newer refresh fails', async () => {
    const { history, listThreads, onFailure, refreshHistory } = setup()
    const older = deferredListing()
    listThreads.mockReturnValueOnce(older.promise)
    const olderRefresh = refreshHistory()
    listThreads.mockResolvedValueOnce(requestFailure)
    await refreshHistory()

    older.resolve(completedListing('older'))
    await olderRefresh

    expect(history.sessions).toEqual([
      {
        id: 'older',
        title: 'older',
        titleSource: 'server',
        updatedAt: 1790812800000
      }
    ])
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(requestFailure)
  })

  it('only reports the newest request even while it is pending', async () => {
    const { history, listThreads, onFailure, refreshHistory } = setup()
    const older = deferredListing()
    const newer = deferredListing()
    listThreads
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise)
    const olderRefresh = refreshHistory()
    const newerRefresh = refreshHistory()

    older.resolve(missingCursor)
    await olderRefresh
    expect(onFailure).not.toHaveBeenCalled()
    newer.resolve(requestFailure)
    await newerRefresh

    expect(history.sessions.map(({ id }) => id)).toEqual(['kept'])
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(requestFailure)
  })

  it.for(lateResults)(
    'ignores a late $name and further refreshes after disposal',
    async ({ result }) => {
      const { scope, history, listThreads, onFailure, refreshHistory } = setup()
      const pending = deferredListing()
      listThreads.mockReturnValueOnce(pending.promise)
      const refresh = refreshHistory()
      const signal = listThreads.mock.calls[0]?.[0]?.signal
      assert.exists(signal)

      scope.stop()
      expect(signal.aborted).toBe(true)
      pending.resolve(result)
      await refresh
      await refreshHistory()

      expect(history.sessions.map(({ id }) => id)).toEqual(['kept'])
      expect(onFailure).not.toHaveBeenCalled()
      expect(listThreads).toHaveBeenCalledTimes(1)
    }
  )
})
