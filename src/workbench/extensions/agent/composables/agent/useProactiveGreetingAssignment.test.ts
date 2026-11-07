import { fromPartial } from '@total-typescript/shoehorn'
import { setImmediate } from 'node:timers/promises'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import {
  ingestApiClient,
  requestAuth
} from '@/platform/remote/ingest/ingestApi'
import { canEnrollHostProactiveGreeting } from '@/platform/telemetry/hostProactiveGreeting'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import {
  authenticatedRemoteConfigState,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'

import {
  resolveProactiveGreetingAssignment,
  useProactiveGreetingAssignment
} from './useProactiveGreetingAssignment'

vi.mock(import('@/platform/remoteConfig/remoteConfig'))
vi.mock(import('@/platform/remote/ingest/ingestApi'), { spy: true })
vi.mock(import('@/platform/telemetry/hostProactiveGreeting'), { spy: true })
vi.mock(import('@/platform/auth/firebaseIdentity'), { spy: true })
const distribution = vi.hoisted(() => ({
  DISTRIBUTION: 'cloud' as const,
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))
vi.mock(import('@/platform/distribution/types'), () => distribution)
beforeEach(() => {
  distribution.isCloud = true
  vi.mocked(firebaseIdentity.onUserChanged).mockReturnValue(() => undefined)
  vi.mocked(firebaseIdentity.onTokenChanged).mockReturnValue(() => undefined)
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const identity = { userId: 'user-a', workspaceId: 'workspace-a' }
const assignment = {
  user_id: identity.userId,
  workspace_id: identity.workspaceId,
  group_key: JSON.stringify([identity.userId, identity.workspaceId]),
  variant: 'generic'
}

describe('proactive assignment boundary', () => {
  it('uses only authenticated config matching the active pair and clears on error or off', () => {
    useAuthStore().currentUser = fromPartial<User>({ uid: identity.userId })
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: identity.workspaceId
    })
    remoteConfig.value = {
      agent_proactive_greeting_assignment: { ...assignment, variant: 'generic' }
    }
    const result = useProactiveGreetingAssignment()
    expect(result.value).toBeUndefined()
    authenticatedRemoteConfigState.value = 'authenticated'
    expect(result.value?.variant).toBe('B')
    const first = result.value
    remoteConfig.value = {
      agent_proactive_greeting_assignment: { ...assignment, variant: 'generic' }
    }
    expect(result.value).toBe(first)
    authenticatedRemoteConfigState.value = 'error'
    expect(result.value).toBeUndefined()
    authenticatedRemoteConfigState.value = 'authenticated'
    remoteConfig.value = {}
    expect(result.value).toBeUndefined()
  })

  it('does not use Cloud assignment on an ordinary local browser', () => {
    distribution.isCloud = false
    useAuthStore().currentUser = fromPartial<User>({ uid: identity.userId })
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: identity.workspaceId
    })
    remoteConfig.value = {
      agent_proactive_greeting_assignment: { ...assignment, variant: 'generic' }
    }
    authenticatedRemoteConfigState.value = 'authenticated'
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    expect(scope.run(useProactiveGreetingAssignment)?.value).toBeUndefined()
  })
  it.for([
    ['control', 'A'],
    ['generic', 'B'],
    ['canvas-prefill', 'C'],
    ['canvas-only', 'D']
  ])('maps %s only for its authenticated pair', ([variant, expected]) => {
    const wire = { ...assignment, variant }
    expect(
      resolveProactiveGreetingAssignment(
        { agent_proactive_greeting_assignment: wire },
        identity
      )
    ).toEqual({
      ...identity,
      variant: expected,
      telemetry: wire
    })
  })

  it.for([
    undefined,
    null,
    { ...assignment, user_id: 'another-user' },
    { ...assignment, workspace_id: 'another-workspace' },
    { ...assignment, group_key: 'user-a:workspace-a' },
    { ...assignment, variant: 'unknown' }
  ])('fails closed for absent, malformed or stale assignments', (wire) => {
    expect(
      resolveProactiveGreetingAssignment(
        { agent_proactive_greeting_assignment: wire },
        identity
      )
    ).toBeUndefined()
  })

  it('does not accept a valid assignment before identity is resolved', () => {
    expect(
      resolveProactiveGreetingAssignment(
        { agent_proactive_greeting_assignment: assignment },
        { userId: null, workspaceId: identity.workspaceId }
      )
    ).toBeUndefined()
  })
})

describe('Desktop remote assignment', () => {
  beforeEach(() => {
    remoteConfig.value = { enable_telemetry: true }
    distribution.isCloud = false
    useAuthStore().currentUser = fromPartial<User>({ uid: identity.userId })
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: identity.workspaceId
    })
    useAgentPanelStore().isOpen = true
    vi.mocked(requestAuth).mockResolvedValue({
      headers: { Authorization: 'Bearer scoped-token' }
    })
  })

  it('reads remote authenticated features only after host admission and retries on reopen', async () => {
    vi.mocked(canEnrollHostProactiveGreeting).mockResolvedValue(false)
    const get = vi.spyOn(ingestApiClient, 'get').mockResolvedValue({
      data: { agent_proactive_greeting_assignment: assignment }
    })
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const result = scope.run(useProactiveGreetingAssignment)!
    await nextTick()
    expect(result.value).toBeUndefined()
    expect(get).not.toHaveBeenCalled()

    vi.mocked(canEnrollHostProactiveGreeting).mockResolvedValue(true)
    useAgentPanelStore().isOpen = false
    useAgentPanelStore().isOpen = true
    await vi.waitFor(() => expect(result.value?.variant).toBe('B'))
    expect(get).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/^https:\/\/[^/]+\/api\/features$/),
      expect.objectContaining({
        headers: { Authorization: 'Bearer scoped-token' },
        signal: expect.any(AbortSignal)
      })
    )
    useAgentPanelStore().isOpen = false
    expect(result.value).toBeUndefined()
  })

  it.for([
    { admitted: true, expectedVariant: 'B' },
    { admitted: false, expectedVariant: undefined }
  ])(
    'requires host admission for Cloud hosted inside Desktop: $admitted',
    async ({ admitted, expectedVariant }) => {
      distribution.isCloud = true
      window.__comfyDesktop2 = {
        isRemote: () => true,
        Telemetry: { capture: vi.fn() }
      }
      onTestFinished(() => {
        delete window.__comfyDesktop2
      })
      remoteConfig.value = {
        enable_telemetry: true,
        agent_proactive_greeting_assignment: {
          ...assignment,
          variant: 'generic'
        }
      }
      authenticatedRemoteConfigState.value = 'authenticated'
      const admission = deferred<boolean>()
      vi.mocked(canEnrollHostProactiveGreeting).mockReturnValue(
        admission.promise
      )
      const get = vi.spyOn(ingestApiClient, 'get')
      const scope = effectScope()
      onTestFinished(() => scope.stop())
      const result = scope.run(useProactiveGreetingAssignment)!
      expect(result.value).toBeUndefined()
      admission.resolve(admitted)
      await setImmediate()
      expect(result.value?.variant).toBe(expectedVariant)
      expect(get).not.toHaveBeenCalled()
      remoteConfig.value = { ...remoteConfig.value, enable_telemetry: false }
      expect(result.value).toBeUndefined()
    }
  )

  it('rejects a response whose pair was replaced while loading', async () => {
    vi.mocked(canEnrollHostProactiveGreeting).mockResolvedValue(true)
    const pending = deferred<{ data: unknown }>()
    const get = vi
      .spyOn(ingestApiClient, 'get')
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue({ data: {} })
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const result = scope.run(useProactiveGreetingAssignment)!
    await vi.waitFor(() => expect(get).toHaveBeenCalledOnce())
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-b' })
    pending.resolve({
      data: { agent_proactive_greeting_assignment: assignment }
    })
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    expect(result.value).toBeUndefined()
  })

  it('rejects stale host admission and failed remote reads', async () => {
    const admission = deferred<boolean>()
    vi.mocked(canEnrollHostProactiveGreeting)
      .mockReturnValueOnce(admission.promise)
      .mockResolvedValue(true)
    const get = vi
      .spyOn(ingestApiClient, 'get')
      .mockRejectedValue(new Error('offline'))
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const result = scope.run(useProactiveGreetingAssignment)!
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-b' })
    admission.resolve(true)
    await vi.waitFor(() => expect(get).toHaveBeenCalledOnce())
    expect(result.value).toBeUndefined()
  })
})
