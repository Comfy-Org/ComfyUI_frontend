import type { GlobalSetting } from '@comfyorg/ingest-types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentConsentStore } from './agentConsentStore'

const accountApi = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn()
}))
vi.mock('@/platform/settings/globalSettingsApi', () => ({
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
const authMocks = vi.hoisted(() => ({
  getHeader: vi.fn(),
  initialize: vi.fn()
}))
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    resolvedUserInfo: {
      get value() {
        return authState.identity ? { id: authState.identity } : null
      }
    }
  })
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    getUserAuthHeader: authMocks.getHeader,
    getWorkspaceAuthHeader: authMocks.getHeader
  })
}))
vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get activeWorkspaceId() {
      return authState.workspaceId
    },
    get isSwitching() {
      return authState.isSwitching
    },
    get workspaceTransitionGeneration() {
      return authState.generation
    },
    initialize: authMocks.initialize
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
    setActivePinia(createPinia())
    authState.identity = 'account-a'
    authState.workspaceId = 'workspace-a'
    authState.isSwitching = false
    authState.generation = 0
    authMocks.initialize.mockResolvedValue(undefined)
    authMocks.getHeader.mockReset()
    authMocks.getHeader.mockResolvedValue({
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

    authState.workspaceId = 'workspace-b'
    expect(store.accepted).toBe(false)
    await expect(store.load()).resolves.toBe(false)
    expect(accountApi.get).toHaveBeenCalledTimes(2)
  })

  it('invalidates acceptance as soon as a workspace transition starts', async () => {
    const store = useAgentConsentStore()
    await store.accept()
    expect(store.accepted).toBe(true)
    authState.generation += 1
    authState.isSwitching = true
    expect(store.accepted).toBe(false)
  })

  it('does not reuse an open decision after switching away and back', async () => {
    const store = useAgentConsentStore()
    const decisionIdentity = store.identity
    authState.generation += 1
    authState.workspaceId = 'workspace-b'
    authState.generation += 1
    authState.workspaceId = 'workspace-a'
    await expect(store.accept(decisionIdentity ?? undefined)).resolves.toBe(
      false
    )
    expect(accountApi.set).not.toHaveBeenCalled()
  })

  it('does not write when workspace scope changes while acquiring a token', async () => {
    const token = deferred<{ Authorization: string }>()
    authMocks.getHeader.mockReturnValueOnce(token.promise)
    const store = useAgentConsentStore()
    const request = store.accept()
    await vi.waitFor(() => expect(authMocks.getHeader).toHaveBeenCalledOnce())
    authState.workspaceId = 'workspace-b'
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
      authState.workspaceId = 'workspace-b'
      response.resolve(stored)
      await expect(request).resolves.toBe(false)
      expect(store.accepted).toBe(false)
    }
  )

  it('resolves the workspace after sign-in before saving', async () => {
    authState.workspaceId = null
    authMocks.initialize.mockImplementationOnce(async () => {
      authState.workspaceId = 'workspace-a'
    })
    const store = useAgentConsentStore()
    await expect(store.accept()).resolves.toBe(true)
    expect(authMocks.initialize).toHaveBeenCalledOnce()
    expect(accountApi.set).toHaveBeenCalledOnce()
  })

  it('does not report another workspace’s stale request failure', async () => {
    const response = deferred<GlobalSetting>()
    accountApi.get.mockReturnValueOnce(response.promise)
    const store = useAgentConsentStore()
    const request = store.load()
    await vi.waitFor(() => expect(accountApi.get).toHaveBeenCalledOnce())
    authState.workspaceId = 'workspace-b'
    response.reject(new Error('offline'))
    await expect(request).resolves.toBe(false)
  })
})
