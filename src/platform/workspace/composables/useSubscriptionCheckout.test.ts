import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

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
  mockToastAdd
} = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockPreviewSubscribe: vi.fn(),
  mockFetchStatus: vi.fn(),
  mockFetchBalance: vi.fn(),
  mockPlans: { value: [] as Plan[] },
  mockResubscribe: vi.fn(),
  mockToastAdd: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscribe: mockSubscribe,
    previewSubscribe: mockPreviewSubscribe,
    plans: computed(() => mockPlans.value),
    fetchStatus: mockFetchStatus,
    fetchBalance: mockFetchBalance,
    resubscribe: mockResubscribe
  })
}))

// Shields the test from the real workspaceApi → @/scripts/api → app.ts import chain
vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: { resubscribe: mockResubscribe }
}))

vi.mock('@/config/comfyApi', () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackMonthlySubscriptionSucceeded: vi.fn() })
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

  async function setup() {
    const { useSubscriptionCheckout } =
      await import('./useSubscriptionCheckout')
    return useSubscriptionCheckout(emit as never)
  }

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    mockPlans.value = allPlans()
    emit = vi.fn()
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
  })

  describe('handleSubscribeTeamClick', () => {
    it('transitions to preview with the selected team stop and cycle', async () => {
      const checkout = await setup()

      checkout.handleSubscribeTeamClick({
        stop: { id: 'team_400', usd: 400, credits: 84_400 },
        billingCycle: 'yearly'
      })

      expect(checkout.checkoutStep.value).toBe('preview')
      expect(checkout.selectedTeamStop.value).toStrictEqual({
        id: 'team_400',
        usd: 400,
        credits: 84_400
      })
      expect(checkout.selectedBillingCycle.value).toBe('yearly')
      expect(checkout.previewData.value).toBeNull()
      expect(checkout.selectedTierKey.value).toBeNull()
    })
  })

  describe('handleTeamSubscribe', () => {
    it('subscribes with the team plan slug, stop id and billing cycle', async () => {
      const checkout = await setup()
      checkout.handleSubscribeTeamClick({
        stop: { id: 'team_700', usd: 700, credits: 147_700 },
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
    })

    it('uses the annual plan slug for the yearly cycle', async () => {
      const checkout = await setup()
      checkout.handleSubscribeTeamClick({
        stop: { id: 'team_700', usd: 700, credits: 147_700 },
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

    it('opens the payment URL when the team subscribe needs a payment method', async () => {
      const checkout = await setup()
      checkout.handleSubscribeTeamClick({
        stop: { id: 'team_700', usd: 700, credits: 147_700 },
        billingCycle: 'yearly'
      })
      mockSubscribe.mockResolvedValueOnce({
        status: 'needs_payment_method',
        billing_op_id: 'op-team-3',
        payment_method_url: 'https://stripe.com/team-pay'
      })

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
      await checkout.handleTeamSubscribe()

      expect(openSpy).toHaveBeenCalledWith(
        'https://stripe.com/team-pay',
        '_blank'
      )
      openSpy.mockRestore()
    })

    it('does not subscribe and shows an error when the stop has no id', async () => {
      const checkout = await setup()
      checkout.handleSubscribeTeamClick({
        stop: { usd: 700, credits: 147_700 },
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
      checkout.handleSubscribeTeamClick({
        stop: { id: 'team_700', usd: 700, credits: 147_700 },
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
      checkout.handleSubscribeTeamClick({
        stop: { id: 'team_400', usd: 400, credits: 84_400 },
        billingCycle: 'yearly'
      })

      checkout.handleBackToPricing()

      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(checkout.selectedTeamStop.value).toBeNull()
    })
  })

  describe('handleAddCreditCard', () => {
    it('transitions to success step on subscribed status', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-1'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      await checkout.handleAddCreditCard()

      expect(mockSubscribe).toHaveBeenCalledWith('standard-yearly', {
        returnUrl: 'https://platform.comfy.org/payment/success',
        cancelUrl: 'https://platform.comfy.org/payment/failed'
      })
      expect(checkout.checkoutStep.value).toBe('success')
    })

    it('opens payment URL when needs_payment_method', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'needs_payment_method',
        billing_op_id: 'op-2',
        payment_method_url: 'https://stripe.com/pay'
      })

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
      await checkout.handleAddCreditCard()

      expect(openSpy).toHaveBeenCalledWith('https://stripe.com/pay', '_blank')
      openSpy.mockRestore()
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
  })

  describe('handleResubscribe', () => {
    it('emits close on success', async () => {
      const checkout = await setup()
      mockResubscribe.mockResolvedValueOnce({
        billing_op_id: 'op-4',
        status: 'active'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      await checkout.handleResubscribe()

      expect(mockResubscribe).toHaveBeenCalled()
      expect(emit).toHaveBeenCalledWith('close', true)
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
  })
})
