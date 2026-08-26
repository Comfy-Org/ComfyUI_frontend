/**
 * showTopUpCreditsDialog routes the paired server capabilities to purchase,
 * subscription, or read-only contact-admin UI.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())
const closeDialog = vi.hoisted(() => vi.fn())
const state = vi.hoisted(() => ({
  type: 'workspace' as 'workspace' | 'legacy',
  canTopUp: true,
  canSubscribeSelfServe: false,
  isReady: true,
  initialize: vi.fn()
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog, closeDialog })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackEvent: vi.fn() })
}))

const mockIsCloud = vi.hoisted(() => ({ value: true }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    type: { value: state.type }
  })
}))

vi.mock('@/platform/workspace/composables/useBillingCapabilities', () => ({
  useBillingCapabilities: () => ({
    // Getters, not snapshots: initialize() resolves capabilities mid-call.
    canTopUp: {
      get value() {
        return state.canTopUp
      }
    },
    canSubscribeSelfServe: {
      get value() {
        return state.canSubscribeSelfServe
      }
    },
    isReady: {
      get value() {
        return state.isReady
      }
    },
    initialize: () => state.initialize()
  })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: vi.fn() })
}))

const showSubscriptionDialog = vi.hoisted(() => vi.fn())

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({ show: showSubscriptionDialog })
  })
)

import { useDialogService } from '@/services/dialogService'

describe('showTopUpCreditsDialog', () => {
  beforeEach(() => {
    state.type = 'workspace'
    state.canTopUp = true
    state.canSubscribeSelfServe = false
    state.isReady = true
    state.initialize = vi.fn()
    mockIsCloud.value = true
  })

  it('shows the purchase dialog to users who can top up', async () => {
    await useDialogService().showTopUpCreditsDialog({
      isInsufficientCredits: true
    })

    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('top-up-credits')
    expect(state.initialize).not.toHaveBeenCalled()
  })

  it('shows the contact-admin notice to team members instead of the purchase dialog', async () => {
    state.canTopUp = false
    state.canSubscribeSelfServe = false

    await useDialogService().showTopUpCreditsDialog({
      isInsufficientCredits: true
    })

    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('insufficient-credits-member')
    // The member notice draws its own header + close button, so it must open
    // headless or Reka wraps it in duplicate chrome.
    expect(args.dialogComponentProps.headless).toBe(true)
    expect(args.dialogComponentProps.renderer).toBe('reka')

    args.props.onClose()
    expect(closeDialog).toHaveBeenCalledWith({
      key: 'insufficient-credits-member'
    })
  })

  it('uses the server capability on legacy billing', async () => {
    state.type = 'legacy'
    state.canTopUp = true

    await useDialogService().showTopUpCreditsDialog()

    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('top-up-credits')
  })

  it('does not show workspace-admin copy for denied legacy billing', async () => {
    state.type = 'legacy'
    state.canTopUp = false

    await useDialogService().showTopUpCreditsDialog()

    expect(showDialog).not.toHaveBeenCalled()
    expect(showSubscriptionDialog).not.toHaveBeenCalled()
  })

  it('awaits an in-flight capability read instead of dropping the request', async () => {
    state.canTopUp = false
    state.isReady = false
    state.initialize = vi.fn(() => {
      state.canTopUp = true
      state.isReady = true
      return Promise.resolve()
    })

    await useDialogService().showTopUpCreditsDialog({
      isInsufficientCredits: true
    })

    expect(state.initialize).toHaveBeenCalledOnce()
    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('top-up-credits')
  })

  it('does not route when capabilities stay unresolved after initializing', async () => {
    state.canTopUp = false
    state.isReady = false

    await useDialogService().showTopUpCreditsDialog()

    expect(state.initialize).toHaveBeenCalledOnce()
    expect(showDialog).not.toHaveBeenCalled()
    expect(showSubscriptionDialog).not.toHaveBeenCalled()
  })

  it('routes self-serve subscribers to the subscription-required flow', async () => {
    state.canTopUp = false
    state.canSubscribeSelfServe = true

    await useDialogService().showTopUpCreditsDialog()

    expect(showSubscriptionDialog).toHaveBeenCalledWith({
      reason: 'top_up_blocked'
    })
    expect(showDialog).not.toHaveBeenCalled()
  })

  describe('non-cloud distribution', () => {
    beforeEach(() => {
      mockIsCloud.value = false
      state.type = 'legacy'
    })

    it('opens the purchase dialog when the capability endpoint defaults open', async () => {
      await useDialogService().showTopUpCreditsDialog()

      expect(showSubscriptionDialog).not.toHaveBeenCalled()
      const [args] = showDialog.mock.calls[0]
      expect(args.key).toBe('top-up-credits')
    })
  })
})
