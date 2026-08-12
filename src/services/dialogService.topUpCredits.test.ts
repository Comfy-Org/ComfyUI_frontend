/**
 * showTopUpCreditsDialog must route team members (who cannot top up) to the
 * read-only contact-admin notice instead of the purchase dialog, while
 * owners/personal/legacy users keep the purchase flow.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())
const closeDialog = vi.hoisted(() => vi.fn())
const state = vi.hoisted(() => ({
  canAccessSubscriptionFeatures: true,
  isTeamPlan: false,
  tier: 'STANDARD' as
    | 'FREE'
    | 'STANDARD'
    | 'CREATOR'
    | 'PRO'
    | 'FOUNDERS_EDITION'
    | null,
  type: 'workspace' as 'workspace' | 'legacy',
  canTopUp: true
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
    canAccessSubscriptionFeatures: {
      value: state.canAccessSubscriptionFeatures
    },
    isTeamPlan: { value: state.isTeamPlan },
    tier: { value: state.tier },
    type: { value: state.type }
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: { value: { canTopUp: state.canTopUp } }
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
    state.canAccessSubscriptionFeatures = true
    state.isTeamPlan = false
    state.tier = 'STANDARD'
    state.type = 'workspace'
    state.canTopUp = true
    mockIsCloud.value = true
  })

  it('shows the purchase dialog to users who can top up', async () => {
    await useDialogService().showTopUpCreditsDialog({
      isInsufficientCredits: true
    })

    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('top-up-credits')
  })

  it('shows the contact-admin notice to team members instead of the purchase dialog', async () => {
    state.isTeamPlan = true
    state.canTopUp = false

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

  it('ignores workspace permissions on legacy billing', async () => {
    state.type = 'legacy'
    state.canTopUp = false

    await useDialogService().showTopUpCreditsDialog()

    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('top-up-credits')
  })

  it('routes an active Cloud free-tier user to the subscription-required flow', async () => {
    state.tier = 'FREE'

    await useDialogService().showTopUpCreditsDialog()

    expect(showSubscriptionDialog).toHaveBeenCalledWith({
      reason: 'top_up_blocked'
    })
    expect(showDialog).not.toHaveBeenCalled()
  })

  it('routes a member of an inactive team to the subscription-required flow, not the credits notice', async () => {
    state.canAccessSubscriptionFeatures = false
    state.isTeamPlan = true
    state.canTopUp = false

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
      state.type = 'legacy'
    })

    it('opens the purchase dialog directly on the free tier instead of the subscription-required flow', async () => {
      state.tier = 'FREE'

      await useDialogService().showTopUpCreditsDialog()

      expect(showSubscriptionDialog).not.toHaveBeenCalled()
      const [args] = showDialog.mock.calls[0]
      expect(args.key).toBe('top-up-credits')
    })

    it('opens the purchase dialog even when the facade reports no active subscription', async () => {
      state.canAccessSubscriptionFeatures = false

      await useDialogService().showTopUpCreditsDialog()

      expect(showSubscriptionDialog).not.toHaveBeenCalled()
      const [args] = showDialog.mock.calls[0]
      expect(args.key).toBe('top-up-credits')
    })
  })
})
