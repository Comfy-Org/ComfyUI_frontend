import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChurnkeyAuthResponse } from './churnkeyAuthSchema'

import type { ChurnkeyInitConfig } from './types'

const mocks = vi.hoisted(() => ({
  appId: 'app_test',
  getChurnkeyAuth: vi.fn(),
  init: vi.fn(),
  hide: vi.fn(),
  clearState: vi.fn()
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get churnkeyAppId() {
        return mocks.appId
      }
    }
  })
}))

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    getChurnkeyAuth: mocks.getChurnkeyAuth
  }
}))

import { prepareChurnkey } from './churnkeyClient'

function authResponse(): ChurnkeyAuthResponse {
  return {
    customer_id: 'cus_test_1',
    auth_hash: 'signed-hash',
    mode: 'test'
  }
}

function capturedConfig(): ChurnkeyInitConfig {
  const config = mocks.init.mock.calls[0]?.[1]
  if (!config) throw new Error('Churnkey was not initialized')
  return config
}

describe('churnkeyClient', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.appId = 'app_test'
    mocks.getChurnkeyAuth.mockResolvedValue(authResponse())
    window.churnkey = {
      init: mocks.init,
      hide: mocks.hide,
      clearState: mocks.clearState
    }
  })

  it('builds a Stripe-provider session from backend credentials', async () => {
    const session = await prepareChurnkey()
    if (!session) throw new Error('Expected a Churnkey session')

    const handleCancel = vi.fn().mockResolvedValue({ message: 'Canceled' })
    const showPromise = session.show({
      handleCancel,
      customerAttributes: { tier: 'PRO' }
    })
    const config = capturedConfig()

    expect(mocks.init).toHaveBeenCalledWith('show', config)
    expect(config).toMatchObject({
      appId: 'app_test',
      authHash: 'signed-hash',
      customerId: 'cus_test_1',
      provider: 'stripe',
      mode: 'test',
      customerAttributes: { tier: 'PRO' }
    })
    expect(config).not.toHaveProperty('customer')
    expect(config).not.toHaveProperty('subscriptions')
    expect(config).not.toHaveProperty('record')

    await expect(
      config.handleCancel({ id: 'cus_test_1' }, 'Too expensive', 'Feedback')
    ).resolves.toEqual({ message: 'Canceled' })
    expect(handleCancel).toHaveBeenCalledWith('Too expensive', 'Feedback')
    await expect(config.handlePause()).rejects.toThrow(
      'Unsupported ChurnKey offer'
    )
    await expect(config.handleDiscount()).rejects.toThrow(
      'Unsupported ChurnKey offer'
    )
    await expect(config.handleTrialExtension()).rejects.toThrow(
      'Unsupported ChurnKey offer'
    )
    await expect(config.handlePlanChange()).rejects.toThrow(
      'Unsupported ChurnKey offer'
    )
    await expect(config.handleRebate()).rejects.toThrow(
      'Unsupported ChurnKey offer'
    )

    config.onClose({ aborted: true })
    await expect(showPromise).resolves.toEqual({ aborted: true })
    expect(mocks.clearState).toHaveBeenCalledOnce()
  })

  it('does not request a session when the app ID is empty', async () => {
    mocks.appId = ''

    await expect(prepareChurnkey()).resolves.toBeNull()
    expect(mocks.getChurnkeyAuth).not.toHaveBeenCalled()
    expect(mocks.init).not.toHaveBeenCalled()
  })

  it('rejects once when embed cleanup fails during an error', async () => {
    const session = await prepareChurnkey()
    if (!session) throw new Error('Expected a Churnkey session')

    mocks.hide.mockImplementation(() => {
      throw new Error('hide failed')
    })
    mocks.clearState.mockImplementation(() => {
      throw new Error('clear failed')
    })
    const showPromise = session.show({ handleCancel: vi.fn() })
    const config = capturedConfig()
    config.onError('No active subscription', 'cancel_flow')
    config.onClose({ aborted: true })

    expect(mocks.hide).toHaveBeenCalledOnce()
    expect(mocks.clearState).not.toHaveBeenCalled()
    await expect(showPromise).rejects.toThrow(
      'No active subscription (cancel_flow)'
    )
    expect(mocks.clearState).toHaveBeenCalledOnce()
  })

  it('does not load the embed when backend credentials are unavailable', async () => {
    mocks.getChurnkeyAuth.mockResolvedValue(null)

    await expect(prepareChurnkey()).resolves.toBeNull()
    expect(mocks.init).not.toHaveBeenCalled()
  })

  it('cleans up when ChurnKey initialization throws synchronously', async () => {
    const session = await prepareChurnkey()
    if (!session) throw new Error('Expected a Churnkey session')
    mocks.init.mockImplementation(() => {
      throw new Error('init failed')
    })

    await expect(session.show({ handleCancel: vi.fn() })).rejects.toThrow(
      'init failed'
    )
    expect(mocks.hide).toHaveBeenCalledOnce()
    expect(mocks.clearState).toHaveBeenCalledOnce()
  })
})
