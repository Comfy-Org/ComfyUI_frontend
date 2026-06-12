import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchStatus = vi.fn()
const cancelSubscription = vi.fn()
const trackCancellationFlowOpened = vi.fn()
const trackCancellationFlowClosed = vi.fn()
const trackCancellationReconsidered = vi.fn()
const trackMonthlySubscriptionCancelled = vi.fn()
const toastAdd = vi.fn()
const churnkeyShow = vi.fn()
const isConfiguredRef = { value: true }
const billingTypeRef: { value: 'legacy' | 'workspace' } = { value: 'workspace' }
const subscriptionRef: {
  value: {
    tier: string | null
    duration: string | null
    planSlug: string | null
  } | null
} = { value: null }

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: toastAdd })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    type: {
      get value() {
        return billingTypeRef.value
      }
    },
    fetchStatus,
    cancelSubscription,
    subscription: {
      get value() {
        return subscriptionRef.value
      }
    }
  })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackCancellationFlowOpened,
    trackCancellationFlowClosed,
    trackCancellationReconsidered,
    trackMonthlySubscriptionCancelled
  })
}))

class FakeAuthUnavailableError extends Error {
  constructor() {
    super('Churnkey auth endpoint not available')
    this.name = 'ChurnkeyAuthUnavailableError'
  }
}

vi.mock('./useChurnkey', () => ({
  useChurnkey: () => ({
    get isConfigured() {
      return isConfiguredRef.value
    },
    show: churnkeyShow
  }),
  ChurnkeyAuthUnavailableError: FakeAuthUnavailableError
}))

const { launchChurnkeyCancellation } =
  await import('./launchChurnkeyCancellation')

interface CapturedHandlers {
  customerAttributes?: Record<string, string>
  handleCancel?: () => Promise<{ message?: string }>
  onCancel: (surveyResponse: string) => void
  onClose: (results: Record<string, unknown>) => void
}

function captureHandlers(): CapturedHandlers {
  const opts = churnkeyShow.mock.calls.at(-1)?.[0]
  if (!opts) throw new Error('churnkey.show was not called')
  return opts as CapturedHandlers
}

describe('launchChurnkeyCancellation', () => {
  beforeEach(() => {
    isConfiguredRef.value = true
    billingTypeRef.value = 'workspace'
    subscriptionRef.value = null
    churnkeyShow.mockReset()
    churnkeyShow.mockResolvedValue(undefined)
    fetchStatus.mockReset()
    fetchStatus.mockResolvedValue(undefined)
    cancelSubscription.mockReset()
    cancelSubscription.mockResolvedValue(undefined)
    trackCancellationFlowOpened.mockReset()
    trackCancellationFlowClosed.mockReset()
    trackCancellationReconsidered.mockReset()
    trackMonthlySubscriptionCancelled.mockReset()
    toastAdd.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emits exactly one cancellation_flow_closed when the user cancels', async () => {
    await launchChurnkeyCancellation()
    const handlers = captureHandlers()

    handlers.onCancel('too_expensive')
    handlers.onClose({ status: 'canceled' })

    expect(trackCancellationFlowClosed).toHaveBeenCalledTimes(1)
    expect(trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'canceled',
      survey_response: 'too_expensive'
    })
    expect(trackMonthlySubscriptionCancelled).toHaveBeenCalledTimes(1)
    expect(trackCancellationReconsidered).not.toHaveBeenCalled()
  })

  it('passes handleCancel and calls billing.cancelSubscription for workspace billing', async () => {
    billingTypeRef.value = 'workspace'
    await launchChurnkeyCancellation()
    const handlers = captureHandlers()

    expect(handlers.handleCancel).toBeTypeOf('function')
    await handlers.handleCancel?.()
    expect(cancelSubscription).toHaveBeenCalledTimes(1)
  })

  it('omits handleCancel for legacy billing so Churnkey cancels via Stripe', async () => {
    billingTypeRef.value = 'legacy'
    await launchChurnkeyCancellation()
    const handlers = captureHandlers()

    expect(handlers.handleCancel).toBeUndefined()
    expect(cancelSubscription).not.toHaveBeenCalled()
  })

  it('refreshes local billing state in onClose after a cancel', async () => {
    await launchChurnkeyCancellation()
    const handlers = captureHandlers()

    handlers.onCancel('too_expensive')
    handlers.onClose({ status: 'canceled' })
    await vi.waitFor(() => expect(fetchStatus).toHaveBeenCalledTimes(1))
  })

  it('does not refresh local state when the user closes without canceling', async () => {
    await launchChurnkeyCancellation()
    const handlers = captureHandlers()

    handlers.onClose({ status: 'closed' })
    expect(fetchStatus).not.toHaveBeenCalled()
  })

  it('records reconsidered when the user closes without canceling', async () => {
    await launchChurnkeyCancellation()
    const handlers = captureHandlers()

    handlers.onClose({ status: 'closed' })

    expect(trackCancellationFlowClosed).toHaveBeenCalledTimes(1)
    expect(trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'reconsidered'
    })
    expect(trackCancellationReconsidered).toHaveBeenCalledTimes(1)
  })

  it('maps Churnkey discounted status to discounted outcome', async () => {
    await launchChurnkeyCancellation()
    const handlers = captureHandlers()

    handlers.onClose({ status: 'discounted' })

    expect(trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'discounted'
    })
    expect(trackCancellationReconsidered).not.toHaveBeenCalled()
  })

  it('maps Churnkey paused status to paused outcome', async () => {
    await launchChurnkeyCancellation()
    const handlers = captureHandlers()

    handlers.onClose({ status: 'paused' })

    expect(trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'paused'
    })
    expect(trackCancellationReconsidered).not.toHaveBeenCalled()
  })

  it('swallows fetchStatus failures after the cancel', async () => {
    fetchStatus.mockRejectedValue(new Error('network'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await launchChurnkeyCancellation()
    const handlers = captureHandlers()

    handlers.onCancel('too_expensive')
    handlers.onClose({ status: 'canceled' })

    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
  })

  it('forwards customerAttributes from billing subscription', async () => {
    subscriptionRef.value = {
      tier: 'PRO',
      duration: 'MONTHLY',
      planSlug: 'pro-monthly'
    }

    await launchChurnkeyCancellation()
    const handlers = captureHandlers()

    expect(handlers.customerAttributes).toEqual({
      tier: 'PRO',
      cycle: 'MONTHLY',
      plan_slug: 'pro-monthly'
    })
  })

  it('omits customerAttributes when subscription is null', async () => {
    await launchChurnkeyCancellation()
    const handlers = captureHandlers()

    expect(handlers.customerAttributes).toBeUndefined()
  })

  it('throws when churnkey is not configured', async () => {
    isConfiguredRef.value = false
    await expect(launchChurnkeyCancellation()).rejects.toThrow(
      'Churnkey is not configured'
    )
    expect(churnkeyShow).not.toHaveBeenCalled()
  })

  it('re-throws ChurnkeyAuthUnavailableError and skips toast/close', async () => {
    churnkeyShow.mockRejectedValue(new FakeAuthUnavailableError())

    await expect(launchChurnkeyCancellation()).rejects.toBeInstanceOf(
      FakeAuthUnavailableError
    )
    expect(toastAdd).not.toHaveBeenCalled()
    expect(trackCancellationFlowClosed).not.toHaveBeenCalled()
  })

  it('shows a toast and emits a balancing closed event when show() rejects', async () => {
    churnkeyShow.mockRejectedValue(new Error('embed failed'))

    await expect(launchChurnkeyCancellation()).resolves.toBeUndefined()

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'embed failed'
      })
    )
    expect(trackCancellationFlowOpened).toHaveBeenCalledTimes(1)
    expect(trackCancellationFlowClosed).toHaveBeenCalledTimes(1)
    expect(trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'unknown',
      failure_reason: 'unexpected'
    })
  })

  it('tags embed-load failures with the embed_not_loaded failure_reason', async () => {
    churnkeyShow.mockRejectedValue(
      new Error('Churnkey embed script has not loaded')
    )

    await launchChurnkeyCancellation()

    expect(trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'unknown',
      failure_reason: 'embed_not_loaded'
    })
  })

  it('releases the in-flight guard via try/finally when show() rejects', async () => {
    churnkeyShow.mockRejectedValueOnce(new Error('embed failed'))
    await launchChurnkeyCancellation()

    // A fresh call after the failure should proceed (guard cleared).
    churnkeyShow.mockReset()
    churnkeyShow.mockResolvedValue(undefined)
    await launchChurnkeyCancellation()
    expect(churnkeyShow).toHaveBeenCalledTimes(1)
  })

  it('ignores concurrent calls while a session is in flight', async () => {
    let resolveShow: (() => void) | undefined
    churnkeyShow.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveShow = resolve
        })
    )

    const first = launchChurnkeyCancellation()
    await Promise.resolve()
    const second = launchChurnkeyCancellation()

    expect(churnkeyShow).toHaveBeenCalledTimes(1)
    expect(trackCancellationFlowOpened).toHaveBeenCalledTimes(1)

    resolveShow?.()
    await first
    await second

    // try/finally cleared the guard when show() resolved; a fresh call proceeds.
    churnkeyShow.mockReset()
    churnkeyShow.mockResolvedValue(undefined)
    await launchChurnkeyCancellation()
    expect(churnkeyShow).toHaveBeenCalledTimes(1)
  })
})
