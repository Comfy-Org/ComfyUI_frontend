import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChurnkeyAuthUnavailableError, ChurnkeyEmbedLoadError } from './errors'

const mocks = vi.hoisted(() => ({
  fetchStatus: vi.fn(),
  cancelSubscription: vi.fn(),
  trackCancellationFlowOpened: vi.fn(),
  trackCancellationFlowClosed: vi.fn(),
  trackMonthlySubscriptionCancelled: vi.fn(),
  toastAdd: vi.fn(),
  prepareChurnkey: vi.fn(),
  show: vi.fn(),
  billingType: { value: 'workspace' as 'legacy' | 'workspace' },
  subscription: {
    value: null as {
      tier: string | null
      duration: string | null
      planSlug: string | null
    } | null
  }
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mocks.toastAdd })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    type: {
      get value() {
        return mocks.billingType.value
      }
    },
    fetchStatus: mocks.fetchStatus,
    cancelSubscription: mocks.cancelSubscription,
    subscription: {
      get value() {
        return mocks.subscription.value
      }
    }
  })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackCancellationFlowOpened: mocks.trackCancellationFlowOpened,
    trackCancellationFlowClosed: mocks.trackCancellationFlowClosed,
    trackMonthlySubscriptionCancelled: mocks.trackMonthlySubscriptionCancelled
  })
}))

vi.mock('./churnkeyClient', () => ({
  prepareChurnkey: mocks.prepareChurnkey
}))

const { launchChurnkeyCancellation } =
  await import('./launchChurnkeyCancellation')

interface CapturedShowOptions {
  customerAttributes?: Record<string, string>
  handleCancel?: () => Promise<{ message?: string }>
  onCancel: (surveyResponse: string) => void
}

type SessionResults = Record<string, unknown>

/**
 * Mirrors the real client contract: show() captures the session callbacks
 * and resolves with the session results when the modal closes.
 */
function openDeferredSession() {
  let resolveShow!: (results: SessionResults) => void
  let rejectShow!: (err: unknown) => void
  let options: CapturedShowOptions | undefined
  mocks.show.mockImplementation((opts: CapturedShowOptions) => {
    options = opts
    return new Promise<SessionResults>((resolve, reject) => {
      resolveShow = resolve
      rejectShow = reject
    })
  })
  return {
    options: () => {
      if (!options) throw new Error('churnkey session.show was not called')
      return options
    },
    close: (results: SessionResults) => resolveShow(results),
    fail: (err: unknown) => rejectShow(err)
  }
}

async function waitForShow() {
  await vi.waitFor(() => expect(mocks.show).toHaveBeenCalled())
}

describe('launchChurnkeyCancellation', () => {
  beforeEach(() => {
    mocks.billingType.value = 'workspace'
    mocks.subscription.value = null
    mocks.prepareChurnkey.mockReset()
    mocks.prepareChurnkey.mockResolvedValue({ show: mocks.show })
    mocks.show.mockReset()
    mocks.show.mockResolvedValue({ status: 'closed' })
    mocks.fetchStatus.mockReset()
    mocks.fetchStatus.mockResolvedValue(undefined)
    mocks.cancelSubscription.mockReset()
    mocks.cancelSubscription.mockResolvedValue(undefined)
    mocks.trackCancellationFlowOpened.mockReset()
    mocks.trackCancellationFlowClosed.mockReset()
    mocks.trackMonthlySubscriptionCancelled.mockReset()
    mocks.toastAdd.mockReset()
  })

  it('emits exactly one cancellation_flow_closed when the user cancels', async () => {
    const session = openDeferredSession()
    const launch = launchChurnkeyCancellation()
    await waitForShow()

    session.options().onCancel('too_expensive')
    session.close({ status: 'canceled' })
    await launch

    expect(mocks.trackCancellationFlowClosed).toHaveBeenCalledTimes(1)
    expect(mocks.trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'canceled',
      survey_response: 'too_expensive'
    })
    expect(mocks.trackMonthlySubscriptionCancelled).toHaveBeenCalledTimes(1)
  })

  it('tracks opened once per session, after preparation succeeds', async () => {
    await launchChurnkeyCancellation()

    expect(mocks.trackCancellationFlowOpened).toHaveBeenCalledTimes(1)
    const prepareOrder = mocks.prepareChurnkey.mock.invocationCallOrder[0]
    const openedOrder =
      mocks.trackCancellationFlowOpened.mock.invocationCallOrder[0]
    const showOrder = mocks.show.mock.invocationCallOrder[0]
    expect(prepareOrder).toBeLessThan(openedOrder)
    expect(openedOrder).toBeLessThan(showOrder)
  })

  it('passes handleCancel and calls billing.cancelSubscription for workspace billing', async () => {
    mocks.billingType.value = 'workspace'
    const session = openDeferredSession()
    const launch = launchChurnkeyCancellation()
    await waitForShow()

    const handleCancel = session.options().handleCancel
    expect(handleCancel).toBeTypeOf('function')
    await expect(handleCancel?.()).resolves.toEqual({
      message: 'subscription.cancelSuccess'
    })
    expect(mocks.cancelSubscription).toHaveBeenCalledTimes(1)

    session.close({ status: 'canceled' })
    await launch
  })

  it('omits handleCancel for legacy billing so Churnkey cancels via Stripe', async () => {
    mocks.billingType.value = 'legacy'
    const session = openDeferredSession()
    const launch = launchChurnkeyCancellation()
    await waitForShow()

    expect(session.options().handleCancel).toBeUndefined()
    expect(mocks.cancelSubscription).not.toHaveBeenCalled()

    session.close({ status: 'closed' })
    await launch
  })

  it('rejects handleCancel with the API error message and records cancel_api_failed on close', async () => {
    const apiError = new Error('card declined')
    mocks.cancelSubscription.mockRejectedValue(apiError)
    const session = openDeferredSession()
    const launch = launchChurnkeyCancellation()
    await waitForShow()

    // Churnkey shows this rejection message in its own UI.
    await expect(session.options().handleCancel?.()).rejects.toMatchObject({
      message: 'card declined',
      cause: apiError
    })

    session.close({ status: 'closed' })
    await launch

    expect(mocks.trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'unknown',
      failure_reason: 'cancel_api_failed'
    })
  })

  it('clears the cancel_api_failed flag when a retry succeeds', async () => {
    mocks.cancelSubscription
      .mockRejectedValueOnce(new Error('card declined'))
      .mockResolvedValueOnce(undefined)
    const session = openDeferredSession()
    const launch = launchChurnkeyCancellation()
    await waitForShow()

    const handleCancel = session.options().handleCancel
    await expect(handleCancel?.()).rejects.toThrow('card declined')
    await expect(handleCancel?.()).resolves.toEqual({
      message: 'subscription.cancelSuccess'
    })

    session.options().onCancel('too_expensive')
    session.close({ status: 'canceled' })
    await launch

    expect(mocks.trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'canceled',
      survey_response: 'too_expensive'
    })
  })

  it('refreshes local billing state after a cancel', async () => {
    const session = openDeferredSession()
    const launch = launchChurnkeyCancellation()
    await waitForShow()

    session.options().onCancel('too_expensive')
    session.close({ status: 'canceled' })
    await launch

    await vi.waitFor(() => expect(mocks.fetchStatus).toHaveBeenCalledTimes(1))
  })

  it('does not refresh local state when the user closes without canceling', async () => {
    await launchChurnkeyCancellation()

    expect(mocks.fetchStatus).not.toHaveBeenCalled()
  })

  it('records reconsidered when the user closes without canceling', async () => {
    await launchChurnkeyCancellation()

    expect(mocks.trackCancellationFlowClosed).toHaveBeenCalledTimes(1)
    expect(mocks.trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'reconsidered'
    })
  })

  it('maps Churnkey discounted status to discounted outcome', async () => {
    mocks.show.mockResolvedValue({ status: 'discounted' })

    await launchChurnkeyCancellation()

    expect(mocks.trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'discounted'
    })
  })

  it('maps Churnkey paused status to paused outcome', async () => {
    mocks.show.mockResolvedValue({ status: 'paused' })

    await launchChurnkeyCancellation()

    expect(mocks.trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'paused'
    })
  })

  it('swallows fetchStatus failures after the cancel', async () => {
    mocks.fetchStatus.mockRejectedValue(new Error('network'))
    const session = openDeferredSession()
    const launch = launchChurnkeyCancellation()
    await waitForShow()

    session.options().onCancel('too_expensive')
    session.close({ status: 'canceled' })

    await expect(launch).resolves.toBeUndefined()
    await vi.waitFor(() => expect(mocks.fetchStatus).toHaveBeenCalledTimes(1))
    expect(mocks.trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'canceled',
      survey_response: 'too_expensive'
    })
  })

  it('forwards customerAttributes from billing subscription', async () => {
    mocks.subscription.value = {
      tier: 'PRO',
      duration: 'MONTHLY',
      planSlug: 'pro-monthly'
    }

    await launchChurnkeyCancellation()

    expect(mocks.show.mock.calls[0][0].customerAttributes).toEqual({
      tier: 'PRO',
      cycle: 'MONTHLY',
      plan_slug: 'pro-monthly'
    })
  })

  it('omits customerAttributes when subscription is null', async () => {
    await launchChurnkeyCancellation()

    expect(mocks.show.mock.calls[0][0].customerAttributes).toBeUndefined()
  })

  it('re-throws ChurnkeyAuthUnavailableError without toast or telemetry', async () => {
    mocks.prepareChurnkey.mockRejectedValue(new ChurnkeyAuthUnavailableError())

    await expect(launchChurnkeyCancellation()).rejects.toBeInstanceOf(
      ChurnkeyAuthUnavailableError
    )
    expect(mocks.toastAdd).not.toHaveBeenCalled()
    expect(mocks.trackCancellationFlowOpened).not.toHaveBeenCalled()
    expect(mocks.trackCancellationFlowClosed).not.toHaveBeenCalled()
  })

  it('re-throws ChurnkeyEmbedLoadError without toast or telemetry', async () => {
    mocks.prepareChurnkey.mockRejectedValue(new ChurnkeyEmbedLoadError())

    await expect(launchChurnkeyCancellation()).rejects.toBeInstanceOf(
      ChurnkeyEmbedLoadError
    )
    expect(mocks.toastAdd).not.toHaveBeenCalled()
    expect(mocks.trackCancellationFlowOpened).not.toHaveBeenCalled()
    expect(mocks.trackCancellationFlowClosed).not.toHaveBeenCalled()
  })

  it('shows a toast without telemetry when preparation fails unexpectedly', async () => {
    mocks.prepareChurnkey.mockRejectedValue(new Error('auth endpoint 500'))

    await expect(launchChurnkeyCancellation()).resolves.toBeUndefined()

    expect(mocks.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'auth endpoint 500'
      })
    )
    expect(mocks.trackCancellationFlowOpened).not.toHaveBeenCalled()
    expect(mocks.trackCancellationFlowClosed).not.toHaveBeenCalled()
  })

  it('shows a toast and a balancing closed event when the session fails after opening', async () => {
    const session = openDeferredSession()
    const launch = launchChurnkeyCancellation()
    await waitForShow()

    session.fail(new Error('init exploded'))
    await launch

    expect(mocks.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'init exploded'
      })
    )
    expect(mocks.trackCancellationFlowOpened).toHaveBeenCalledTimes(1)
    expect(mocks.trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'unknown',
      failure_reason: 'unexpected'
    })
  })

  it('ignores concurrent calls while the session is open', async () => {
    const session = openDeferredSession()
    const first = launchChurnkeyCancellation()
    await waitForShow()

    await launchChurnkeyCancellation()
    expect(mocks.prepareChurnkey).toHaveBeenCalledTimes(1)
    expect(mocks.trackCancellationFlowOpened).toHaveBeenCalledTimes(1)

    session.close({ status: 'closed' })
    await first

    // Guard released on close; a fresh launch proceeds.
    mocks.show.mockReset()
    mocks.show.mockResolvedValue({ status: 'closed' })
    await launchChurnkeyCancellation()
    expect(mocks.prepareChurnkey).toHaveBeenCalledTimes(2)
  })

  it('releases the in-flight guard when preparation fails', async () => {
    mocks.prepareChurnkey.mockRejectedValueOnce(new Error('boom'))
    await launchChurnkeyCancellation()

    await launchChurnkeyCancellation()
    expect(mocks.prepareChurnkey).toHaveBeenCalledTimes(2)
  })
})
