import type { AgentUsageStatusResponse } from '@comfyorg/ingest-types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AgentGreetingAssignment } from '@/workbench/extensions/agent/types/proactiveGreeting'
import { useProactiveGreeting } from './useProactiveGreeting'

vi.mock(import('@comfyorg/telemetry/reportError'))

const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function setup() {
  const identity = ref({ userId: 'user-a', workspaceId: 'workspace-a' })
  const assignment = ref<AgentGreetingAssignment>()
  const active = ref(true)
  const getUsageStatus =
    vi.fn<
      (options: { signal: AbortSignal }) => Promise<AgentUsageStatusResponse>
    >()
  const scope = effectScope()
  const result = scope.run(() =>
    useProactiveGreeting({
      identity: () => identity.value,
      assignment: () => assignment.value,
      active: () => active.value,
      canvas: () => 'empty',
      getUsageStatus
    })
  )!
  cleanups.push(() => scope.stop())
  return {
    identity,
    assignment,
    active,
    getUsageStatus,
    dispose: () => scope.stop(),
    ...result
  }
}

const assigned: AgentGreetingAssignment = {
  userId: 'user-a',
  workspaceId: 'workspace-a',
  variant: 'B'
}

describe('first-use qualification', () => {
  it('stays inactive without a matching assignment and qualifies only after a successful query', async () => {
    const state = setup()
    expect(state.getUsageStatus).not.toHaveBeenCalled()
    state.getUsageStatus.mockResolvedValue({ has_used_agent: false })
    state.assignment.value = { ...assigned, workspaceId: 'different' }
    await nextTick()
    expect(state.getUsageStatus).not.toHaveBeenCalled()
    state.assignment.value = assigned
    expect(state.greeting.value).toBeUndefined()
    await nextTick()
    expect(state.greeting.value).toEqual({ variant: 'B', canvas: 'empty' })
  })

  it('preserves the current greeting when an old workspace response arrives later', async () => {
    const state = setup()
    const old = deferred<AgentUsageStatusResponse>()
    const current = deferred<AgentUsageStatusResponse>()
    state.getUsageStatus
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise)
    state.assignment.value = assigned
    state.identity.value = { userId: 'user-a', workspaceId: 'workspace-b' }
    state.assignment.value = { ...assigned, workspaceId: 'workspace-b' }
    current.resolve({ has_used_agent: false })
    await nextTick()
    expect(state.greeting.value).toEqual({ variant: 'B', canvas: 'empty' })
    old.resolve({ has_used_agent: true })
    await nextTick()
    expect(state.greeting.value).toEqual({ variant: 'B', canvas: 'empty' })
  })

  it('reports a failed query once, stays unqualified and recovers on refresh', async () => {
    const state = setup()
    const error = new Error('offline')
    state.getUsageStatus
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ has_used_agent: false })
    state.assignment.value = assigned
    await nextTick()
    expect(state.greeting.value).toBeUndefined()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
      surface: 'agent',
      errorType: 'failure_loading_agent_usage_status',
      level: 'warning'
    })
    await state.refresh()
    expect(state.greeting.value).toEqual({ variant: 'B', canvas: 'empty' })
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  it('ignores an old workspace failure after the current query succeeds', async () => {
    const state = setup()
    const old = deferred<AgentUsageStatusResponse>()
    state.getUsageStatus
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ has_used_agent: false })
    state.assignment.value = assigned
    state.identity.value = { userId: 'user-a', workspaceId: 'workspace-b' }
    state.assignment.value = { ...assigned, workspaceId: 'workspace-b' }
    await nextTick()
    old.reject(new Error('old workspace failed'))
    await nextTick()
    expect(state.greeting.value).toEqual({ variant: 'B', canvas: 'empty' })
    expect(reportError).not.toHaveBeenCalled()
  })

  it.for(['closed', 'disposed'] as const)(
    'does not report a request aborted when %s',
    async (end) => {
      const state = setup()
      const pending = deferred<AgentUsageStatusResponse>()
      state.getUsageStatus.mockReturnValueOnce(pending.promise)
      state.assignment.value = assigned
      const finish = {
        closed: () => {
          state.active.value = false
        },
        disposed: state.dispose
      }
      finish[end]()
      pending.reject(new DOMException('Aborted', 'AbortError'))
      await nextTick()
      expect(state.greeting.value).toBeUndefined()
      expect(reportError).not.toHaveBeenCalled()
    }
  )

  it('never lets a late negative overwrite an accepted message', async () => {
    const state = setup()
    const pending = deferred<AgentUsageStatusResponse>()
    state.getUsageStatus.mockReturnValue(pending.promise)
    state.assignment.value = assigned
    state.accepted(state.scope.value)
    pending.resolve({ has_used_agent: false })
    await nextTick()
    await state.refresh()
    expect(state.greeting.value).toBeUndefined()
    expect(state.getUsageStatus).toHaveBeenCalledTimes(1)
  })

  it('discards a closed-panel response and queries again on reopening', async () => {
    const state = setup()
    const pending = deferred<AgentUsageStatusResponse>()
    state.getUsageStatus
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({ has_used_agent: true })
    state.assignment.value = assigned
    state.active.value = false
    pending.resolve({ has_used_agent: false })
    await nextTick()
    expect(state.greeting.value).toBeUndefined()
    state.active.value = true
    await nextTick()
    expect(state.greeting.value).toBeUndefined()
    expect(state.getUsageStatus).toHaveBeenCalledTimes(2)
  })
})

it('does not restart usage work when an outstanding send settles after disposal', async () => {
  const state = setup()
  const pending = deferred<AgentUsageStatusResponse>()
  state.getUsageStatus
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue({ has_used_agent: false })
  state.assignment.value = assigned
  state.dispose()
  pending.resolve({ has_used_agent: false })
  await nextTick()
  await state.refresh()
  expect(state.getUsageStatus).toHaveBeenCalledTimes(1)
  expect(state.greeting.value).toBeUndefined()
})
