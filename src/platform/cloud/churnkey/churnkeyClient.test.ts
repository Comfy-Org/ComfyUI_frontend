import type { ChurnkeyAuthResponse } from '@comfyorg/ingest-types'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { reportError } from '@/platform/telemetry/reportError'
import type { ChurnkeyInitConfig } from './types'

const mocks = vi.hoisted(() => ({
  getChurnkeyAuth: vi.fn(),
  init: vi.fn(),
  hide: vi.fn(),
  clearState: vi.fn()
}))

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/i18n'), () => ({ t: (key: string) => key }))

vi.mock<unknown>(import('@/platform/workspace/api/workspaceApi'), () => ({
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
    vi.mocked(useFeatureFlags().flags).churnkeyAppId = 'app_test'
    mocks.getChurnkeyAuth.mockResolvedValue(authResponse())
    window.churnkey = {
      init: mocks.init,
      hide: mocks.hide,
      clearState: mocks.clearState
    }
  })

  it('builds a Stripe-provider session from backend credentials', async () => {
    const session = await prepareChurnkey()
    assert.exists(session)

    const handleCancel = vi.fn().mockResolvedValue({ message: 'Canceled' })
    const showPromise = session.show({
      handleCancel
    })

    expect(mocks.init).toHaveBeenCalledExactlyOnceWith(
      'show',
      expect.objectContaining({
        appId: 'app_test',
        authHash: 'signed-hash',
        customerId: 'cus_test_1',
        provider: 'stripe',
        mode: 'test'
      })
    )

    const config = capturedConfig()
    expect(config).not.toHaveProperty('customer')
    expect(config).not.toHaveProperty('subscriptions')
    expect(config).not.toHaveProperty('record')

    await expect(
      config.handleCancel({ id: 'cus_test_1' }, 'Too expensive', 'Feedback')
    ).resolves.toEqual({ message: 'Canceled' })
    expect(handleCancel).toHaveBeenCalledWith('Too expensive', 'Feedback')

    config.onClose({ aborted: true })
    await expect(showPromise).resolves.toEqual({ type: 'abandoned' })
    expect(mocks.clearState).toHaveBeenCalledOnce()
  })

  it.for([
    'handlePause',
    'handleDiscount',
    'handleTrialExtension',
    'handlePlanChange',
    'handleRebate',
    'handleRedirect'
  ] as const)('keeps %s blocked by default', async (handler) => {
    const session = await prepareChurnkey()
    assert.exists(session)
    const showPromise = session.show({ handleCancel: vi.fn() })

    await expect(capturedConfig()[handler]?.()).rejects.toThrow(
      'subscription.cancelDialog.offerUnavailable'
    )

    capturedConfig().onClose({ aborted: true })
    await showPromise
  })

  it.for(['live', 'sandbox'] as const)(
    'does not enable a native discount in %s mode',
    async (mode) => {
      mocks.getChurnkeyAuth.mockResolvedValue({
        ...authResponse(),
        mode,
        test_discount_subscription_id: 'sub_test_1'
      })
      const session = await prepareChurnkey()
      assert.exists(session)
      const showPromise = session.show({ handleCancel: vi.fn() })

      expect(capturedConfig().subscriptionId).toBeUndefined()
      expect(capturedConfig().onDiscount).toBeUndefined()
      await expect(capturedConfig().handleDiscount?.()).rejects.toThrow(
        'subscription.cancelDialog.offerUnavailable'
      )
      capturedConfig().onClose({ aborted: true })
      await showPromise
    }
  )

  it.for([
    { ending: 'close', reports: [] },
    {
      ending: 'error',
      reports: [
        [
          new Error('display failed after success (display)'),
          { errorType: 'error_displaying_churnkey_after_discount' }
        ]
      ]
    }
  ] as const)(
    'preserves a confirmed native discount on subsequent $ending',
    async ({ ending, reports }) => {
      mocks.getChurnkeyAuth.mockResolvedValue({
        ...authResponse(),
        test_discount_subscription_id: 'sub_test_1'
      })
      const session = await prepareChurnkey()
      assert.exists(session)
      const handleCancel = vi.fn()
      const showPromise = session.show({ handleCancel })
      const config = capturedConfig()

      expect(config.subscriptionId).toBe('sub_test_1')
      expect(config).not.toHaveProperty('handleDiscount')
      await expect(config.handlePause()).rejects.toThrow(
        'subscription.cancelDialog.offerUnavailable'
      )
      config.onDiscount?.({}, {})
      const end = {
        close: () => config.onClose({ aborted: true }),
        error: () => config.onError('display failed after success', 'display')
      }
      end[ending]()
      config.onError('late error')

      await expect(showPromise).resolves.toEqual({
        type: 'discount-applied'
      })
      expect(handleCancel).not.toHaveBeenCalled()
      expect(vi.mocked(reportError).mock.calls).toEqual(reports)
    }
  )

  it('requires a success notification before reporting a discount', async () => {
    mocks.getChurnkeyAuth.mockResolvedValue({
      ...authResponse(),
      test_discount_subscription_id: 'sub_test_1'
    })
    const session = await prepareChurnkey()
    assert.exists(session)
    const showPromise = session.show({ handleCancel: vi.fn() })
    const config = capturedConfig()
    const closeResults = { aborted: true, discountApplied: true }
    config.onClose(closeResults)
    config.onDiscount?.({}, {})

    await expect(showPromise).resolves.toEqual({ type: 'abandoned' })
  })

  it('reports a failed native action without claiming a discount or canceling', async () => {
    mocks.getChurnkeyAuth.mockResolvedValue({
      ...authResponse(),
      test_discount_subscription_id: 'sub_test_1'
    })
    const session = await prepareChurnkey()
    assert.exists(session)
    const handleCancel = vi.fn()
    const showPromise = session.show({ handleCancel })
    capturedConfig().onError('Stripe rejected the coupon')

    await expect(showPromise).rejects.toThrow('Stripe rejected the coupon')
    expect(handleCancel).not.toHaveBeenCalled()
  })

  it('does not request a session when the app ID is empty', async () => {
    vi.mocked(useFeatureFlags().flags).churnkeyAppId = ''

    await expect(prepareChurnkey()).resolves.toBeNull()
    expect(mocks.getChurnkeyAuth).not.toHaveBeenCalled()
    expect(mocks.init).not.toHaveBeenCalled()
  })

  it.for([
    { aborted: true, outcome: 'abandoned' },
    { aborted: false, outcome: 'completed' },
    { aborted: undefined, outcome: 'completed' }
  ] as const)(
    'normalizes close with aborted=$aborted to $outcome',
    async ({ aborted, outcome }) => {
      const session = await prepareChurnkey()
      assert.exists(session)
      const handleCancel = vi.fn()

      const showPromise = session.show({ handleCancel })
      capturedConfig().onClose({ aborted })

      await expect(showPromise).resolves.toEqual({ type: outcome })
      expect(handleCancel).not.toHaveBeenCalled()
      expect(mocks.clearState).toHaveBeenCalledOnce()
    }
  )

  it('waits for an in-flight cancellation before settling close', async () => {
    let rejectCancellation: ((reason: Error) => void) | undefined
    const cancellation = new Promise<never>((_resolve, reject) => {
      rejectCancellation = reject
    })
    const session = await prepareChurnkey()
    assert.exists(session)

    const showPromise = session.show({
      handleCancel: () => cancellation
    })
    const config = capturedConfig()
    const handlerPromise = config.handleCancel({}, null, null)
    config.onClose({ aborted: true })

    const pending = Symbol('pending')
    await expect(
      Promise.race([showPromise, Promise.resolve(pending)])
    ).resolves.toBe(pending)

    const error = new Error('cancel failed')
    void handlerPromise.catch(() => undefined)
    void showPromise.catch(() => undefined)
    rejectCancellation?.(error)

    await expect(handlerPromise).rejects.toThrow(error)
    await expect(showPromise).rejects.toThrow(error)
  })

  it('settles provider errors after the callback returns', async () => {
    const session = await prepareChurnkey()
    assert.exists(session)

    const showPromise = session.show({ handleCancel: vi.fn() })
    capturedConfig().onError('provider failed')

    expect(mocks.hide).toHaveBeenCalledOnce()
    expect(mocks.clearState).not.toHaveBeenCalled()
    await expect(showPromise).rejects.toThrow('provider failed')
    expect(mocks.clearState).toHaveBeenCalledOnce()
  })

  it('cleans up when ChurnKey initialization throws synchronously', async () => {
    const session = await prepareChurnkey()
    assert.exists(session)
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
