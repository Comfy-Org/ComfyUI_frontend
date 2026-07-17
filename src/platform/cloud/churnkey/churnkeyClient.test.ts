import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChurnkeyAuthResponse } from '@/platform/workspace/api/workspaceApi'

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
    customer_id: 'workspace-1',
    auth_hash: 'signed-hash',
    mode: 'test',
    subscription: {
      id: 'subscription-1',
      started_at: '2026-01-01T00:00:00Z',
      status: 'active',
      current_period_start: '2026-07-01T00:00:00Z',
      current_period_end: '2026-08-01T00:00:00Z',
      plan: {
        id: 'creator-monthly',
        name: 'Creator',
        amount_cents: 3500,
        currency: 'usd',
        interval: 'month',
        interval_count: 1
      },
      quantity: 1
    }
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

  it('builds a Direct-mode session from the backend snapshot', async () => {
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
      provider: 'direct',
      mode: 'test',
      customer: { id: 'workspace-1' },
      customerAttributes: { tier: 'PRO' },
      subscriptions: [
        {
          id: 'subscription-1',
          start: new Date('2026-01-01T00:00:00Z'),
          status: {
            name: 'active',
            currentPeriod: {
              start: new Date('2026-07-01T00:00:00Z'),
              end: new Date('2026-08-01T00:00:00Z')
            }
          },
          items: [
            {
              price: {
                id: 'creator-monthly',
                name: 'Creator',
                amount: { value: 3500, currency: 'usd' },
                interval: 'month',
                intervalCount: 1
              },
              quantity: 1
            }
          ]
        }
      ]
    })
    expect(config).not.toHaveProperty('record')
    expect(config).not.toHaveProperty('handlePause')
    expect(config).not.toHaveProperty('handleDiscount')

    await expect(
      config.handleCancel({ id: 'workspace-1' }, 'Too expensive', 'Feedback')
    ).resolves.toEqual({ message: 'Canceled' })
    expect(handleCancel).toHaveBeenCalledWith('Too expensive', 'Feedback')

    config.onClose({ aborted: true })
    await expect(showPromise).resolves.toEqual({ aborted: true })
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

    await expect(showPromise).rejects.toThrow(
      'No active subscription (cancel_flow)'
    )
    expect(mocks.hide).toHaveBeenCalledOnce()
    expect(mocks.clearState).toHaveBeenCalledOnce()
  })

  it('does not load the embed when backend credentials are unavailable', async () => {
    mocks.getChurnkeyAuth.mockResolvedValue(null)

    await expect(prepareChurnkey()).resolves.toBeNull()
    expect(mocks.init).not.toHaveBeenCalled()
  })

  it('rejects malformed subscription dates before showing the embed', async () => {
    const auth = authResponse()
    auth.subscription.current_period_end = 'not-a-date'
    mocks.getChurnkeyAuth.mockResolvedValue(auth)

    const session = await prepareChurnkey()
    if (!session) throw new Error('Expected a Churnkey session')

    await expect(session.show({ handleCancel: vi.fn() })).rejects.toThrow(
      'Invalid Churnkey subscription date: not-a-date'
    )
    expect(mocks.init).not.toHaveBeenCalled()
  })
})
