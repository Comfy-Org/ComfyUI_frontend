import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ChurnkeyAuthUnavailableError, useChurnkey } from './useChurnkey'

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    getChurnkeyAuth: vi.fn()
  }
}))

const { workspaceApi } = await import('@/platform/workspace/api/workspaceApi')

type GlobalWithChurnkey = typeof globalThis & {
  __CHURNKEY_APP_ID__: string
}
const globalWithChurnkey = globalThis as GlobalWithChurnkey
const windowWithOverride = window as { __CHURNKEY_APP_ID_OVERRIDE__?: string }

describe('useChurnkey', () => {
  let originalAppId: string

  beforeEach(() => {
    originalAppId = globalWithChurnkey.__CHURNKEY_APP_ID__
    globalWithChurnkey.__CHURNKEY_APP_ID__ = 'app-test-123'
    vi.mocked(workspaceApi.getChurnkeyAuth).mockReset()
  })

  afterEach(() => {
    globalWithChurnkey.__CHURNKEY_APP_ID__ = originalAppId
    delete windowWithOverride.__CHURNKEY_APP_ID_OVERRIDE__
    vi.restoreAllMocks()
    delete (window as { churnkey?: unknown }).churnkey
  })

  it('throws when the embed script has not loaded', async () => {
    const { show } = useChurnkey()
    await expect(show({})).rejects.toThrow(/embed script has not loaded/)
  })

  it('forwards customer credentials and provider config to churnkey.init', async () => {
    const init = vi.fn()
    ;(window as { churnkey?: unknown }).churnkey = { init }

    vi.mocked(workspaceApi.getChurnkeyAuth).mockResolvedValue({
      customer_id: 'cus_123',
      auth_hash: 'hash_abc',
      mode: 'test'
    })

    const onCancel = vi.fn()
    const onClose = vi.fn()

    const { show } = useChurnkey()
    await show({
      onCancel,
      onClose,
      customerAttributes: { tier: 'PRO', cycle: 'MONTHLY' }
    })

    expect(init).toHaveBeenCalledTimes(1)
    const [action, config] = init.mock.calls[0]
    expect(action).toBe('show')
    expect(config).toMatchObject({
      appId: 'app-test-123',
      authHash: 'hash_abc',
      customerId: 'cus_123',
      provider: 'stripe',
      mode: 'test',
      customerAttributes: { tier: 'PRO', cycle: 'MONTHLY' }
    })
    // No handleCancel - Churnkey handles the Stripe cancellation itself.
    expect(config.handleCancel).toBeUndefined()

    config.onCancel('cus_123', 'too_expensive')
    expect(onCancel).toHaveBeenCalledWith('too_expensive')

    config.onClose({ status: 'closed' })
    expect(onClose).toHaveBeenCalledWith({ status: 'closed' })
  })

  it('returns isConfigured=false when CHURNKEY_APP_ID is unset', () => {
    globalWithChurnkey.__CHURNKEY_APP_ID__ = ''
    const churnkey = useChurnkey()
    expect(churnkey.isConfigured).toBe(false)
  })

  it('uses the window app ID override when set, falling back to __CHURNKEY_APP_ID__', () => {
    globalWithChurnkey.__CHURNKEY_APP_ID__ = ''
    windowWithOverride.__CHURNKEY_APP_ID_OVERRIDE__ = 'override-id'
    expect(useChurnkey().isConfigured).toBe(true)
    delete windowWithOverride.__CHURNKEY_APP_ID_OVERRIDE__
    globalWithChurnkey.__CHURNKEY_APP_ID__ = 'build-id'
    expect(useChurnkey().isConfigured).toBe(true)
  })

  it('window app ID override wins over __CHURNKEY_APP_ID__ in init config', async () => {
    const init = vi.fn()
    ;(window as { churnkey?: unknown }).churnkey = { init }
    globalWithChurnkey.__CHURNKEY_APP_ID__ = 'build-id'
    windowWithOverride.__CHURNKEY_APP_ID_OVERRIDE__ = 'override-id'
    vi.mocked(workspaceApi.getChurnkeyAuth).mockResolvedValue({
      customer_id: 'cus_1',
      auth_hash: 'h',
      mode: 'test'
    })

    await useChurnkey().show({
      handleCancel: async () => ({ message: 'ok' })
    })

    expect(init.mock.calls[0][1]).toMatchObject({ appId: 'override-id' })
  })

  it('throws ChurnkeyAuthUnavailableError when getChurnkeyAuth returns null', async () => {
    ;(window as { churnkey?: unknown }).churnkey = { init: vi.fn() }
    vi.mocked(workspaceApi.getChurnkeyAuth).mockResolvedValue(null)

    const { show } = useChurnkey()
    await expect(show({})).rejects.toBeInstanceOf(ChurnkeyAuthUnavailableError)
  })
})
