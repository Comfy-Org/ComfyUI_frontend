import type {
  ChurnkeyAuthResponse,
  ChurnkeyFlowResponse
} from '@comfyorg/ingest-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChurnkeyInitConfig } from './types'

const mocks = vi.hoisted(() => ({
  appId: 'app_test',
  getChurnkeyAuth: vi.fn(),
  prepareChurnkeyFlow: vi.fn(),
  acceptChurnkeyRetention: vi.fn(),
  recordChurnkeyFlowEvent: vi.fn(),
  init: vi.fn(),
  hide: vi.fn(),
  clearState: vi.fn()
}))

vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({
    flags: {
      get churnkeyAppId() {
        return mocks.appId
      }
    }
  })
}))

vi.mock(import('@/i18n'), () => ({ t: (key: string) => key }))

vi.mock<unknown>(import('@/platform/workspace/api/workspaceApi'), () => ({
  WorkspaceApiError: class extends Error {
    constructor(
      message: string,
      public status?: number,
      public code?: string
    ) {
      super(message)
    }
  },
  workspaceApi: {
    getChurnkeyAuth: mocks.getChurnkeyAuth,
    prepareChurnkeyFlow: mocks.prepareChurnkeyFlow,
    acceptChurnkeyRetention: mocks.acceptChurnkeyRetention,
    recordChurnkeyFlowEvent: mocks.recordChurnkeyFlowEvent
  }
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { prepareChurnkey } from './churnkeyClient'

type Operation = Awaited<
  ReturnType<ReturnType<typeof useBillingOperationStore>['startOperation']>
>

function operationResult(status: Operation['status'] = 'succeeded'): Operation {
  return {
    opId: 'op-1',
    type: 'retention',
    status,
    errorMessage: null,
    startedAt: Date.now(),
    operationStartedAt: Date.now(),
    actionUrl: null,
    authenticationState: null,
    isAuthenticating: false,
    canRetryAuthentication: false,
    authenticationRequiredSeen: false,
    workspaceId: 'ws-1',
    autoHandleRequiresAction: false,
    phase: null,
    dismissed: false
  }
}

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
    mocks.appId = 'app_test'
    mocks.prepareChurnkeyFlow.mockRejectedValue(
      new WorkspaceApiError('off', 503, 'CHURNKEY_NOT_CONFIGURED')
    )
    mocks.recordChurnkeyFlowEvent.mockResolvedValue(undefined)
    mocks.acceptChurnkeyRetention.mockResolvedValue({
      billing_op_id: 'op-1',
      status: 'pending'
    })
    vi.mocked(useBillingOperationStore().startOperation).mockResolvedValue(
      operationResult()
    )
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
    if (config.provider !== 'stripe') throw new Error('Expected Stripe')
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
    await expect(showPromise).resolves.toEqual({
      aborted: false,
      outcome: 'canceled'
    })
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

function flowResponse(
  variant: 'control' | 'treatment' = 'treatment'
): ChurnkeyFlowResponse {
  return {
    app_id: 'direct-app',
    customer_id: 'ws-1',
    auth_hash: 'direct-signature',
    mode: 'test',
    session_id: 'e1165414-a774-408b-ab64-23b01d7e636a',
    expires_at: Math.floor(Date.now() / 1000) + 600,
    experiment_variant: variant,
    ...(variant === 'treatment'
      ? ({
          allowed_offer: {
            id: 'save_30_next_3_v1',
            percent_off: 30,
            renewals: 3
          }
        } as const)
      : {}),
    subscription: {
      id: 'sub-1',
      price_id: 'price-1',
      started_at: 1700000000,
      unit_amount: 3500,
      currency: 'usd',
      quantity: 1,
      period_start: 1800000000,
      period_end: 1802600000,
      interval: 'month',
      interval_count: 1
    }
  }
}

const fixedCoupon = {
  percentOff: 30,
  duration: 'repeating',
  durationInMonths: 3
}

async function directSession(flow = flowResponse()) {
  mocks.prepareChurnkeyFlow.mockResolvedValue(flow)
  const session = await prepareChurnkey()
  if (!session) throw new Error('Expected session')
  const handleCancel = vi.fn().mockResolvedValue({})
  const current = { value: true }
  const shown = session.show({
    handleCancel,
    workspaceId: 'ws-1',
    isWorkspaceCurrent: () => current.value
  })
  const config = capturedConfig()
  if (config.provider !== 'direct') throw new Error('Expected Direct')
  return { config, shown, handleCancel, current }
}

describe('Cloud-authorized retention', () => {
  beforeEach(() => {
    mocks.appId = 'app_test'
    mocks.recordChurnkeyFlowEvent.mockResolvedValue(undefined)
    mocks.acceptChurnkeyRetention.mockResolvedValue({
      billing_op_id: 'op-1',
      status: 'pending'
    })
    vi.mocked(useBillingOperationStore().startOperation).mockResolvedValue(
      operationResult()
    )
    window.churnkey = {
      init: mocks.init,
      hide: mocks.hide,
      clearState: mocks.clearState
    }
  })

  it.for(['control', 'treatment'] as const)(
    'records participation for %s and only treatment offer exposure',
    async (variant) => {
      const { config, shown } = await directSession(flowResponse(variant))
      expect(config.customer.id).toBe('ws-1')
      expect(config.subscriptions[0].id).toBe('sub-1')
      expect(config).not.toHaveProperty('handlePause')
      expect(config.handleDiscount === undefined).toBe(variant === 'control')
      expect(mocks.getChurnkeyAuth).not.toHaveBeenCalled()
      config.onStepChange({ stepType: 'SURVEY' })
      config.onStepChange({
        stepType: 'OFFER',
        offer: { offerType: 'DISCOUNT' }
      })
      config.onStepChange({
        stepType: 'OFFER',
        offer: { offerType: 'DISCOUNT' }
      })
      expect(
        mocks.recordChurnkeyFlowEvent.mock.calls.map(([event]) => event.event)
      ).toEqual(
        variant === 'control' ? ['flow_opened'] : ['flow_opened', 'offer_shown']
      )
      config.onClose({ aborted: true })
      await shown
    }
  )

  it('waits for durable success despite close or vendor error and deduplicates acceptance', async () => {
    let complete: ((value: Operation) => void) | undefined
    vi.mocked(useBillingOperationStore().startOperation).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve
      })
    )
    const { config, shown, handleCancel } = await directSession()
    const accepted = config.handleDiscount?.({}, fixedCoupon)
    expect(config.handleDiscount?.({}, fixedCoupon)).toBe(accepted)
    await vi.waitFor(() =>
      expect(
        vi.mocked(useBillingOperationStore().startOperation)
      ).toHaveBeenCalledOnce()
    )
    await expect(config.handleCancel({})).rejects.toThrow('retentionBusy')
    config.onError('vendor closed while saving')
    config.onClose({ aborted: true })
    expect(mocks.clearState).not.toHaveBeenCalled()
    complete?.(operationResult())
    await expect(accepted).resolves.toEqual({
      message: 'subscription.cancelDialog.retentionSuccess'
    })
    await expect(shown).resolves.toEqual({
      outcome: 'retained',
      aborted: false
    })
    expect(mocks.acceptChurnkeyRetention).toHaveBeenCalledExactlyOnceWith(
      flowResponse().session_id
    )
    expect(
      vi.mocked(useBillingOperationStore().startOperation)
    ).toHaveBeenCalledWith('op-1', 'retention', {
      workspaceId: 'ws-1',
      suppressProcessingToast: true
    })
    expect(handleCancel).not.toHaveBeenCalled()
    expect(mocks.clearState).toHaveBeenCalledOnce()
  })

  it('rejects stale workspaces and tampered vendor coupons before a billing write', async () => {
    const { config, shown, current } = await directSession()
    await expect(
      config.handleDiscount?.({}, { ...fixedCoupon, percentOff: 50 })
    ).rejects.toThrow('offerUnavailable')
    current.value = false
    await expect(config.handleDiscount?.({}, fixedCoupon)).rejects.toThrow(
      'workspaceChanged'
    )
    expect(mocks.acceptChurnkeyRetention).not.toHaveBeenCalled()
    config.onClose({})
    await expect(shown).rejects.toThrow('workspaceChanged')
  })

  it('allows a separate explicit cancellation after a rejected discount', async () => {
    mocks.acceptChurnkeyRetention.mockRejectedValue(
      new Error('offer unavailable')
    )
    const { config, shown, handleCancel } = await directSession()
    await expect(config.handleDiscount?.({}, fixedCoupon)).rejects.toThrow(
      'offer unavailable'
    )
    expect(handleCancel).not.toHaveBeenCalled()
    await config.handleCancel({})
    config.onClose({})
    await expect(shown).resolves.toMatchObject({ outcome: 'canceled' })
    expect(handleCancel).toHaveBeenCalledOnce()
  })

  it('does not claim success when billing requires reconciliation', async () => {
    vi.mocked(useBillingOperationStore().startOperation).mockResolvedValue(
      operationResult('reconciliation_needed')
    )
    const { config, shown, handleCancel } = await directSession()
    await expect(config.handleDiscount?.({}, fixedCoupon)).rejects.toThrow(
      'retentionPending'
    )
    config.onClose({})
    await expect(shown).rejects.toThrow('retentionPending')
    expect(handleCancel).not.toHaveBeenCalled()
  })

  it('keeps the native credential fallback limited to an unavailable route or disabled rollout', async () => {
    mocks.prepareChurnkeyFlow.mockRejectedValue(
      new WorkspaceApiError('server error', 500)
    )
    await expect(prepareChurnkey()).rejects.toThrow('server error')
    expect(mocks.getChurnkeyAuth).not.toHaveBeenCalled()
  })
})
