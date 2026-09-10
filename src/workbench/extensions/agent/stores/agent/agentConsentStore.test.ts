vi.mock(import('firebase/auth'))
vi.mock<unknown>(import('vuefire'), () => ({ useFirebaseAuth: vi.fn() }))
import type { GlobalSetting } from '@comfyorg/ingest-types'
import { useAuthStore } from '@/stores/authStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentConsentStore } from './agentConsentStore'

const accountApi = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn()
}))
vi.mock<unknown>(import('@/platform/settings/globalSettingsApi'), () => ({
  getGlobalSetting: accountApi.get,
  setGlobalSetting: accountApi.set
}))

const authState = await vi.hoisted(async () => {
  const { reactive } = await import('vue')
  return reactive<{
    identity: string | null
    workspaceId: string | null
    isSwitching: boolean
    generation: number
  }>({
    identity: 'account-a',
    workspaceId: 'workspace-a',
    isSwitching: false,
    generation: 0
  })
})
vi.mock<unknown>(import('@/composables/auth/useCurrentUser'), () => ({
  useCurrentUser: () => ({
    resolvedUserInfo: {
      get value() {
        return authState.identity ? { id: authState.identity } : null
      }
    }
  })
}))
const stored: GlobalSetting = {
  key: 'Comfy.AgentPanel.ConsentAccepted',
  value: true,
  updated_at: '2026-09-09T00:00:00Z'
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('agentConsentStore', () => {
  beforeEach(() => {
    authState.identity = 'account-a'
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-a' })
    useTeamWorkspaceStore().isSwitching = false
    Object.assign(useTeamWorkspaceStore(), { workspaceTransitionGeneration: 0 })
    vi.mocked(useTeamWorkspaceStore().initialize).mockResolvedValue(undefined)
    vi.mocked(useAuthStore().getWorkspaceAuthHeader).mockReset()
    vi.mocked(useAuthStore().getWorkspaceAuthHeader).mockResolvedValue({
      Authorization: 'Bearer account-a-token'
    })
    accountApi.get.mockReset()
    accountApi.get.mockResolvedValue(undefined)
    accountApi.set.mockReset()
    accountApi.set.mockResolvedValue(stored)
  })

  it('exposes acceptance only after the current account loads true', async () => {
    accountApi.get.mockResolvedValueOnce(stored)
    const store = useAgentConsentStore()

    await expect(store.load()).resolves.toBe(true)

    expect(store.accepted).toBe(true)
    expect(accountApi.get).toHaveBeenCalledWith(
      'Comfy.AgentPanel.ConsentAccepted',
      { Authorization: 'Bearer account-a-token' }
    )
  })

  it('marks only the authenticated account accepted after a confirmed write', async () => {
    const store = useAgentConsentStore()

    await expect(store.accept()).resolves.toBe(true)

    expect(store.accepted).toBe(true)
    expect(accountApi.set).toHaveBeenCalledWith(
      { key: 'Comfy.AgentPanel.ConsentAccepted', value: true },
      { Authorization: 'Bearer account-a-token' }
    )
  })

  it('discards a load that resolves after the account changes', async () => {
    let finishLoad = (_value: GlobalSetting | undefined): void => {}
    accountApi.get.mockImplementationOnce(
      () =>
        new Promise<GlobalSetting | undefined>((resolve) => {
          finishLoad = resolve
        })
    )
    const store = useAgentConsentStore()

    const request = store.load()
    await vi.waitFor(() => expect(accountApi.get).toHaveBeenCalledOnce())
    authState.identity = 'account-b'
    finishLoad(stored)

    await expect(request).resolves.toBe(false)
    expect(store.accepted).toBe(false)
  })

  it('discards a confirmed write result after the account changes', async () => {
    let finishSave = (_value: GlobalSetting): void => {}
    accountApi.set.mockImplementationOnce(
      () =>
        new Promise<GlobalSetting>((resolve) => {
          finishSave = resolve
        })
    )
    const store = useAgentConsentStore()

    const request = store.accept()
    await vi.waitFor(() => expect(accountApi.set).toHaveBeenCalledOnce())
    authState.identity = 'account-b'
    finishSave(stored)

    await expect(request).resolves.toBe(false)
    expect(store.accepted).toBe(false)
  })

  it('does not let a background load cancel an in-flight acceptance', async () => {
    let finishSave = (_value: GlobalSetting): void => {}
    accountApi.set.mockImplementationOnce(
      () =>
        new Promise<GlobalSetting>((resolve) => {
          finishSave = resolve
        })
    )
    const store = useAgentConsentStore()

    const acceptance = store.accept()
    await vi.waitFor(() => expect(accountApi.set).toHaveBeenCalledOnce())
    const load = store.load()
    finishSave(stored)

    await expect(acceptance).resolves.toBe(true)
    await expect(load).resolves.toBe(true)
    expect(store.accepted).toBe(true)
  })

  it('keeps a confirmed acceptance when an older load resolves afterwards', async () => {
    let finishLoad = (_value: GlobalSetting | undefined): void => {}
    accountApi.get.mockImplementationOnce(
      () =>
        new Promise<GlobalSetting | undefined>((resolve) => {
          finishLoad = resolve
        })
    )
    const store = useAgentConsentStore()

    const load = store.load()
    await vi.waitFor(() => expect(accountApi.get).toHaveBeenCalledOnce())
    await expect(store.accept()).resolves.toBe(true)
    finishLoad(undefined)

    await expect(load).resolves.toBe(true)
    expect(store.accepted).toBe(true)
  })

  it('shares one request between concurrent loads for the same account', async () => {
    accountApi.get.mockResolvedValueOnce(stored)
    const store = useAgentConsentStore()

    const results = await Promise.all([store.load(), store.load()])

    expect(results).toEqual([true, true])
    expect(accountApi.get).toHaveBeenCalledOnce()
    expect(store.accepted).toBe(true)
  })

  it('fails closed without an authenticated account', async () => {
    authState.identity = null
    const store = useAgentConsentStore()

    await expect(store.load()).rejects.toThrow(
      'Comfy account authentication is required'
    )
    expect(accountApi.get).not.toHaveBeenCalled()
    expect(store.accepted).toBe(false)
  })
  it('reloads acceptance when the same user moves to another workspace', async () => {
    accountApi.get.mockResolvedValueOnce(stored)
    const store = useAgentConsentStore()
    await store.load()
    expect(store.accepted).toBe(true)

    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-b' })
    expect(store.accepted).toBe(false)
    await expect(store.load()).resolves.toBe(false)
    expect(accountApi.get).toHaveBeenCalledTimes(2)
  })

  it('invalidates acceptance as soon as a workspace transition starts', async () => {
    const store = useAgentConsentStore()
    await store.accept()
    expect(store.accepted).toBe(true)
    Object.assign(useTeamWorkspaceStore(), {
      workspaceTransitionGeneration:
        useTeamWorkspaceStore().workspaceTransitionGeneration + 1
    })
    useTeamWorkspaceStore().isSwitching = true
    expect(store.accepted).toBe(false)
  })

  it('does not reuse an open decision after switching away and back', async () => {
    const store = useAgentConsentStore()
    const decisionIdentity = store.identity
    Object.assign(useTeamWorkspaceStore(), {
      workspaceTransitionGeneration:
        useTeamWorkspaceStore().workspaceTransitionGeneration + 1
    })
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-b' })
    Object.assign(useTeamWorkspaceStore(), {
      workspaceTransitionGeneration:
        useTeamWorkspaceStore().workspaceTransitionGeneration + 1
    })
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-a' })
    await expect(store.accept(decisionIdentity ?? undefined)).resolves.toBe(
      false
    )
    expect(accountApi.set).not.toHaveBeenCalled()
  })

  it('does not write when workspace scope changes while acquiring a token', async () => {
    const token = deferred<{ Authorization: `Bearer ${string}` }>()
    vi.mocked(useAuthStore().getWorkspaceAuthHeader).mockReturnValueOnce(
      token.promise
    )
    const store = useAgentConsentStore()
    const request = store.accept()
    await vi.waitFor(() =>
      expect(
        vi.mocked(useAuthStore().getWorkspaceAuthHeader)
      ).toHaveBeenCalledOnce()
    )
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-b' })
    token.resolve({ Authorization: 'Bearer workspace-b-token' })
    await expect(request).resolves.toBe(false)
    expect(accountApi.set).not.toHaveBeenCalled()
  })

  it.for(['load', 'accept'] as const)(
    'discards stale %s results after a workspace switch',
    async (method) => {
      const response = deferred<GlobalSetting>()
      const operation = method === 'load' ? accountApi.get : accountApi.set
      operation.mockReturnValueOnce(response.promise)
      const store = useAgentConsentStore()
      const request = store[method]()
      await vi.waitFor(() => expect(operation).toHaveBeenCalledOnce())
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-b'
      })
      response.resolve(stored)
      await expect(request).resolves.toBe(false)
      expect(store.accepted).toBe(false)
    }
  )

  it('resolves the workspace after sign-in before saving', async () => {
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })
    vi.mocked(useTeamWorkspaceStore().initialize).mockImplementationOnce(
      async () => {
        Object.assign(useTeamWorkspaceStore(), {
          activeWorkspaceId: 'workspace-a'
        })
      }
    )
    const store = useAgentConsentStore()
    await expect(store.accept()).resolves.toBe(true)
    expect(vi.mocked(useTeamWorkspaceStore().initialize)).toHaveBeenCalledOnce()
    expect(accountApi.set).toHaveBeenCalledOnce()
  })

  it('does not report another workspace’s stale request failure', async () => {
    const response = deferred<GlobalSetting>()
    accountApi.get.mockReturnValueOnce(response.promise)
    const store = useAgentConsentStore()
    const request = store.load()
    await vi.waitFor(() => expect(accountApi.get).toHaveBeenCalledOnce())
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-b' })
    response.reject(new Error('offline'))
    await expect(request).resolves.toBe(false)
  })
})
