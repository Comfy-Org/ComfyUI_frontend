import type { ChurnkeyAuthResponse } from '@comfyorg/ingest-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

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

import {
  isChurnkeySessionTimeoutError,
  isUnsupportedChurnkeyOfferError,
  prepareChurnkey
} from './churnkeyClient'

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
      record: false,
      i18n: {
        lang: String(i18n.global.locale.value)
      },
      customerAttributes: { tier: 'PRO' }
    })
    expect(config).not.toHaveProperty('customer')
    expect(config).not.toHaveProperty('subscriptions')

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
    await expect(config.handleRedirect()).rejects.toThrow(
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

  it('waits for pending cancellation before closing the session', async () => {
    const session = await prepareChurnkey()
    if (!session) throw new Error('Expected a Churnkey session')

    let finishCancellation: (() => void) | undefined
    const cancellation = new Promise<{ message: string }>((resolve) => {
      finishCancellation = () => resolve({ message: 'Canceled' })
    })
    const showPromise = session.show({
      handleCancel: vi.fn().mockReturnValue(cancellation)
    })
    const config = capturedConfig()

    const handlerPromise = config.handleCancel({ id: 'cus_test_1' })
    config.onClose({ canceled: true })
    await Promise.resolve()

    expect(mocks.clearState).not.toHaveBeenCalled()
    const resolveCancellation = finishCancellation
    if (!resolveCancellation) throw new Error('Expected cancellation to start')
    resolveCancellation()

    await expect(handlerPromise).resolves.toEqual({ message: 'Canceled' })
    await expect(showPromise).resolves.toEqual({ canceled: true })
    expect(mocks.clearState).toHaveBeenCalledOnce()
  })

  it('waits for pending cancellation before reporting a provider error', async () => {
    const session = await prepareChurnkey()
    if (!session) throw new Error('Expected a Churnkey session')

    let finishCancellation: (() => void) | undefined
    const cancellation = new Promise<{ message: string }>((resolve) => {
      finishCancellation = () => resolve({ message: 'Canceled' })
    })
    const showPromise = session.show({
      handleCancel: vi.fn().mockReturnValue(cancellation)
    })
    const config = capturedConfig()

    const handlerPromise = config.handleCancel({ id: 'cus_test_1' })
    config.onError('Provider failed')
    await Promise.resolve()

    expect(mocks.hide).toHaveBeenCalledOnce()
    expect(mocks.clearState).not.toHaveBeenCalled()
    const resolveCancellation = finishCancellation
    if (!resolveCancellation) throw new Error('Expected cancellation to start')
    resolveCancellation()

    await expect(handlerPromise).resolves.toEqual({ message: 'Canceled' })
    await expect(showPromise).rejects.toThrow('Provider failed')
    expect(mocks.clearState).toHaveBeenCalledOnce()
  })

  it('rejects and cleans up when cancellation outlives the session', async () => {
    const session = await prepareChurnkey()
    if (!session) throw new Error('Expected a Churnkey session')

    vi.useFakeTimers()
    try {
      const showPromise = session.show({
        handleCancel: vi.fn(() => new Promise<never>(() => undefined))
      })
      const config = capturedConfig()
      const timeoutResult = showPromise.catch((error: unknown) => error)
      void config.handleCancel({ id: 'cus_test_1' })

      await vi.runOnlyPendingTimersAsync()

      expect(isChurnkeySessionTimeoutError(await timeoutResult)).toBe(true)
      expect(mocks.hide).toHaveBeenCalledOnce()
      expect(mocks.clearState).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('identifies an unsupported offer when ChurnKey reports its failure', async () => {
    const session = await prepareChurnkey()
    if (!session) throw new Error('Expected a Churnkey session')

    const showPromise = session.show({ handleCancel: vi.fn() })
    const config = capturedConfig()
    const offerError = await config
      .handleRedirect()
      .catch((error: unknown) => error)
    config.onError('Handler rejected', 'redirect')

    await expect(showPromise).rejects.toSatisfy(isUnsupportedChurnkeyOfferError)
    expect(isUnsupportedChurnkeyOfferError(offerError)).toBe(true)
  })

  it('does not load the embed when backend credentials are unavailable', async () => {
    mocks.getChurnkeyAuth.mockResolvedValue(null)

    await expect(prepareChurnkey()).resolves.toBeNull()
    expect(mocks.init).not.toHaveBeenCalled()
  })

  it('loads the configured embed and surfaces script failures', async () => {
    mocks.appId = 'app_load_failure'
    window.churnkey = undefined

    const appendedScript = {
      value: null as HTMLScriptElement | null
    }
    const appendChild = vi
      .spyOn(document.head, 'appendChild')
      .mockImplementation((node) => {
        if (!(node instanceof HTMLScriptElement)) {
          throw new Error('Expected the ChurnKey script element')
        }
        appendedScript.value = node
        return node
      })

    try {
      const preparation = prepareChurnkey()
      const loadFailure = preparation.catch((error: unknown) => error)
      await vi.waitFor(() => expect(appendedScript.value).not.toBeNull())

      expect(window.churnkey).toEqual({ created: true })
      expect(
        new URL(appendedScript.value?.src ?? '').searchParams.get('appId')
      ).toBe('app_load_failure')
      appendedScript.value?.dispatchEvent(new Event('error'))

      expect(await loadFailure).toEqual(
        new Error(
          'Script failed to load: https://assets.churnkey.co/js/app.js?appId=app_load_failure'
        )
      )
      expect(appendedScript.value?.isConnected).toBe(false)
    } finally {
      appendChild.mockRestore()
    }
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
