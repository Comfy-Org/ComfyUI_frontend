import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { AgentApiError } from '@/workbench/extensions/agent/services/agent/agentRestClient'
import { useAgentChatHistoryStore } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

import { useAgentChatDeletion } from './useAgentChatDeletion'

function makeSession(id: string) {
  return {
    id,
    title: `Title ${id}`,
    updatedAt: 1_000,
    titleSource: 'server' as const,
    workflowId: 'wf-1'
  }
}

describe('useAgentChatDeletion', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.useFakeTimers()
  })

  function setup(deleteThread: (id: string) => Promise<void>) {
    const history = useAgentChatHistoryStore()
    const onOptimisticDelete = vi.fn()
    const onDeleteFailed = vi.fn()
    const onFallbackRefresh = vi.fn()
    const scope = effectScope()
    const deletion = scope.run(() =>
      useAgentChatDeletion({
        deleteThread,
        history,
        onOptimisticDelete,
        onDeleteFailed,
        onFallbackRefresh
      })
    )
    if (!deletion) throw new Error('expected deletion composable')
    return {
      history,
      onOptimisticDelete,
      onDeleteFailed,
      onFallbackRefresh,
      scope,
      deletion
    }
  }

  it('P2-01: hides optimistically and commits on 204 without writing a tombstone or toast', async () => {
    let resolveDelete!: () => void
    const deleteThread = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve
        })
    )
    const { history, onOptimisticDelete, onDeleteFailed, scope, deletion } =
      setup(deleteThread)
    history.replaceAll([makeSession('th-1')])
    history.setActive('th-1')

    const pending = deletion.deleteChat('th-1')
    expect(onOptimisticDelete).toHaveBeenCalledExactlyOnceWith('th-1', {
      previousActiveId: 'th-1'
    })
    expect(history.activeId).toBeNull()
    expect(history.sessions).toEqual([])
    expect(deleteThread).toHaveBeenCalledExactlyOnceWith('th-1')

    resolveDelete()
    await pending

    expect(history.sessions).toEqual([])
    expect(
      JSON.parse(
        localStorage.getItem(StorageKeys.agentDeletedThreads('personal')) ??
          '[]'
      )
    ).toEqual([])
    expect(onDeleteFailed).not.toHaveBeenCalled()
    scope.stop()
  })

  it.for([404, 405])(
    'P2-04: treats %i as gone and writes a local tombstone without an error toast',
    async (status) => {
      const deleteThread = vi.fn(async () => {
        throw new AgentApiError('not found', status, { error: 'not found' })
      })
      const { history, onDeleteFailed, scope, deletion } = setup(deleteThread)
      history.replaceAll([makeSession('th-1')])

      await deletion.deleteChat('th-1')

      expect(onDeleteFailed).not.toHaveBeenCalled()
      expect(history.isDeleted('th-1')).toBe(true)
      history.replaceAll([makeSession('th-1')])
      expect(history.sessions).toEqual([])
      scope.stop()
    }
  )

  it('P2-02: retries 503 with Retry-After after the given delay, at most twice, and succeeds if retry returns 204', async () => {
    let calls = 0
    const deleteThread = vi.fn(async () => {
      calls += 1
      if (calls <= 2) {
        throw new AgentApiError('retry', 503, {}, 2)
      }
    })
    const { history, onDeleteFailed, scope, deletion } = setup(deleteThread)
    history.replaceAll([makeSession('th-1')])

    const pending = deletion.deleteChat('th-1')
    await vi.advanceTimersByTimeAsync(1_999)
    expect(calls).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toBe(2)
    await vi.advanceTimersByTimeAsync(2_000)
    await pending

    expect(calls).toBe(3)
    expect(onDeleteFailed).not.toHaveBeenCalled()
    expect(history.sessions).toEqual([])
    scope.stop()
  })

  it('P2-02 P2-03: restores chat and triggers failure callback after two 503 Retry-After retries still fail', async () => {
    const deleteThread = vi.fn(async () => {
      throw new AgentApiError('retry', 503, {}, 1)
    })
    const { history, onDeleteFailed, scope, deletion } = setup(deleteThread)
    history.replaceAll([makeSession('th-1')])
    history.rename('th-1', 'My chat')

    const pending = deletion.deleteChat('th-1')
    await vi.advanceTimersByTimeAsync(2_000)
    await pending

    expect(deleteThread).toHaveBeenCalledTimes(3)
    expect(history.sessions.map(({ id }) => id)).toEqual(['th-1'])
    expect(history.titleFor('th-1')).toBe('My chat')
    expect(history.isDeleted('th-1')).toBe(false)
    expect(onDeleteFailed).toHaveBeenCalledOnce()
    scope.stop()
  })

  it.for([
    {
      name: '503 without Retry-After',
      err: () => new AgentApiError('unavailable', 503, {})
    },
    { name: '500', err: () => new AgentApiError('boom', 500, {}) },
    { name: '400', err: () => new AgentApiError('bad request', 400, {}) },
    { name: 'network error', err: () => new TypeError('offline') }
  ])(
    'P2-03: restores chat and notifies failure without retrying on $name',
    async ({ err }) => {
      const deleteThread = vi.fn(async (): Promise<void> => {
        throw err()
      })
      const { history, onDeleteFailed, scope, deletion } = setup(deleteThread)
      history.replaceAll([makeSession('th-1')])

      await deletion.deleteChat('th-1')

      expect(deleteThread).toHaveBeenCalledOnce()
      expect(history.sessions.map(({ id }) => id)).toEqual(['th-1'])
      expect(history.isDeleted('th-1')).toBe(false)
      expect(onDeleteFailed).toHaveBeenCalledOnce()

      const [, retry] = onDeleteFailed.mock.calls[0]
      deleteThread.mockResolvedValueOnce(undefined)
      retry()
      await vi.advanceTimersByTimeAsync(0)
      expect(history.sessions).toEqual([])
      scope.stop()
    }
  )

  it('retries 503 when Retry-After is at the 30s cap', async () => {
    let calls = 0
    const deleteThread = vi.fn(async () => {
      calls += 1
      if (calls === 1) throw new AgentApiError('retry', 503, {}, 30)
    })
    const { history, onDeleteFailed, scope, deletion } = setup(deleteThread)
    history.replaceAll([makeSession('th-1')])

    const pending = deletion.deleteChat('th-1')
    await vi.advanceTimersByTimeAsync(29_999)
    expect(calls).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    await pending

    expect(calls).toBe(2)
    expect(onDeleteFailed).not.toHaveBeenCalled()
    expect(history.sessions).toEqual([])
    scope.stop()
  })

  it.for([31, 600])(
    'fails immediately without retrying when 503 Retry-After is %is (> 30s)',
    async (retryAfterSeconds) => {
      const deleteThread = vi.fn(async () => {
        throw new AgentApiError('retry', 503, {}, retryAfterSeconds)
      })
      const { history, onDeleteFailed, scope, deletion } = setup(deleteThread)
      history.replaceAll([makeSession('th-1')])

      await deletion.deleteChat('th-1')

      expect(deleteThread).toHaveBeenCalledOnce()
      expect(history.sessions.map(({ id }) => id)).toEqual(['th-1'])
      expect(history.isDeleted('th-1')).toBe(false)
      expect(onDeleteFailed).toHaveBeenCalledOnce()
      scope.stop()
    }
  )

  it('commits deletion in history when scope is disposed while DELETE is in flight and succeeds', async () => {
    let resolveDelete!: () => void
    const deleteThread = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve
        })
    )
    const { history, onDeleteFailed, onFallbackRefresh, scope, deletion } =
      setup(deleteThread)
    history.replaceAll([makeSession('th-1')])

    const pending = deletion.deleteChat('th-1')
    scope.stop()

    resolveDelete()
    await pending

    expect(history.isDeleted('th-1')).toBe(true)
    history.replaceAll([makeSession('th-1')])
    expect(history.sessions).toEqual([])
    expect(onDeleteFailed).not.toHaveBeenCalled()
    expect(onFallbackRefresh).not.toHaveBeenCalled()
  })

  it('restores chat in history without toast or fallback refresh when scope is disposed while DELETE fails', async () => {
    let rejectDelete!: (error: unknown) => void
    const deleteThread = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectDelete = reject
        })
    )
    const { history, onDeleteFailed, onFallbackRefresh, scope, deletion } =
      setup(deleteThread)
    history.replaceAll([makeSession('th-1')])
    history.rename('th-1', 'Kept title')

    const pending = deletion.deleteChat('th-1')
    scope.stop()

    rejectDelete(new AgentApiError('boom', 500, {}))
    await pending

    expect(history.isDeleted('th-1')).toBe(false)
    expect(history.sessions.map(({ id }) => id)).toEqual(['th-1'])
    expect(history.titleFor('th-1')).toBe('Kept title')
    expect(onDeleteFailed).not.toHaveBeenCalled()
    expect(onFallbackRefresh).not.toHaveBeenCalled()
  })

  it('restores chat in history without toast when scope is disposed during Retry-After sleep', async () => {
    const deleteThread = vi.fn(async () => {
      throw new AgentApiError('retry', 503, {}, 5)
    })
    const { history, onDeleteFailed, onFallbackRefresh, scope, deletion } =
      setup(deleteThread)
    history.replaceAll([makeSession('th-1')])
    history.rename('th-1', 'Retry chat')

    const pending = deletion.deleteChat('th-1')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(deleteThread).toHaveBeenCalledOnce()

    scope.stop()
    await pending
    await vi.advanceTimersByTimeAsync(10_000)

    expect(deleteThread).toHaveBeenCalledOnce()
    expect(history.isDeleted('th-1')).toBe(false)
    expect(history.sessions.map(({ id }) => id)).toEqual(['th-1'])
    expect(history.titleFor('th-1')).toBe('Retry chat')
    expect(onDeleteFailed).not.toHaveBeenCalled()
    expect(onFallbackRefresh).not.toHaveBeenCalled()
  })
})
