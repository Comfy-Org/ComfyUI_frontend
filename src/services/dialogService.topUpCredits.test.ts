import { beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())
const state = vi.hoisted(() => ({
  isActiveSubscription: true,
  isFreeTier: false,
  type: 'legacy' as 'workspace' | 'legacy'
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog })
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
    isActiveSubscription: { value: state.isActiveSubscription },
    isFreeTier: { value: state.isFreeTier },
    type: { value: state.type }
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
    vi.clearAllMocks()
    state.isActiveSubscription = true
    state.isFreeTier = false
    state.type = 'legacy'
    mockIsCloud.value = true
  })

  it('shows the purchase dialog to users who can top up', async () => {
    await useDialogService().showTopUpCreditsDialog({
      isInsufficientCredits: true
    })

    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('top-up-credits')
  })

  it('routes an inactive cloud user to the subscription-required flow', async () => {
    state.isActiveSubscription = false

    await useDialogService().showTopUpCreditsDialog({
      isInsufficientCredits: true
    })

    expect(showSubscriptionDialog).toHaveBeenCalledWith({
      reason: 'out_of_credits'
    })
    expect(showDialog).not.toHaveBeenCalled()
  })

  describe('non-cloud distribution', () => {
    beforeEach(() => {
      mockIsCloud.value = false
    })

    it('opens the purchase dialog directly on the free tier instead of the subscription-required flow', async () => {
      state.isFreeTier = true

      await useDialogService().showTopUpCreditsDialog()

      expect(showSubscriptionDialog).not.toHaveBeenCalled()
      const [args] = showDialog.mock.calls[0]
      expect(args.key).toBe('top-up-credits')
    })

    it('opens the purchase dialog even when the facade reports no active subscription', async () => {
      state.isActiveSubscription = false

      await useDialogService().showTopUpCreditsDialog()

      expect(showSubscriptionDialog).not.toHaveBeenCalled()
      const [args] = showDialog.mock.calls[0]
      expect(args.key).toBe('top-up-credits')
    })
  })
})
