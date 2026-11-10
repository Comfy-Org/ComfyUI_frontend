import type { AgentUsageStatusResponse } from '@comfyorg/ingest-types'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { ProactiveGreetingEnrolledMetadata } from '@comfyorg/telemetry/types'
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

function setup(options: { requireLocalInstallation?: boolean } = {}) {
  const identity = ref({ userId: 'user-a', workspaceId: 'workspace-a' })
  const assignment = ref<AgentGreetingAssignment>()
  const active = ref(true)
  const onEnrolled = vi.fn<
    (metadata: ProactiveGreetingEnrolledMetadata) => boolean | Promise<boolean>
  >(() => true)
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
      getUsageStatus,
      onEnrolled,
      ...options
    })
  )!
  cleanups.push(() => scope.stop())
  return {
    identity,
    assignment,
    active,
    onEnrolled,
    getUsageStatus,
    dispose: () => scope.stop(),
    ...result
  }
}

const assigned: AgentGreetingAssignment = {
  userId: 'user-a',
  workspaceId: 'workspace-a',
  variant: 'B',
  telemetry: {
    user_id: 'user-a',
    workspace_id: 'workspace-a',
    group_key: '["user-a","workspace-a"]',
    variant: 'generic'
  }
}

describe('first-use qualification', () => {
  it('uses the baseline when exposure is rejected and can enroll on a later refresh', async () => {
    const state = setup()
    state.getUsageStatus.mockResolvedValue({ has_used_agent: false })
    state.onEnrolled.mockResolvedValue(false)
    state.assignment.value = assigned
    await state.refresh()

    expect(state.greeting.value).toBeUndefined()
    expect(state.attribution.value).toBeUndefined()

    state.onEnrolled.mockResolvedValue(true)
    await state.refresh()
    expect(state.greeting.value).toEqual({ variant: 'B', canvas: 'empty' })
    expect(state.attribution.value).toEqual(assigned.telemetry)
  })

  it('does not display or attribute a greeting when a pending exposure resolves after the first accepted send', async () => {
    const state = setup()
    const exposure = deferred<boolean>()
    state.getUsageStatus.mockResolvedValue({ has_used_agent: false })
    state.onEnrolled.mockReturnValue(exposure.promise)
    state.assignment.value = assigned
    await vi.waitFor(() => expect(state.onEnrolled).toHaveBeenCalledOnce())
    expect(state.greeting.value).toBeUndefined()
    expect(state.attribution.value).toBeUndefined()

    state.accepted(state.scope.value)
    exposure.resolve(true)
    await exposure.promise
    await state.refresh()

    expect(state.greeting.value).toBeUndefined()
    expect(state.attribution.value).toBeUndefined()
    expect(state.onEnrolled).toHaveBeenCalledOnce()
  })

  it.for([
    ['A', 'control'],
    ['B', 'generic'],
    ['C', 'canvas-prefill'],
    ['D', 'canvas-only']
  ] as const)(
    'enrolls qualified %s with pair attribution, independently of rendering',
    async ([variant, arm]) => {
      const state = setup()
      const telemetry = {
        user_id: assigned.userId,
        workspace_id: assigned.workspaceId,
        group_key: JSON.stringify([assigned.userId, assigned.workspaceId]),
        variant: arm
      }
      const pending = deferred<AgentUsageStatusResponse>()
      state.getUsageStatus.mockReturnValue(pending.promise)
      state.assignment.value = { ...assigned, variant, telemetry }
      expect(state.onEnrolled).not.toHaveBeenCalled()
      expect(state.attribution.value).toBeUndefined()
      pending.resolve({ has_used_agent: false })
      await vi.waitFor(() => expect(state.attribution.value).toEqual(telemetry))
      expect(state.onEnrolled).toHaveBeenCalledExactlyOnceWith({
        ...telemetry,
        canvas_state: 'empty'
      })
      state.active.value = false
      expect(state.attribution.value).toEqual(telemetry)
      state.getUsageStatus.mockResolvedValue({ has_used_agent: true })
      state.active.value = true
      await nextTick()
      expect(state.attribution.value).toEqual(telemetry)
      state.accepted(state.scope.value)
      await state.refresh()
      state.active.value = false
      expect(state.greeting.value).toBeUndefined()
      expect(state.attribution.value).toEqual(telemetry)
      expect(state.onEnrolled).toHaveBeenCalledTimes(1)
      state.identity.value = {
        userId: 'another-user',
        workspaceId: assigned.workspaceId
      }
      expect(state.attribution.value).toBeUndefined()
    }
  )

  it('does not enroll a used pair or a stale usage response', async () => {
    const state = setup()
    const telemetry = {
      user_id: assigned.userId,
      workspace_id: assigned.workspaceId,
      group_key: JSON.stringify([assigned.userId, assigned.workspaceId]),
      variant: 'generic' as const
    }
    state.getUsageStatus.mockResolvedValue({ has_used_agent: true })
    state.assignment.value = { ...assigned, telemetry }
    await nextTick()
    expect(state.onEnrolled).not.toHaveBeenCalled()
    expect(state.attribution.value).toBeUndefined()
    const pending = deferred<AgentUsageStatusResponse>()
    state.identity.value = {
      userId: assigned.userId,
      workspaceId: 'workspace-b'
    }
    state.getUsageStatus.mockReturnValue(pending.promise)
    state.assignment.value = {
      ...assigned,
      workspaceId: 'workspace-b',
      telemetry: {
        ...telemetry,
        workspace_id: 'workspace-b',
        group_key: JSON.stringify([assigned.userId, 'workspace-b'])
      }
    }
    state.active.value = false
    pending.resolve({ has_used_agent: false })
    await nextTick()
    expect(state.onEnrolled).not.toHaveBeenCalled()
  })
  it('does not carry prior enrollment attribution into a different arm on the same pair', async () => {
    const state = setup()
    const telemetry = {
      user_id: assigned.userId,
      workspace_id: assigned.workspaceId,
      group_key: JSON.stringify([assigned.userId, assigned.workspaceId]),
      variant: 'generic' as const
    }
    state.getUsageStatus.mockResolvedValue({ has_used_agent: false })
    state.assignment.value = { ...assigned, telemetry }
    await vi.waitFor(() => expect(state.attribution.value).toEqual(telemetry))
    state.accepted(state.scope.value)
    state.assignment.value = {
      ...assigned,
      variant: 'D',
      telemetry: { ...telemetry, variant: 'canvas-only' }
    }
    expect(state.attribution.value).toBeUndefined()
    expect(state.onEnrolled).toHaveBeenCalledTimes(1)
  })

  it('stays inactive without a matching assignment and qualifies only after a successful query', async () => {
    const state = setup()
    expect(state.getUsageStatus).not.toHaveBeenCalled()
    state.getUsageStatus.mockResolvedValue({ has_used_agent: false })
    state.assignment.value = { ...assigned, workspaceId: 'different' }
    await nextTick()
    expect(state.getUsageStatus).not.toHaveBeenCalled()
    state.assignment.value = assigned
    expect(state.greeting.value).toBeUndefined()
    await vi.waitFor(() =>
      expect(state.greeting.value).toEqual({ variant: 'B', canvas: 'empty' })
    )
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
    await vi.waitFor(() =>
      expect(state.greeting.value).toEqual({ variant: 'B', canvas: 'empty' })
    )
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
    state.assignment.value = {
      ...assigned,
      telemetry: {
        user_id: assigned.userId,
        workspace_id: assigned.workspaceId,
        group_key: JSON.stringify([assigned.userId, assigned.workspaceId]),
        variant: 'generic'
      }
    }
    state.accepted(state.scope.value)
    pending.resolve({ has_used_agent: false })
    await nextTick()
    await state.refresh()
    expect(state.greeting.value).toBeUndefined()
    expect(state.getUsageStatus).toHaveBeenCalledTimes(1)
    expect(state.onEnrolled).not.toHaveBeenCalled()
    expect(state.attribution.value).toBeUndefined()
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

describe('Desktop local history qualification', () => {
  it.for([
    { response: { has_used_agent: false }, eligible: false },
    {
      response: { has_used_agent: true, scope: 'local_installation' as const },
      eligible: false
    },
    {
      response: { has_used_agent: false, scope: 'local_installation' as const },
      eligible: true
    }
  ])(
    'requires unused installation-scoped history: $eligible',
    async ({ response, eligible }) => {
      const state = setup({ requireLocalInstallation: true })
      state.getUsageStatus.mockResolvedValue(response)
      state.assignment.value = assigned
      await state.refresh()
      expect(state.greeting.value !== undefined).toBe(eligible)
    }
  )

  it('ignores an exposure admission after the panel has closed', async () => {
    const admission = deferred<boolean>()
    const state = setup({ requireLocalInstallation: true })
    state.onEnrolled.mockReturnValue(admission.promise)
    state.getUsageStatus.mockResolvedValue({
      has_used_agent: false,
      scope: 'local_installation'
    })
    state.assignment.value = assigned
    await vi.waitFor(() => expect(state.onEnrolled).toHaveBeenCalledOnce())
    expect(state.greeting.value).toBeUndefined()
    state.active.value = false
    admission.resolve(true)
    await admission.promise
    expect(state.greeting.value).toBeUndefined()
    expect(state.attribution.value).toBeUndefined()
  })
})
