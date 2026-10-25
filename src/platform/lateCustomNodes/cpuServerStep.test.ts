import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { provideCurrentUser } from '@/platform/auth/currentUserAccess'
import { reportError } from '@/platform/telemetry/reportError'
import type { WorkspaceDeploymentCpuServer } from '@/platform/workspace/api/workspaceApi'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

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

  it('reads a 404 as no CPU server, and a 502 as a step it could not tell', async () => {
    await signIn()
    answers(
      new WorkspaceApiError('not found', 404),
      new WorkspaceApiError('cpu_server_unknown', 502)
    )

    await expect(askCpuServer()).resolves.toEqual({ answer: 'none' })
    await expect(askCpuServer()).resolves.toEqual({ answer: 'unknown' })
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
  beforeEach(async () => {
    vi.useFakeTimers()
    await signIn()
  })

  it('follows the step every five seconds until the CPU server exists', async () => {
    answers('building', 'building', 'created')
    const watch = watchCpuServer(askCpuServer(), new AbortController().signal)
    await vi.advanceTimersByTimeAsync(0)
    expect(watch.step()).toBe('building')

    await vi.advanceTimersByTimeAsync(5_000)
    expect(watch.step()).toBe('building')

    await vi.advanceTimersByTimeAsync(5_000)
    await watch.ready
    expect(watch.step()).toBe('starting')
    expect(workspaceApi.getDeploymentCpuServer).toHaveBeenCalledTimes(3)
  })

  it('keeps the step it had when a read cannot tell', async () => {
    answers('creating', new WorkspaceApiError('cpu_server_unknown', 502))
    const watch = watchCpuServer(askCpuServer(), new AbortController().signal)

    await vi.advanceTimersByTimeAsync(5_000)

    expect(watch.step()).toBe('creating')
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports the first read that failed for another reason, once', async () => {
    const failure = new Error('network down')
    answers('creating', failure, failure)
    watchCpuServer(askCpuServer(), new AbortController().signal)

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
    const watch = watchCpuServer(askCpuServer(), new AbortController().signal)

    await vi.advanceTimersByTimeAsync(30 * 60_000)
    await watch.ready

    expect(watch.step()).toBeUndefined()
  })

  it('stops asking once its owner aborts', async () => {
    vi.mocked(workspaceApi.getDeploymentCpuServer).mockResolvedValue({
      cpu_server: 'building'
    })
    const owner = new AbortController()
    const watch = watchCpuServer(askCpuServer(), owner.signal)
    await vi.advanceTimersByTimeAsync(0)

    owner.abort()
    await watch.ready
    await vi.advanceTimersByTimeAsync(20_000)

    expect(workspaceApi.getDeploymentCpuServer).toHaveBeenCalledOnce()
  })
})
