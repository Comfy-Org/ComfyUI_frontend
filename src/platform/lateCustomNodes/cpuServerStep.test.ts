import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { provideCurrentUser } from '@/platform/auth/currentUserAccess'
import { reportError } from '@/platform/telemetry/reportError'
import type { WorkspaceDeploymentCpuServer } from '@/platform/workspace/api/workspaceApi'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import type { CpuServerReading, CpuServerWatch } from './cpuServerStep'
import { askCpuServer, isBeingSetUp, watchCpuServer } from './cpuServerStep'

vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))

function answers(
  ...steps: (WorkspaceDeploymentCpuServer['cpu_server'] | Error)[]
) {
  for (const step of steps) {
    if (step instanceof Error)
      vi.mocked(workspaceApi.getDeploymentCpuServer).mockRejectedValueOnce(step)
    else
      vi.mocked(workspaceApi.getDeploymentCpuServer).mockResolvedValueOnce({
        cpu_server: step
      })
  }
}

function cpuServerUnknown() {
  return new WorkspaceApiError(
    'step unknown',
    502,
    'cpu_server_unknown',
    undefined,
    'getDeploymentCpuServer'
  )
}

function pendingReading() {
  let settle: {
    answer: (reading: CpuServerReading) => void
    fail: (error: Error) => void
  } = { answer: () => {}, fail: () => {} }
  const reading = new Promise<CpuServerReading>((answer, fail) => {
    settle = { answer, fail }
  })
  return { reading, ...settle }
}

async function signIn() {
  provideCurrentUser(() => ({
    userEmail: computed(() => null),
    isApiKeyLogin: computed(() => true)
  }))
  await useTeamWorkspaceStore().initialize()
}

describe('askCpuServer', () => {
  it('answers none without asking when there is no workspace', async () => {
    await expect(askCpuServer()).resolves.toEqual({ answer: 'none' })
    expect(workspaceApi.getDeploymentCpuServer).not.toHaveBeenCalled()
  })

  it('asks for the current workspace and reads the step', async () => {
    await signIn()
    answers('building')

    await expect(askCpuServer()).resolves.toEqual({ answer: 'building' })
    expect(workspaceApi.getDeploymentCpuServer).toHaveBeenCalledWith(
      'workspace-1'
    )
  })

  it('reads a 404 as no CPU server, and a cpu_server_unknown 502 as a step it could not tell', async () => {
    await signIn()
    answers(new WorkspaceApiError('not found', 404), cpuServerUnknown())

    await expect(askCpuServer()).resolves.toEqual({ answer: 'none' })
    await expect(askCpuServer()).resolves.toEqual({ answer: 'unknown' })
  })

  it('keeps a 502 that is not cpu_server_unknown to report', async () => {
    await signIn()
    const failure = new WorkspaceApiError('bad gateway', 502)
    answers(failure)

    await expect(askCpuServer()).resolves.toEqual({
      answer: 'unknown',
      error: failure
    })
  })

  it('keeps any other failure to report', async () => {
    await signIn()
    const failure = new WorkspaceApiError('server error', 500)
    answers(failure)

    await expect(askCpuServer()).resolves.toEqual({
      answer: 'unknown',
      error: failure
    })
  })

  it('drops an answer that outlived its workspace, even back in the same one', async () => {
    await signIn()
    let answer: (value: { cpu_server: 'created' }) => void = () => {}
    vi.mocked(workspaceApi.getDeploymentCpuServer).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve
      })
    )
    const asked = askCpuServer()

    useTeamWorkspaceStore().resetForIdentityChange()
    await signIn()
    answer({ cpu_server: 'created' })

    await expect(asked).resolves.toEqual({ answer: 'unknown' })
  })
})

describe('isBeingSetUp', () => {
  it.for([
    ['creating', true],
    ['building', true],
    ['created', false],
    ['none', false],
    ['unknown', false]
  ] as const)('%s: %s', ([answer, expected]) => {
    expect(isBeingSetUp({ answer })).toBe(expected)
  })
})

describe('watchCpuServer', () => {
  const started: { owner: AbortController; watch: CpuServerWatch }[] = []

  function watch(
    firstReading: Promise<CpuServerReading> = askCpuServer(),
    owner = new AbortController()
  ) {
    const watch = watchCpuServer(firstReading, owner.signal)
    started.push({ owner, watch })
    return { owner, watch, settled: settledFlag(watch.ready) }
  }

  function settledFlag(ready: Promise<void>) {
    const flag = { value: false }
    void ready.then(() => {
      flag.value = true
    })
    return flag
  }

  beforeEach(async () => {
    vi.useFakeTimers()
    await signIn()
  })

  afterEach(async () => {
    for (const { owner, watch } of started.splice(0)) {
      owner.abort()
      await watch.ready
    }
  })

  it('follows the step every five seconds until the CPU server exists', async () => {
    answers('building', 'building', 'created')
    const { watch: following } = watch()
    await vi.advanceTimersByTimeAsync(0)
    expect(following.step()).toBe('building')

    await vi.advanceTimersByTimeAsync(5_000)
    expect(following.step()).toBe('building')

    await vi.advanceTimersByTimeAsync(5_000)
    await following.ready
    expect(following.step()).toBe('starting')
    expect(workspaceApi.getDeploymentCpuServer).toHaveBeenCalledTimes(3)
  })

  it('settles and asks no more once there is no CPU server', async () => {
    answers('creating', 'none', 'building')
    const { watch: following, settled } = watch()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(settled.value).toBe(true)
    expect(following.step()).toBeUndefined()

    await vi.advanceTimersByTimeAsync(20_000)
    expect(workspaceApi.getDeploymentCpuServer).toHaveBeenCalledTimes(2)
  })

  it('keeps the step it had when a read cannot tell', async () => {
    answers('creating', cpuServerUnknown())
    const { watch: following } = watch()

    await vi.advanceTimersByTimeAsync(5_000)

    expect(following.step()).toBe('creating')
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports the first read that failed for another reason, once', async () => {
    const failure = new Error('network down')
    answers('creating', failure, failure)
    watch()

    await vi.advanceTimersByTimeAsync(10_000)

    expect(reportError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ errorType: 'cpu_server_step_read_failed' })
    )
  })

  it('stops naming a step after half an hour', async () => {
    vi.mocked(workspaceApi.getDeploymentCpuServer).mockResolvedValue({
      cpu_server: 'building'
    })
    const { watch: following } = watch()

    await vi.advanceTimersByTimeAsync(30 * 60_000)
    await following.ready

    expect(following.step()).toBeUndefined()
  })

  it('names no step from a read that is still out at half an hour', async () => {
    vi.mocked(workspaceApi.getDeploymentCpuServer).mockImplementation(
      () =>
        new Promise((answer) =>
          setTimeout(() => answer({ cpu_server: 'building' }), 15_000)
        )
    )
    const { watch: following, settled } = watch()

    await vi.advanceTimersByTimeAsync(30 * 60_000)

    expect(settled.value).toBe(true)
    expect(following.step()).toBeUndefined()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(following.step()).toBeUndefined()
  })

  it('stops asking and names no step once its owner aborts', async () => {
    vi.mocked(workspaceApi.getDeploymentCpuServer).mockResolvedValue({
      cpu_server: 'building'
    })
    const { owner, watch: following } = watch()
    await vi.advanceTimersByTimeAsync(0)

    owner.abort()
    await following.ready
    await vi.advanceTimersByTimeAsync(20_000)

    expect(following.step()).toBeUndefined()
    expect(workspaceApi.getDeploymentCpuServer).toHaveBeenCalledOnce()
  })

  it('settles when its owner aborts during the first read', async () => {
    const first = pendingReading()
    const { owner, watch: following, settled } = watch(first.reading)

    owner.abort()
    await vi.advanceTimersByTimeAsync(0)
    expect(settled.value).toBe(true)

    first.answer({ answer: 'building' })
    await vi.advanceTimersByTimeAsync(0)
    expect(following.step()).toBeUndefined()
  })

  it('settles when its owner aborts during a later read', async () => {
    answers('building')
    const later = pendingReading()
    vi.mocked(workspaceApi.getDeploymentCpuServer).mockReturnValueOnce(
      later.reading.then(() => ({ cpu_server: 'created' }))
    )
    const { owner, watch: following, settled } = watch()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(workspaceApi.getDeploymentCpuServer).toHaveBeenCalledTimes(2)

    owner.abort()
    await vi.advanceTimersByTimeAsync(0)
    expect(settled.value).toBe(true)
    expect(following.step()).toBeUndefined()

    later.answer({ answer: 'created' })
    await vi.advanceTimersByTimeAsync(0)
    expect(following.step()).toBeUndefined()
  })

  it('settles at once and asks no more when its owner has already aborted', async () => {
    const owner = new AbortController()
    owner.abort()
    const { watch: following, settled } = watch(pendingReading().reading, owner)

    await vi.advanceTimersByTimeAsync(20_000)

    expect(settled.value).toBe(true)
    expect(following.step()).toBeUndefined()
    expect(workspaceApi.getDeploymentCpuServer).not.toHaveBeenCalled()
  })

  it('settles quietly when the read it stopped waiting for fails afterwards', async () => {
    const first = pendingReading()
    const { owner, watch: following } = watch(first.reading)

    owner.abort()
    first.fail(new Error('network down'))

    await expect(following.ready).resolves.toBeUndefined()
    expect(reportError).not.toHaveBeenCalled()
  })
})
