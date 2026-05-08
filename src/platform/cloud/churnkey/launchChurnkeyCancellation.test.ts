import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cancelSubscription = vi.fn()
const fetchStatus = vi.fn()
const trackCancellationFlowOpened = vi.fn()
const trackCancellationFlowClosed = vi.fn()
const trackCancellationReconsidered = vi.fn()
const trackMonthlySubscriptionCancelled = vi.fn()
const toastAdd = vi.fn()
const churnkeyShow = vi.fn()
const isConfiguredRef = { value: true }

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: toastAdd })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    cancelSubscription,
    fetchStatus
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

vi.mock('./useChurnkey', () => ({
  useChurnkey: () => ({
    get isConfigured() {
      return isConfiguredRef.value
    },
    show: churnkeyShow
  })
}))

const { launchChurnkeyCancellation } =
  await import('./launchChurnkeyCancellation')

interface CapturedHandlers {
  handleCancel: () => Promise<{ message?: string }>
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
    churnkeyShow.mockReset()
    churnkeyShow.mockResolvedValue(undefined)
    cancelSubscription.mockReset()
    fetchStatus.mockReset()
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

    await handlers.handleCancel()
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

  it('records reconsidered when the user closes without canceling', async () => {
    await launchChurnkeyCancellation()
    const handlers = captureHandlers()

    handlers.onClose({ status: 'closed' })

    expect(trackCancellationFlowClosed).toHaveBeenCalledTimes(1)
    expect(trackCancellationFlowClosed).toHaveBeenCalledWith({
      outcome: 'reconsidered',
      survey_response: undefined
    })
    expect(trackCancellationReconsidered).toHaveBeenCalledTimes(1)
  })

  it('throws when churnkey is not configured', async () => {
    isConfiguredRef.value = false
    await expect(launchChurnkeyCancellation()).rejects.toThrow(
      'Churnkey is not configured'
    )
    expect(churnkeyShow).not.toHaveBeenCalled()
  })

  it('shows a toast and resolves when show() rejects', async () => {
    churnkeyShow.mockRejectedValue(new Error('embed failed'))

    await expect(launchChurnkeyCancellation()).resolves.toBeUndefined()

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'embed failed'
      })
    )
  })
})
