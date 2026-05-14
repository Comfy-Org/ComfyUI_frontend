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

describe('useChurnkey', () => {
  let originalAppId: string

  beforeEach(() => {
    originalAppId = globalWithChurnkey.__CHURNKEY_APP_ID__
    globalWithChurnkey.__CHURNKEY_APP_ID__ = 'app-test-123'
    vi.mocked(workspaceApi.getChurnkeyAuth).mockReset()
  })

  afterEach(() => {
    globalWithChurnkey.__CHURNKEY_APP_ID__ = originalAppId
    vi.restoreAllMocks()
    delete (window as { churnkey?: unknown }).churnkey
  })

  it('throws when the embed script has not loaded', async () => {
    const { show } = useChurnkey()
    await expect(
      show({ handleCancel: async () => ({ message: 'ok' }) })
    ).rejects.toThrow(/embed script has not loaded/)
  })

  it('forwards customer credentials and provider config to churnkey.init', async () => {
    const init = vi.fn()
    ;(window as { churnkey?: unknown }).churnkey = { init }

    vi.mocked(workspaceApi.getChurnkeyAuth).mockResolvedValue({
      customer_id: 'cus_123',
      subscription_id: 'sub_456',
      auth_hash: 'hash_abc',
      mode: 'test'
    })

    const handleCancel = vi.fn().mockResolvedValue({ message: 'done' })
    const onClose = vi.fn()

    const { show } = useChurnkey()
    await show({
      handleCancel,
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
      subscriptionId: 'sub_456',
      provider: 'stripe',
      mode: 'test',
      customerAttributes: { tier: 'PRO', cycle: 'MONTHLY' }
    })

    await config.handleCancel('cus_123', 'too_expensive', 'feedback')
    expect(handleCancel).toHaveBeenCalledWith('too_expensive', 'feedback')

    config.onClose({ status: 'closed' })
    expect(onClose).toHaveBeenCalledWith({ status: 'closed' })
  })

  it('returns isConfigured=false when CHURNKEY_APP_ID is unset', () => {
    globalWithChurnkey.__CHURNKEY_APP_ID__ = ''
    const churnkey = useChurnkey()
    expect(churnkey.isConfigured).toBe(false)
  })

  it('throws ChurnkeyAuthUnavailableError when getChurnkeyAuth returns null', async () => {
    ;(window as { churnkey?: unknown }).churnkey = { init: vi.fn() }
    vi.mocked(workspaceApi.getChurnkeyAuth).mockResolvedValue(null)

    const { show } = useChurnkey()
    await expect(
      show({ handleCancel: async () => ({ message: 'ok' }) })
    ).rejects.toBeInstanceOf(ChurnkeyAuthUnavailableError)
  })
})
