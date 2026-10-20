import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import type {
  AgentRestClient,
  ThreadListing
} from '@/workbench/extensions/agent/services/agent/agentRestClient'
import { useAgentChatHistoryStore } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
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

      await expect(refreshHistory()).resolves.toBe(failure.status)

      expect(history.sessions.map(({ id }) => id)).toEqual(['kept'])
      expect(onFailure).toHaveBeenCalledExactlyOnceWith(
        failure,
        'error_overlay'
      )
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
      await expect(refreshHistory()).resolves.toBe('complete')

      older.resolve(result)
      await expect(olderRefresh).resolves.toBe('superseded')

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
    await expect(refreshHistory()).resolves.toBe('failed')

    older.resolve(completedListing('older'))
    await expect(olderRefresh).resolves.toBe('complete')

    expect(history.sessions).toEqual([
      {
        id: 'older',
        title: 'older',
        titleSource: 'server',
        updatedAt: 1790812800000,
        lastActivityAt: 1790812800000,
        workflowId: undefined
      }
    ])
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(
      requestFailure,
      'error_overlay'
    )
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
    await expect(olderRefresh).resolves.toBe('superseded')
    expect(onFailure).not.toHaveBeenCalled()
    newer.resolve(requestFailure)
    await expect(newerRefresh).resolves.toBe('failed')

    expect(history.sessions.map(({ id }) => id)).toEqual(['kept'])
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(
      requestFailure,
      'error_overlay'
    )
  })

  it.for(failures)('keeps a silent $status failure silent', async (failure) => {
    const { history, listThreads, onFailure, refreshHistory } = setup()
    listThreads.mockResolvedValueOnce(failure)

    await expect(refreshHistory('none')).resolves.toBe(failure.status)

    expect(history.sessions.map(({ id }) => id)).toEqual(['kept'])
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(failure, 'none')
  })

  it('preserves an explicit failure while a newer silent refresh is pending', async () => {
    const { listThreads, onFailure, refreshHistory } = setup()
    const explicit = deferredListing()
    const silent = deferredListing()
    listThreads
      .mockReturnValueOnce(explicit.promise)
      .mockReturnValueOnce(silent.promise)
    const explicitRefresh = refreshHistory()
    const silentRefresh = refreshHistory('none')

    explicit.resolve(requestFailure)
    await expect(explicitRefresh).resolves.toBe('failed')

    expect(onFailure).toHaveBeenCalledExactlyOnceWith(
      requestFailure,
      'error_overlay'
    )
    silent.resolve(missingCursor)
    await expect(silentRefresh).resolves.toBe('incomplete')
    expect(onFailure).toHaveBeenLastCalledWith(missingCursor, 'none')
  })

  it('ignores an older explicit failure after a silent refresh succeeds', async () => {
    const { history, listThreads, onFailure, refreshHistory } = setup()
    const explicit = deferredListing()
    listThreads.mockReturnValueOnce(explicit.promise)
    const explicitRefresh = refreshHistory()
    listThreads.mockResolvedValueOnce(completedListing('newer'))
    await expect(refreshHistory('none')).resolves.toBe('complete')

    explicit.resolve(requestFailure)
    await expect(explicitRefresh).resolves.toBe('superseded')

    expect(history.sessions.map(({ id }) => id)).toEqual(['newer'])
    expect(onFailure).not.toHaveBeenCalled()
  })

  it('ignores an aborted result without replacing history or reporting failure', async () => {
    const { history, listThreads, onFailure, refreshHistory } = setup()
    listThreads.mockResolvedValueOnce({ status: 'aborted' })

    await expect(refreshHistory()).resolves.toBe('aborted')

    expect(history.sessions.map(({ id }) => id)).toEqual(['kept'])
    expect(onFailure).not.toHaveBeenCalled()
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
      await expect(refresh).resolves.toBe('aborted')
      await expect(refreshHistory()).resolves.toBe('aborted')

      expect(history.sessions.map(({ id }) => id)).toEqual(['kept'])
      expect(onFailure).not.toHaveBeenCalled()
      expect(listThreads).toHaveBeenCalledTimes(1)
    }
  )
})
