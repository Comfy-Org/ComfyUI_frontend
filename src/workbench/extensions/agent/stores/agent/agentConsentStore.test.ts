import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentConsentStore } from './agentConsentStore'

const accountApi = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn()
}))
vi.mock('@/platform/settings/accountSettingsApi', () => ({
  getAccountSetting: accountApi.get,
  setAccountSetting: accountApi.set
}))

const authState = vi.hoisted(() => ({
  identity: 'account-a' as string | null,
  getUserAuthHeader: vi.fn()
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
    getUserAuthHeader: authState.getUserAuthHeader
  })
}))

describe('agentConsentStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    authState.identity = 'account-a'
    authState.getUserAuthHeader.mockReset()
    authState.getUserAuthHeader.mockResolvedValue({
      Authorization: 'Bearer account-a-token'
    })
    accountApi.get.mockReset()
    accountApi.get.mockResolvedValue(false)
    accountApi.set.mockReset()
    accountApi.set.mockResolvedValue(undefined)
  })

  it('exposes acceptance only after the current account loads true', async () => {
    accountApi.get.mockResolvedValueOnce(true)
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
      'Comfy.AgentPanel.ConsentAccepted',
      true,
      { Authorization: 'Bearer account-a-token' }
    )
  })

  it('discards a load that resolves after the account changes', async () => {
    let finishLoad = (_value: boolean): void => {}
    accountApi.get.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishLoad = resolve
        })
    )
    const store = useAgentConsentStore()

    const request = store.load()
    await vi.waitFor(() => expect(accountApi.get).toHaveBeenCalledOnce())
    authState.identity = 'account-b'
    finishLoad(true)

    await expect(request).resolves.toBe(false)
    expect(store.accepted).toBe(false)
  })

  it('discards a confirmed write result after the account changes', async () => {
    let finishSave = (): void => {}
    accountApi.set.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve
        })
    )
    const store = useAgentConsentStore()

    const request = store.accept()
    await vi.waitFor(() => expect(accountApi.set).toHaveBeenCalledOnce())
    authState.identity = 'account-b'
    finishSave()

    await expect(request).resolves.toBe(false)
    expect(store.accepted).toBe(false)
  })

  it('does not let a background load cancel an in-flight acceptance', async () => {
    let finishSave = (): void => {}
    accountApi.set.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve
        })
    )
    const store = useAgentConsentStore()

    const acceptance = store.accept()
    await vi.waitFor(() => expect(accountApi.set).toHaveBeenCalledOnce())
    const load = store.load()
    finishSave()

    await expect(acceptance).resolves.toBe(true)
    await expect(load).resolves.toBe(true)
    expect(store.accepted).toBe(true)
  })

  it('keeps a confirmed acceptance when an older load resolves afterwards', async () => {
    let finishLoad = (_value: boolean): void => {}
    accountApi.get.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishLoad = resolve
        })
    )
    const store = useAgentConsentStore()

    const load = store.load()
    await vi.waitFor(() => expect(accountApi.get).toHaveBeenCalledOnce())
    await expect(store.accept()).resolves.toBe(true)
    finishLoad(false)

    await expect(load).resolves.toBe(true)
    expect(store.accepted).toBe(true)
  })

  it('shares one request between concurrent loads for the same account', async () => {
    accountApi.get.mockResolvedValueOnce(true)
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
})
