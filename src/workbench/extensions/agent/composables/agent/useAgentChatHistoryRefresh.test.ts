import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import type { AgentThreadSummary } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type {
  AgentRestClient,
  ThreadListing
} from '@/workbench/extensions/agent/services/agent/agentRestClient'
import * as storageIO from '@/platform/workflow/persistence/base/storageIO'
import { unsafeStorageScope } from '@/platform/workflow/persistence/testUtils/storageScope'
import { useAgentChatHistoryStore } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import { useAgentChatHistoryRefresh } from './useAgentChatHistoryRefresh'

function thread(id: string, workflowId = '', title = id): AgentThreadSummary {
  return {
    id,
    title,
    preview: '',
    workflow_id: workflowId,
    status: 'active',
    message_count: 1,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-20T00:00:00Z',
    last_message_at: '2026-10-01T00:00:00Z'
  }
}

function completedListing(
  id: string,
  workflowId = '',
  title = id
): ThreadListing {
  return { status: 'complete', threads: [thread(id, workflowId, title)] }
}

function deferredListing() {
  let resolve!: (result: ThreadListing) => void
  const promise = new Promise<ThreadListing>((resolveResult) => {
    resolve = resolveResult
  })
  return { promise, resolve }
}

function setup() {
  vi.spyOn(storageIO, 'getStorageScope').mockReturnValue(
    unsafeStorageScope('personal')
  )
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
  reason: 'missing_cursor',
  threads: [thread('partial')]
}
const requestFailure: ThreadListing = {
  status: 'failed',
  cause: new TypeError('Failed to fetch')
}

const lateResults = [
  { name: 'success', result: completedListing('older') },
  { name: 'incomplete listing', result: missingCursor },
  { name: 'request failure', result: requestFailure }
]

describe('useAgentChatHistoryRefresh', () => {
  it('retains history and reports a failed listing', async () => {
    const { history, listThreads, onFailure, refreshHistory } = setup()
    listThreads.mockResolvedValueOnce(requestFailure)

    await expect(refreshHistory()).resolves.toBe('failed')

    expect(history.sessions.map(({ id }) => id)).toEqual(['kept'])
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(
      requestFailure,
      'error_overlay'
    )
  })

  it('shows a truncated listing and reports it without keeping chats this refresh never listed', async () => {
    const { history, listThreads, onFailure, refreshHistory } = setup()
    listThreads.mockResolvedValueOnce(missingCursor)

    await expect(refreshHistory()).resolves.toBe('incomplete')

    expect(history.sessions.map(({ id }) => id)).toEqual(['partial'])
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(
      missingCursor,
      'error_overlay'
    )
  })

  it('keeps the chats it already listed when a later listing is truncated', async () => {
    const { history, listThreads, refreshHistory } = setup()
    listThreads.mockResolvedValueOnce(completedListing('shown'))
    await expect(refreshHistory()).resolves.toBe('complete')

    listThreads.mockResolvedValueOnce(missingCursor)
    await expect(refreshHistory()).resolves.toBe('incomplete')

    expect(history.sessions.map(({ id }) => id)).toEqual(['partial', 'shown'])
  })

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

  it('ignores an in-flight listing after its storage scope is replaced', async () => {
    const { history, listThreads, onFailure, refreshHistory } = setup()
    const pending = deferredListing()
    vi.mocked(storageIO.getStorageScope).mockReturnValue(
      unsafeStorageScope('cloud:user-a:workspace-a')
    )
    listThreads.mockReturnValueOnce(pending.promise)
    const refresh = refreshHistory()

    history.replaceAll([])
    vi.mocked(storageIO.getStorageScope).mockReturnValue(
      unsafeStorageScope('cloud:user-b:workspace-b')
    )
    pending.resolve(completedListing('user-a-thread'))

    await expect(refresh).resolves.toBe('superseded')
    expect(history.sessions).toEqual([])
    expect(onFailure).not.toHaveBeenCalled()
  })

  it('does not list history without a resolved storage owner', async () => {
    const { listThreads, refreshHistory } = setup()
    vi.mocked(storageIO.getStorageScope).mockReturnValue(null)

    await expect(refreshHistory()).resolves.toBe('superseded')

    expect(listThreads).not.toHaveBeenCalled()
  })

  it('preserves an in-flight failure across an ownerless no-op for the same scope', async () => {
    const { listThreads, onFailure, refreshHistory } = setup()
    const pending = deferredListing()
    listThreads.mockReturnValueOnce(pending.promise)
    const refresh = refreshHistory('none')

    vi.mocked(storageIO.getStorageScope).mockReturnValue(null)
    await expect(refreshHistory('none')).resolves.toBe('superseded')
    vi.mocked(storageIO.getStorageScope).mockReturnValue(
      unsafeStorageScope('personal')
    )
    pending.resolve(requestFailure)

    await expect(refresh).resolves.toBe('failed')
    expect(listThreads).toHaveBeenCalledTimes(1)
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(requestFailure, 'none')
  })

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

    expect(history.sessions.map(({ id }) => id)).toEqual(['partial'])
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(
      requestFailure,
      'error_overlay'
    )
  })

  it.for([missingCursor, requestFailure])(
    'keeps a silent $status listing silent',
    async (failure) => {
      const { listThreads, onFailure, refreshHistory } = setup()
      listThreads.mockResolvedValueOnce(failure)

      await expect(refreshHistory('none')).resolves.toBe(failure.status)

      expect(onFailure).toHaveBeenCalledExactlyOnceWith(failure, 'none')
    }
  )

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

  it('ignores an older explicit failure after a silent truncated listing shows chats', async () => {
    const { history, listThreads, onFailure, refreshHistory } = setup()
    const explicit = deferredListing()
    listThreads.mockReturnValueOnce(explicit.promise)
    const explicitRefresh = refreshHistory()
    listThreads.mockResolvedValueOnce(missingCursor)
    await expect(refreshHistory('none')).resolves.toBe('incomplete')

    explicit.resolve(requestFailure)
    await expect(explicitRefresh).resolves.toBe('superseded')

    expect(history.sessions.map(({ id }) => id)).toEqual(['partial'])
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(missingCursor, 'none')
  })

  it('ignores an aborted result without replacing history or reporting failure', async () => {
    const { history, listThreads, onFailure, refreshHistory } = setup()
    listThreads.mockResolvedValueOnce({ status: 'aborted' })

    await expect(refreshHistory()).resolves.toBe('aborted')

    expect(history.sessions.map(({ id }) => id)).toEqual(['kept'])
    expect(onFailure).not.toHaveBeenCalled()
  })

  it('merges a workflow-filtered refresh into the complete cached history', async () => {
    const { history, listThreads, refreshHistory } = setup()
    listThreads.mockResolvedValueOnce(completedListing('older'))
    await expect(refreshHistory()).resolves.toBe('complete')

    listThreads.mockResolvedValueOnce(completedListing('newest', 'wf-new'))
    await expect(refreshHistory('none', 'wf-new')).resolves.toBe('complete')

    expect(listThreads).toHaveBeenLastCalledWith(
      expect.objectContaining({ workflowId: 'wf-new' })
    )
    expect(history.sessions.map(({ id }) => id)).toEqual(['newest', 'older'])
  })

  it('keeps a newer filtered result when the initial full listing finishes later', async () => {
    const { history, listThreads, refreshHistory } = setup()
    const full = deferredListing()
    listThreads.mockReturnValueOnce(full.promise)
    const fullRefresh = refreshHistory()
    listThreads.mockResolvedValueOnce(completedListing('newest', 'wf-new'))

    await expect(refreshHistory('none', 'wf-new')).resolves.toBe('complete')
    full.resolve(completedListing('older'))
    await expect(fullRefresh).resolves.toBe('complete')

    expect(history.sessions.map(({ id }) => id)).toEqual(['newest', 'older'])
  })

  it('keeps a newer empty filtered result when the full listing finishes later', async () => {
    const { history, listThreads, refreshHistory } = setup()
    const full = deferredListing()
    listThreads.mockReturnValueOnce(full.promise)
    const fullRefresh = refreshHistory()
    listThreads.mockResolvedValueOnce({ status: 'complete', threads: [] })

    await expect(refreshHistory('none', 'wf-new')).resolves.toBe('complete')
    full.resolve(completedListing('stale', 'wf-new'))
    await expect(fullRefresh).resolves.toBe('complete')

    expect(history.sessions).toEqual([])
  })

  it('ignores an older filtered result after a newer full listing succeeds', async () => {
    const { history, listThreads, refreshHistory } = setup()
    const filtered = deferredListing()
    listThreads.mockReturnValueOnce(filtered.promise)
    const filteredRefresh = refreshHistory('none', 'wf-new')
    listThreads.mockResolvedValueOnce(completedListing('newest', 'wf-new'))

    await expect(refreshHistory()).resolves.toBe('complete')
    filtered.resolve(completedListing('stale', 'wf-new'))
    await expect(filteredRefresh).resolves.toBe('superseded')

    expect(history.sessions.map(({ id }) => id)).toEqual(['newest'])
  })

  it('ignores an older filtered result after a newer one for the same workflow', async () => {
    const { history, listThreads, refreshHistory } = setup()
    const older = deferredListing()
    listThreads.mockReturnValueOnce(older.promise)
    const olderRefresh = refreshHistory('none', 'wf-a')
    listThreads.mockResolvedValueOnce(completedListing('newest', 'wf-a'))

    await expect(refreshHistory('none', 'wf-a')).resolves.toBe('complete')
    older.resolve(completedListing('stale', 'wf-a'))
    await expect(olderRefresh).resolves.toBe('superseded')

    expect(history.sessions.map(({ id }) => id)).toEqual(['newest', 'kept'])
  })

  it('keeps a newer thread snapshot returned by another workflow refresh', async () => {
    const { history, listThreads, refreshHistory } = setup()
    const workflowA = deferredListing()
    listThreads.mockReturnValueOnce(workflowA.promise)
    const workflowARefresh = refreshHistory('none', 'wf-a')
    listThreads.mockResolvedValueOnce(
      completedListing('thread', 'wf-b', 'newest')
    )

    await expect(refreshHistory('none', 'wf-b')).resolves.toBe('complete')
    workflowA.resolve(completedListing('thread', 'wf-a', 'stale'))
    await expect(workflowARefresh).resolves.toBe('complete')

    expect(history.sessions).toEqual([
      expect.objectContaining({
        id: 'thread',
        title: 'newest',
        workflowId: 'wf-b'
      }),
      expect.objectContaining({ id: 'kept' })
    ])
  })

  it('keeps a newer thread snapshot when filtered listings are ignored', async () => {
    const { history, listThreads, refreshHistory } = setup()
    const workflowA = deferredListing()
    listThreads.mockReturnValueOnce(workflowA.promise)
    const workflowARefresh = refreshHistory('none', 'wf-a')
    listThreads.mockResolvedValueOnce(
      completedListing('thread', 'wf-a', 'newest')
    )

    await expect(refreshHistory('none', 'wf-b')).resolves.toBe('complete')
    workflowA.resolve(completedListing('thread', 'wf-a', 'stale'))
    await expect(workflowARefresh).resolves.toBe('complete')

    expect(history.sessions).toEqual([
      expect.objectContaining({
        id: 'thread',
        title: 'newest',
        workflowId: 'wf-a'
      }),
      expect.objectContaining({ id: 'kept' })
    ])
  })

  it('keeps only the newest filtered snapshot when a full listing finishes later', async () => {
    const { history, listThreads, refreshHistory } = setup()
    const full = deferredListing()
    listThreads.mockReturnValueOnce(full.promise)
    const fullRefresh = refreshHistory()
    listThreads.mockResolvedValueOnce(
      completedListing('thread', 'wf-a', 'older')
    )
    await expect(refreshHistory('none', 'wf-a')).resolves.toBe('complete')
    listThreads.mockResolvedValueOnce(
      completedListing('thread', 'wf-b', 'newest')
    )
    await expect(refreshHistory('none', 'wf-b')).resolves.toBe('complete')

    full.resolve(completedListing('full'))
    await expect(fullRefresh).resolves.toBe('complete')

    expect(history.sessions).toEqual([
      expect.objectContaining({
        id: 'thread',
        title: 'newest',
        workflowId: 'wf-b'
      }),
      expect.objectContaining({ id: 'full' })
    ])
  })

  it.for([
    { name: 'without it', full: { status: 'complete', threads: [] } },
    { name: 'under a third workflow', full: completedListing('moved', 'wf-c') }
  ] satisfies { name: string; full: ThreadListing }[])(
    'does not restore a thread that moved away when a full listing $name finishes later',
    async ({ full: fullResult }) => {
      const { history, listThreads, refreshHistory } = setup()
      const full = deferredListing()
      listThreads.mockReturnValueOnce(full.promise)
      const fullRefresh = refreshHistory()
      listThreads.mockResolvedValueOnce(completedListing('moved', 'wf-a'))
      await expect(refreshHistory('none', 'wf-a')).resolves.toBe('complete')
      listThreads.mockResolvedValueOnce(completedListing('moved', 'wf-b'))
      await expect(refreshHistory('none', 'wf-b')).resolves.toBe('complete')
      listThreads.mockResolvedValueOnce({ status: 'complete', threads: [] })
      await expect(refreshHistory('none', 'wf-b')).resolves.toBe('complete')

      full.resolve(fullResult)
      await expect(fullRefresh).resolves.toBe('complete')

      expect(history.sessions).toEqual([])
    }
  )

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
