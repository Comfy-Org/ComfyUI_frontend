import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive } from 'vue'

import type { PaymentIntentSource } from '@/platform/telemetry/types'
import type { Plan } from '@/platform/workspace/api/workspaceApi'

import { findPlanSlug } from './useSubscriptionCheckout'

function makeStandardYearly(): Plan {
  return {
    slug: 'standard-yearly',
    tier: 'STANDARD',
    duration: 'ANNUAL',
    price_cents: 1600,
    credits_cents: 4200,
    max_seats: 1,
    availability: { available: true },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 1600,
      total_credits_cents: 4200
    }
  }
}

function makeCreatorMonthly(): Plan {
  return {
    slug: 'creator-monthly',
    tier: 'CREATOR',
    duration: 'MONTHLY',
    price_cents: 3500,
    credits_cents: 7400,
    max_seats: 5,
    availability: { available: true },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 3500,
      total_credits_cents: 7400
    }
  }
}

function allPlans(): Plan[] {
  return [makeStandardYearly(), makeCreatorMonthly()]
}

describe('findPlanSlug', () => {
  it('finds an annual plan by tier key and yearly billing cycle', () => {
    expect(findPlanSlug(allPlans(), 'standard', 'yearly')).toBe(
      'standard-yearly'
    )
  })

  it('finds a monthly plan by tier key and monthly billing cycle', () => {
    expect(findPlanSlug(allPlans(), 'creator', 'monthly')).toBe(
      'creator-monthly'
    )
  })

  it('returns null when no plan matches', () => {
    expect(findPlanSlug(allPlans(), 'standard', 'monthly')).toBeNull()
  })

  it('returns null for empty plans', () => {
    expect(findPlanSlug([], 'standard', 'yearly')).toBeNull()
  })
})

const {
  mockSubscribe,
  mockPreviewSubscribe,
  mockFetchStatus,
  mockFetchBalance,
  mockPlans,
  mockResubscribe,
  mockToastAdd,
  mockStartOperation,
  mockTrackBeginCheckout,
  mockTrackMonthlySubscriptionSucceeded,
  mockShowDowngradeToPersonalDialog,
  mockUserId,
  mockIsTeamPlan,
  mockPermissions
} = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockPreviewSubscribe: vi.fn(),
  mockFetchStatus: vi.fn(),
  mockFetchBalance: vi.fn(),
  mockPlans: { value: [] as Plan[] },
  mockResubscribe: vi.fn(),
  mockToastAdd: vi.fn(),
  mockStartOperation: vi.fn(),
  mockTrackBeginCheckout: vi.fn(),
  mockTrackMonthlySubscriptionSucceeded: vi.fn(),
  mockShowDowngradeToPersonalDialog: vi.fn(),
  mockUserId: { value: 'user-1' as string | null },
  mockIsTeamPlan: { value: false },
  mockPermissions: {
    value: {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
  }
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscribe: mockSubscribe,
    previewSubscribe: mockPreviewSubscribe,
    plans: computed(() => mockPlans.value),
    fetchStatus: mockFetchStatus,
    fetchBalance: mockFetchBalance,
    isTeamPlan: computed(() => mockIsTeamPlan.value),
    resubscribe: mockResubscribe
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: {
      get value() {
        return mockPermissions.value
      }
    }
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showDowngradeToPersonalDialog: mockShowDowngradeToPersonalDialog
  })
}))

// Shields the test from the real workspaceApi → @/scripts/api → app.ts import chain
vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: { resubscribe: mockResubscribe }
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({
    startOperation: mockStartOperation,
    hasPendingOperations: false
  })
}))

vi.mock('@/config/comfyApi', () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd })
}))

const mockTrackResubscribeClicked = vi.hoisted(() => vi.fn())

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackMonthlySubscriptionSucceeded: mockTrackMonthlySubscriptionSucceeded,
    trackResubscribeClicked: mockTrackResubscribeClicked,
    trackBeginCheckout: mockTrackBeginCheckout
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => reactive({ userId: computed(() => mockUserId.value) })
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

describe('useSubscriptionCheckout', () => {
  let emit: ReturnType<typeof vi.fn>
  let assignedHref: string | undefined
  const originalLocation = globalThis.location

  async function setup(
    paymentIntentSource?: PaymentIntentSource,
    tierPlanType: 'personal' | 'team' = 'personal'
  ) {
    const { useSubscriptionCheckout } =
      await import('./useSubscriptionCheckout')
    return useSubscriptionCheckout(emit as never, paymentIntentSource, {
      tierPlanType
    })
  }

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    assignedHref = undefined
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: {
        set href(value: string) {
          assignedHref = value
        }
      }
    })
    mockPlans.value = allPlans()
    mockStartOperation.mockResolvedValue({ status: 'succeeded' })
    mockShowDowngradeToPersonalDialog.mockResolvedValue(null)
    mockUserId.value = 'user-1'
    mockIsTeamPlan.value = false
    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    emit = vi.fn()
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation
    })
  })

  describe('handleSubscribeClick', () => {
    it('transitions to preview on successful preview', async () => {
      const checkout = await setup()
      const preview = {
        allowed: true,
        transition_type: 'new_subscription' as const,
        effective_at: '2025-01-01',
        is_immediate: true,
        cost_today_cents: 1600,
        cost_next_period_cents: 1600,
        credits_today_cents: 4200,
        credits_next_period_cents: 4200,
        new_plan: makeStandardYearly().seat_summary
      }
      mockPreviewSubscribe.mockResolvedValueOnce(preview)

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(checkout.checkoutStep.value).toBe('preview')
      expect(checkout.previewData.value).toStrictEqual(preview)
    })

    it('shows error toast when preview is disallowed', async () => {
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: false,
        reason: 'Not allowed'
      })

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Not allowed'
        })
      )
    })

    it('shows error toast when plan slug is not found', async () => {
      const checkout = await setup()
      mockPlans.value = []

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'This plan is not available'
        })
      )
    })

    it('shows error toast on network failure', async () => {
      const checkout = await setup()
      mockPreviewSubscribe.mockRejectedValueOnce(new Error('Network error'))

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Network error'
        })
      )
    })

    it('resolves monthly billing cycle to correct plan slug', async () => {
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'new_subscription'
      })

      await checkout.handleSubscribeClick({
        tierKey: 'creator',
        billingCycle: 'monthly'
      })

      expect(mockPreviewSubscribe).toHaveBeenCalledWith('creator-monthly')
    })

    it('does not preview a plan for a member', async () => {
      mockPermissions.value = {
        canManageSubscription: false,
        canManageSubscriptionLifecycle: false,
        canDowngradeToPersonal: false
      }
      const checkout = await setup()

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(mockPreviewSubscribe).not.toHaveBeenCalled()
      expect(checkout.checkoutStep.value).toBe('pricing')
    })

    it('does not preview a personal plan for a promoted owner on a team plan', async () => {
      mockIsTeamPlan.value = true
      mockPermissions.value.canDowngradeToPersonal = false
      const checkout = await setup()

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(mockPreviewSubscribe).not.toHaveBeenCalled()
      expect(checkout.checkoutStep.value).toBe('pricing')
    })

    it('allows a promoted owner to preview a legacy Team-plan change', async () => {
      mockIsTeamPlan.value = true
      mockPermissions.value.canDowngradeToPersonal = false
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade'
      })
      const checkout = await setup(undefined, 'team')

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(mockPreviewSubscribe).toHaveBeenCalledWith('standard-yearly')
      expect(checkout.checkoutStep.value).toBe('preview')
    })

    it('routes an original-owner Team-to-personal change through member removal', async () => {
      mockIsTeamPlan.value = true
      const checkout = await setup()

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(mockShowDowngradeToPersonalDialog).toHaveBeenCalledWith({
        planName: 'subscription.tiers.standard.name',
        planSlug: 'standard-yearly'
      })
      expect(mockPreviewSubscribe).not.toHaveBeenCalled()
      expect(checkout.checkoutStep.value).toBe('pricing')
    })

    it('shows success without conversion telemetry for a scheduled Team downgrade', async () => {
      const preview = {
        allowed: true,
        transition_type: 'downgrade' as const,
        effective_at: '2099-02-20T00:00:00Z',
        is_immediate: false,
        cost_today_cents: 0,
        cost_next_period_cents: 33_600,
        credits_today_cents: 0,
        credits_next_period_cents: 7_400,
        new_plan: {
          slug: 'creator-monthly',
          tier: 'CREATOR' as const,
          duration: 'MONTHLY' as const,
          price_cents: 3_500,
          credits_cents: 7_400,
          seat_summary: {
            seat_count: 1,
            total_cost_cents: 3_500,
            total_credits_cents: 7_400
          }
        }
      }
      const response = {
        status: 'subscribed' as const,
        billing_op_id: 'existing-downgrade'
      }
      mockIsTeamPlan.value = true
      mockShowDowngradeToPersonalDialog.mockResolvedValue({ preview, response })
      const checkout = await setup()

      await checkout.handleSubscribeClick({
        tierKey: 'creator',
        billingCycle: 'monthly'
      })

      expect(checkout.previewData.value).toStrictEqual(preview)
      expect(checkout.checkoutStep.value).toBe('success')
      expect(mockTrackMonthlySubscriptionSucceeded).not.toHaveBeenCalled()
      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(mockTrackBeginCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'creator',
          cycle: 'monthly',
          checkout_type: 'change',
          billing_op_id: 'existing-downgrade'
        })
      )
    })

    it('tracks conversion success for an immediate Team downgrade', async () => {
      mockIsTeamPlan.value = true
      mockShowDowngradeToPersonalDialog.mockResolvedValue({
        preview: { is_immediate: true },
        response: {
          status: 'subscribed',
          billing_op_id: 'immediate-downgrade'
        }
      })
      const checkout = await setup()

      await checkout.handleSubscribeClick({
        tierKey: 'creator',
        billingCycle: 'monthly'
      })

      expect(checkout.checkoutStep.value).toBe('success')
      expect(mockTrackMonthlySubscriptionSucceeded).toHaveBeenCalledOnce()
    })
  })

  describe('handleSubscribeTeamClick', () => {
    it('transitions to preview with the selected team stop and cycle', async () => {
      const checkout = await setup()

      await checkout.handleSubscribeTeamClick({
        stop: { id: 'team_400', usd: 400, credits: 84_400, discountedUsd: 380 },
        billingCycle: 'yearly'
      })

      expect(checkout.checkoutStep.value).toBe('preview')
      expect(checkout.selectedTeamStop.value).toStrictEqual({
        id: 'team_400',
        usd: 400,
        credits: 84_400,
        discountedUsd: 380
      })
      expect(checkout.selectedBillingCycle.value).toBe('yearly')
      expect(checkout.previewData.value).toBeNull()
      expect(checkout.selectedTierKey.value).toBeNull()
    })

    it('previews a prorated transition when an existing subscriber changes stop', async () => {
      const checkout = await setup()
      const transition = {
        allowed: true,
        transition_type: 'upgrade' as const,
        is_immediate: true,
        cost_today_cents: 105_000
      }
      mockPreviewSubscribe.mockResolvedValueOnce(transition)

      await checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_1400',
          usd: 1400,
          credits: 295_400,
          discountedUsd: 1295
        },
        billingCycle: 'monthly',
        isChange: true
      })

      expect(mockPreviewSubscribe).toHaveBeenCalledWith(
        'team_per_credit_monthly',
        { teamCreditStopId: 'team_1400', billingCycle: 'monthly' }
      )
      expect(checkout.previewData.value).toStrictEqual(transition)
    })

    it('falls back to the display-only confirm when the preview is a fresh subscription', async () => {
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'new_subscription',
        is_immediate: true
      })

      await checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_1400',
          usd: 1400,
          credits: 295_400,
          discountedUsd: 1295
        },
        billingCycle: 'monthly',
        isChange: true
      })

      expect(checkout.previewData.value).toBeNull()
    })

    it('falls back to the display-only confirm when the preview request fails', async () => {
      const checkout = await setup()
      mockPreviewSubscribe.mockRejectedValueOnce(new Error('not supported'))

      await checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_1400',
          usd: 1400,
          credits: 295_400,
          discountedUsd: 1295
        },
        billingCycle: 'monthly',
        isChange: true
      })

      expect(checkout.previewData.value).toBeNull()
      expect(checkout.checkoutStep.value).toBe('preview')
    })

    it('does not preview a fresh team subscribe (nothing to prorate)', async () => {
      const checkout = await setup()

      await checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_700',
          usd: 700,
          credits: 147_700,
          discountedUsd: 665
        },
        billingCycle: 'monthly',
        isChange: false
      })

      expect(mockPreviewSubscribe).not.toHaveBeenCalled()
      expect(checkout.previewData.value).toBeNull()
    })

    it('does not prepare a team checkout for a member', async () => {
      mockPermissions.value.canManageSubscription = false
      const checkout = await setup()

      await checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_700',
          usd: 700,
          credits: 147_700,
          discountedUsd: 665
        },
        billingCycle: 'monthly',
        isChange: true
      })

      expect(mockPreviewSubscribe).not.toHaveBeenCalled()
      expect(checkout.selectedTeamStop.value).toBeNull()
      expect(checkout.checkoutStep.value).toBe('pricing')
    })
  })

  describe('previewVariant', () => {
    it('is null on the initial pricing step', async () => {
      const checkout = await setup()
      expect(checkout.previewVariant.value).toBeNull()
    })

    it('is personal-new for a fresh personal subscription preview', async () => {
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'new_subscription'
      })

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(checkout.previewVariant.value).toBe('personal-new')
    })

    it('is personal-change for a personal plan transition preview', async () => {
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade'
      })

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(checkout.previewVariant.value).toBe('personal-change')
    })

    it('is team-new for a fresh team subscribe (nothing to prorate)', async () => {
      const checkout = await setup()

      await checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_700',
          usd: 700,
          credits: 147_700,
          discountedUsd: 665
        },
        billingCycle: 'monthly',
        isChange: false
      })

      expect(checkout.previewVariant.value).toBe('team-new')
    })

    it('is team-change once an immediate team transition preview resolves', async () => {
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 105_000
      })

      await checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_1400',
          usd: 1400,
          credits: 295_400,
          discountedUsd: 1295
        },
        billingCycle: 'monthly',
        isChange: true
      })

      expect(checkout.previewVariant.value).toBe('team-change')
    })
  })

  describe('handleTeamSubscribe', () => {
    it('subscribes with the team plan slug, stop id and billing cycle', async () => {
      const checkout = await setup()
      await checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_700',
          usd: 700,
          credits: 147_700,
          discountedUsd: 665
        },
        billingCycle: 'monthly'
      })
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-team-1'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      await checkout.handleTeamSubscribe()

      expect(mockSubscribe).toHaveBeenCalledWith('team_per_credit_monthly', {
        teamCreditStopId: 'team_700',
        billingCycle: 'monthly',
        returnUrl: 'https://platform.comfy.org/payment/success',
        cancelUrl: 'https://platform.comfy.org/payment/failed'
      })
      expect(checkout.checkoutStep.value).toBe('success')
      expect(mockTrackBeginCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'team',
          checkout_type: 'new',
          billing_op_id: 'op-team-1'
        })
      )
    })

    it('uses the annual plan slug for the yearly cycle', async () => {
      const checkout = await setup()
      await checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_700',
          usd: 700,
          credits: 147_700,
          discountedUsd: 630
        },
        billingCycle: 'yearly'
      })
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-team-2'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      await checkout.handleTeamSubscribe()

      expect(mockSubscribe).toHaveBeenCalledWith(
        'team_per_credit_annual',
        expect.objectContaining({
          teamCreditStopId: 'team_700',
          billingCycle: 'yearly'
        })
      )
    })

    it('redirects to the payment URL when the team subscribe needs a payment method', async () => {
      const checkout = await setup()
      await checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_700',
          usd: 700,
          credits: 147_700,
          discountedUsd: 630
        },
        billingCycle: 'yearly'
      })
      mockSubscribe.mockResolvedValueOnce({
        status: 'needs_payment_method',
        billing_op_id: 'op-team-3',
        payment_method_url: 'https://stripe.com/team-pay'
      })

      await checkout.handleTeamSubscribe()

      expect(assignedHref).toBe('https://stripe.com/team-pay')
      expect(mockStartOperation).not.toHaveBeenCalled()
    })

    it('does not subscribe and shows an error when the stop has no id', async () => {
      const checkout = await setup()
      await checkout.handleSubscribeTeamClick({
        stop: { usd: 700, credits: 147_700, discountedUsd: 630 },
        billingCycle: 'yearly'
      })

      await checkout.handleTeamSubscribe()

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it('shows an error toast when the team subscribe fails', async () => {
      const checkout = await setup()
      await checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_700',
          usd: 700,
          credits: 147_700,
          discountedUsd: 630
        },
        billingCycle: 'yearly'
      })
      mockSubscribe.mockRejectedValueOnce(new Error('Team payment failed'))

      await checkout.handleTeamSubscribe()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Team payment failed'
        })
      )
      expect(mockTrackBeginCheckout).not.toHaveBeenCalled()
    })

    it('keeps team checkout_type as change when the preview request fails', async () => {
      const checkout = await setup()
      mockPreviewSubscribe.mockRejectedValueOnce(new Error('not supported'))
      await checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_1400',
          usd: 1400,
          credits: 295_400,
          discountedUsd: 1295
        },
        billingCycle: 'monthly',
        isChange: true
      })
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-team-change'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      await checkout.handleTeamSubscribe()

      expect(mockTrackBeginCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'team',
          cycle: 'monthly',
          checkout_type: 'change',
          billing_op_id: 'op-team-change'
        })
      )
    })
  })

  describe('handleBackToPricing', () => {
    it('resets to pricing step and clears preview data', async () => {
      const checkout = await setup()
      checkout.checkoutStep.value = 'preview'
      checkout.previewData.value = {} as never

      checkout.handleBackToPricing()

      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(checkout.previewData.value).toBeNull()
    })

    it('clears the selected team stop', async () => {
      const checkout = await setup()
      await checkout.handleSubscribeTeamClick({
        stop: { id: 'team_400', usd: 400, credits: 84_400, discountedUsd: 380 },
        billingCycle: 'yearly'
      })

      checkout.handleBackToPricing()

      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(checkout.selectedTeamStop.value).toBeNull()
    })
  })

  describe('handleAddCreditCard', () => {
    it('shows existing success immediately without owning reconciliation', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-1'
      })
      mockFetchStatus.mockReturnValueOnce(new Promise(() => {}))
      mockFetchBalance.mockReturnValueOnce(new Promise(() => {}))

      await checkout.handleAddCreditCard()

      expect(mockSubscribe).toHaveBeenCalledWith('standard-yearly', {
        returnUrl: 'https://platform.comfy.org/payment/success',
        cancelUrl: 'https://platform.comfy.org/payment/failed'
      })
      expect(checkout.checkoutStep.value).toBe('success')
      expect(mockTrackMonthlySubscriptionSucceeded).toHaveBeenCalledOnce()
      expect(mockFetchStatus).not.toHaveBeenCalled()
      expect(mockFetchBalance).not.toHaveBeenCalled()
    })

    it('skips begin_checkout when no user id is available', async () => {
      mockUserId.value = null
      const checkout = await setup('subscribe_to_run')
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-1'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      await checkout.handleAddCreditCard()

      expect(mockTrackBeginCheckout).not.toHaveBeenCalled()
      mockUserId.value = 'user-1'
    })

    it('fires begin_checkout carrying the payment intent source', async () => {
      const checkout = await setup('subscribe_to_run')
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-1'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      await checkout.handleAddCreditCard()

      expect(mockTrackBeginCheckout).toHaveBeenCalledWith({
        user_id: 'user-1',
        tier: 'standard',
        cycle: 'yearly',
        checkout_type: 'new',
        billing_op_id: 'op-1',
        payment_intent_source: 'subscribe_to_run'
      })
    })

    it('redirects to the payment URL when a payment method is needed', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'needs_payment_method',
        billing_op_id: 'op-2',
        payment_method_url: 'https://stripe.com/pay'
      })

      await checkout.handleAddCreditCard()

      expect(assignedHref).toBe('https://stripe.com/pay')
      expect(mockStartOperation).not.toHaveBeenCalled()
    })

    it('polls the operation when needs_payment_method has no URL', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'needs_payment_method',
        billing_op_id: 'op-no-url'
      })
      mockStartOperation.mockResolvedValueOnce({ status: 'succeeded' })

      await checkout.handleAddCreditCard()

      expect(mockStartOperation).toHaveBeenCalledWith(
        'op-no-url',
        'subscription'
      )
      expect(checkout.checkoutStep.value).toBe('success')
    })

    it('advances to success once the async payment operation succeeds', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'pending_payment',
        billing_op_id: 'op-async-1'
      })
      mockStartOperation.mockResolvedValueOnce({ status: 'succeeded' })

      await checkout.handleAddCreditCard()

      expect(mockStartOperation).toHaveBeenCalledWith(
        'op-async-1',
        'subscription'
      )
      expect(checkout.checkoutStep.value).toBe('success')
    })

    it('stays on the confirm step when the async operation does not succeed', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      checkout.checkoutStep.value = 'preview'
      mockSubscribe.mockResolvedValueOnce({
        status: 'pending_payment',
        billing_op_id: 'op-async-2'
      })
      mockStartOperation.mockResolvedValueOnce({ status: 'failed' })

      await checkout.handleAddCreditCard()

      expect(mockStartOperation).toHaveBeenCalledWith(
        'op-async-2',
        'subscription'
      )
      expect(checkout.checkoutStep.value).toBe('preview')
    })

    it('shows error toast on subscribe failure', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockRejectedValueOnce(new Error('Payment failed'))

      await checkout.handleAddCreditCard()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Payment failed'
        })
      )
      expect(mockTrackBeginCheckout).not.toHaveBeenCalled()
    })

    it('does not submit when workspace ownership is revoked', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockPermissions.value.canManageSubscription = false

      await checkout.handleAddCreditCard()

      expect(mockSubscribe).not.toHaveBeenCalled()
    })
  })

  describe('handleConfirmTransition', () => {
    it('transitions to success step on subscribed status', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-3'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      await checkout.handleConfirmTransition()

      expect(checkout.checkoutStep.value).toBe('success')
    })

    it('shows error toast on failure', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockRejectedValueOnce(new Error('Transition error'))

      await checkout.handleConfirmTransition()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Transition error'
        })
      )
    })

    it('does not submit a previewed plan after permission is revoked', async () => {
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'downgrade'
      })
      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })
      expect(checkout.checkoutStep.value).toBe('preview')
      mockPermissions.value.canManageSubscription = false

      await checkout.handleConfirmTransition()

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(mockTrackBeginCheckout).not.toHaveBeenCalled()
      expect(emit).not.toHaveBeenCalled()
      expect(mockToastAdd).not.toHaveBeenCalled()
    })
  })

  describe('handleResubscribe', () => {
    it('emits close on success', async () => {
      const checkout = await setup('subscribe_to_run')
      mockResubscribe.mockResolvedValueOnce({
        billing_op_id: 'op-4',
        status: 'active'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      await checkout.handleResubscribe()

      expect(mockResubscribe).toHaveBeenCalled()
      expect(emit).toHaveBeenCalledWith('close', true)
      expect(mockTrackResubscribeClicked).toHaveBeenCalledWith({
        source: 'pricing_dialog',
        payment_intent_source: 'subscribe_to_run'
      })
    })

    it('shows error toast on failure', async () => {
      const checkout = await setup()
      mockResubscribe.mockRejectedValueOnce(new Error('Resubscribe failed'))

      await checkout.handleResubscribe()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Resubscribe failed'
        })
      )
    })

    it('does not resubscribe for a member', async () => {
      mockPermissions.value.canManageSubscriptionLifecycle = false
      const checkout = await setup()

      await checkout.handleResubscribe()

      expect(mockResubscribe).not.toHaveBeenCalled()
      expect(mockTrackResubscribeClicked).not.toHaveBeenCalled()
    })
  })
})
