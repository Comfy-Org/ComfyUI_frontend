import type { ChurnkeyAuthResponse } from '@comfyorg/ingest-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

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
    const unsupportedHandlers = [
      config.handlePause,
      config.handleDiscount,
      config.handleTrialExtension,
      config.handlePlanChange,
      config.handleRebate,
      config.handleRedirect
    ]
    for (const handler of unsupportedHandlers) {
      await expect(handler()).rejects.toThrow(
        'subscription.cancelDialog.offerUnavailable'
      )
    }

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

  it('settles when closed without requesting cancellation', async () => {
    const session = await prepareChurnkey()
    if (!session) throw new Error('Expected a Churnkey session')
    const handleCancel = vi.fn()

    const showPromise = session.show({ handleCancel })
    capturedConfig().onClose({ aborted: true })

    await expect(showPromise).resolves.toEqual({ aborted: true })
    expect(handleCancel).not.toHaveBeenCalled()
    expect(mocks.clearState).toHaveBeenCalledOnce()
  })

  it('waits for an in-flight cancellation before settling close', async () => {
    let rejectCancellation: ((reason: Error) => void) | undefined
    const cancellation = new Promise<never>((_resolve, reject) => {
      rejectCancellation = reject
    })
    const session = await prepareChurnkey()
    if (!session) throw new Error('Expected a Churnkey session')

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
    if (!session) throw new Error('Expected a Churnkey session')

    const showPromise = session.show({ handleCancel: vi.fn() })
    capturedConfig().onError('provider failed')

    expect(mocks.hide).toHaveBeenCalledOnce()
    expect(mocks.clearState).not.toHaveBeenCalled()
    await expect(showPromise).rejects.toThrow('provider failed')
    expect(mocks.clearState).toHaveBeenCalledOnce()
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
