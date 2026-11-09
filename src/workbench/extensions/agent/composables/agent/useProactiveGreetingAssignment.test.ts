import { fromPartial } from '@total-typescript/shoehorn'
import { reportError } from '@comfyorg/telemetry/reportError'
import { setImmediate } from 'node:timers/promises'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import {
  ingestApiClient,
  requestAuth
} from '@/platform/remote/ingest/ingestApi'
import { getHostProactiveGreetingAdmission } from '@/platform/telemetry/hostProactiveGreeting'
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
vi.mock(import('@comfyorg/telemetry/reportError'))
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

function installHost(
  getProactiveGreetingAdmission: (
    userId: string,
    firebaseIdToken?: string
  ) => Promise<string> = async () => 'denied'
) {
  const listeners = new Set<() => void>()
  window.__comfyDesktop2 = {
    Telemetry: Object.assign(
      { capture: vi.fn() },
      {
        proactiveGreetingExperimentVersion: 2,
        getProactiveGreetingAdmission,
        enrollProactiveGreeting: async () => true,
        onProactiveGreetingAdmissionChanged: (callback: () => void) => {
          listeners.add(callback)
          return () => listeners.delete(callback)
        }
      }
    )
  }
  onTestFinished(() => {
    delete window.__comfyDesktop2
  })
  return () => listeners.forEach((callback) => callback())
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
    installHost()
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

  it('proves a matching Firebase actor after assignment and waits for Desktop admission', async () => {
    const proof = deferred<'allowed'>()
    const getAdmission = vi.fn(async (_userId: string, idToken?: string) =>
      idToken ? await proof.promise : 'verify-firebase'
    )
    installHost(getAdmission)
    const getIdToken = vi.fn(async () => 'firebase-id-token')
    useAuthStore().currentUser = fromPartial<User>({
      uid: identity.userId,
      getIdToken
    })
    const features = deferred<{ data: unknown }>()
    const get = vi
      .spyOn(ingestApiClient, 'get')
      .mockReturnValue(features.promise)
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const result = scope.run(useProactiveGreetingAssignment)!
    await vi.waitFor(() => expect(get).toHaveBeenCalledOnce())
    expect(getIdToken).not.toHaveBeenCalled()

    features.resolve({
      data: { agent_proactive_greeting_assignment: assignment }
    })
    await vi.waitFor(() =>
      expect(getAdmission).toHaveBeenCalledWith(
        identity.userId,
        'firebase-id-token'
      )
    )
    expect(result.value).toBeUndefined()
    proof.resolve('allowed')
    await vi.waitFor(() => expect(result.value?.variant).toBe('B'))
  })

  it('does not read a Firebase ID token when there is no matching assignment', async () => {
    const getAdmission = vi.fn(async () => 'verify-firebase')
    installHost(getAdmission)
    const getIdToken = vi.fn(async () => 'firebase-id-token')
    useAuthStore().currentUser = fromPartial<User>({
      uid: identity.userId,
      getIdToken
    })
    const get = vi.spyOn(ingestApiClient, 'get').mockResolvedValue({ data: {} })
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const result = scope.run(useProactiveGreetingAssignment)!
    await vi.waitFor(() => expect(get).toHaveBeenCalledOnce())
    await setImmediate()
    expect(getIdToken).not.toHaveBeenCalled()
    expect(getAdmission).toHaveBeenCalledOnce()
    expect(result.value).toBeUndefined()
  })

  it('never sends a Firebase ID token from a replaced account', async () => {
    const getAdmission = vi.fn(async (userId: string) =>
      userId === identity.userId ? 'verify-firebase' : 'denied'
    )
    installHost(getAdmission)
    const token = deferred<string>()
    const getIdToken = vi.fn(() => token.promise)
    useAuthStore().currentUser = fromPartial<User>({
      uid: identity.userId,
      getIdToken
    })
    vi.spyOn(ingestApiClient, 'get').mockResolvedValue({
      data: { agent_proactive_greeting_assignment: assignment }
    })
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const result = scope.run(useProactiveGreetingAssignment)!
    await vi.waitFor(() => expect(getIdToken).toHaveBeenCalledOnce())

    useAuthStore().currentUser = fromPartial<User>({ uid: 'user-b' })
    token.resolve('stale-firebase-token')
    await setImmediate()
    expect(getAdmission).not.toHaveBeenCalledWith(
      identity.userId,
      'stale-firebase-token'
    )
    expect(result.value).toBeUndefined()
  })

  it('follows late Desktop identity and live consent while the panel stays open', async () => {
    const invalidateAdmission = installHost()
    remoteConfig.value = {}
    useAuthStore().currentUser = null
    vi.mocked(getHostProactiveGreetingAdmission).mockResolvedValue('denied')
    const get = vi.spyOn(ingestApiClient, 'get').mockResolvedValue({
      data: { agent_proactive_greeting_assignment: assignment }
    })
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const result = scope.run(useProactiveGreetingAssignment)!

    useAuthStore().currentUser = fromPartial<User>({ uid: identity.userId })
    await setImmediate()
    expect(result.value).toBeUndefined()
    expect(get).not.toHaveBeenCalled()

    vi.mocked(getHostProactiveGreetingAdmission).mockResolvedValue('allowed')
    invalidateAdmission()
    await vi.waitFor(() => expect(result.value?.variant).toBe('B'))

    vi.mocked(getHostProactiveGreetingAdmission).mockResolvedValue('denied')
    invalidateAdmission()
    expect(result.value).toBeUndefined()
    await setImmediate()
    expect(get).toHaveBeenCalledOnce()

    vi.mocked(getHostProactiveGreetingAdmission).mockResolvedValue('allowed')
    invalidateAdmission()
    await vi.waitFor(() => expect(result.value?.variant).toBe('B'))

    scope.stop()
    invalidateAdmission()
    await setImmediate()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('discards an in-flight assignment when Desktop revokes admission for the same pair', async () => {
    const invalidateAdmission = installHost()
    vi.mocked(getHostProactiveGreetingAdmission).mockResolvedValue('allowed')
    const pending = deferred<{ data: unknown }>()
    const get = vi
      .spyOn(ingestApiClient, 'get')
      .mockReturnValue(pending.promise)
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const result = scope.run(useProactiveGreetingAssignment)!
    await vi.waitFor(() => expect(get).toHaveBeenCalledOnce())

    vi.mocked(getHostProactiveGreetingAdmission).mockResolvedValue('denied')
    invalidateAdmission()
    pending.resolve({
      data: { agent_proactive_greeting_assignment: assignment }
    })
    await setImmediate()
    expect(result.value).toBeUndefined()
  })

  it.for([
    {
      stage: 'authentication',
      fail: () =>
        vi
          .mocked(requestAuth)
          .mockRejectedValue(new Error('private auth detail'))
    },
    {
      stage: 'features',
      fail: () =>
        vi
          .mocked(ingestApiClient.get)
          .mockRejectedValue(new Error('private request detail'))
    }
  ])(
    'reports $stage failures once without request or identity details',
    async ({ fail }) => {
      vi.mocked(getHostProactiveGreetingAdmission).mockResolvedValue('allowed')
      vi.spyOn(ingestApiClient, 'get').mockResolvedValue({ data: {} })
      fail()
      const scope = effectScope()
      onTestFinished(() => scope.stop())
      const result = scope.run(useProactiveGreetingAssignment)!
      await setImmediate()
      expect(result.value).toBeUndefined()
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        new Error('Failed to load proactive greeting assignment'),
        {
          surface: 'agent',
          errorType: 'failure_loading_agent_proactive_assignment',
          level: 'warning'
        }
      )
      useAgentPanelStore().isOpen = false
      useAgentPanelStore().isOpen = true
      await setImmediate()
      expect(result.value).toBeUndefined()
      expect(reportError).toHaveBeenCalledTimes(1)
    }
  )

  it('does not report a request failure after its panel closes', async () => {
    vi.mocked(getHostProactiveGreetingAdmission).mockResolvedValue('allowed')
    let rejectRequest!: (reason: Error) => void
    const request = new Promise<never>((_, reject) => {
      rejectRequest = reject
    })
    const get = vi.spyOn(ingestApiClient, 'get').mockReturnValue(request)
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const result = scope.run(useProactiveGreetingAssignment)!
    await vi.waitFor(() => expect(get).toHaveBeenCalledOnce())
    useAgentPanelStore().isOpen = false
    rejectRequest(new Error('aborted request'))
    await setImmediate()
    expect(result.value).toBeUndefined()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reads remote authenticated features only after host admission and retries on reopen', async () => {
    vi.mocked(getHostProactiveGreetingAdmission).mockResolvedValue('denied')
    const get = vi.spyOn(ingestApiClient, 'get').mockResolvedValue({
      data: { agent_proactive_greeting_assignment: assignment }
    })
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const result = scope.run(useProactiveGreetingAssignment)!
    await nextTick()
    expect(result.value).toBeUndefined()
    expect(get).not.toHaveBeenCalled()

    vi.mocked(getHostProactiveGreetingAdmission).mockResolvedValue('allowed')
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
      remoteConfig.value = {
        enable_telemetry: true,
        agent_proactive_greeting_assignment: {
          ...assignment,
          variant: 'generic'
        }
      }
      authenticatedRemoteConfigState.value = 'authenticated'
      const admission = deferred<'allowed' | 'denied'>()
      vi.mocked(getHostProactiveGreetingAdmission).mockReturnValue(
        admission.promise
      )
      const get = vi.spyOn(ingestApiClient, 'get')
      const scope = effectScope()
      onTestFinished(() => scope.stop())
      const result = scope.run(useProactiveGreetingAssignment)!
      expect(result.value).toBeUndefined()
      admission.resolve(admitted ? 'allowed' : 'denied')
      await setImmediate()
      expect(result.value?.variant).toBe(expectedVariant)
      expect(get).not.toHaveBeenCalled()
    }
  )

  it('rejects a response whose pair was replaced while loading', async () => {
    vi.mocked(getHostProactiveGreetingAdmission).mockResolvedValue('allowed')
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
    const admission = deferred<'allowed' | 'denied'>()
    vi.mocked(getHostProactiveGreetingAdmission)
      .mockReturnValueOnce(admission.promise)
      .mockResolvedValue('allowed')
    const get = vi
      .spyOn(ingestApiClient, 'get')
      .mockRejectedValue(new Error('offline'))
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const result = scope.run(useProactiveGreetingAssignment)!
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-b' })
    admission.resolve('allowed')
    await vi.waitFor(() => expect(get).toHaveBeenCalledOnce())
    expect(result.value).toBeUndefined()
  })
})
