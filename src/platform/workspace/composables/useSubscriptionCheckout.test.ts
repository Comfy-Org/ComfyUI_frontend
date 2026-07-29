import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  mockFetchPlans,
  mockFetchStatus,
  mockFetchBalance,
  mockPlans,
  mockResubscribe,
  mockToastAdd,
  mockStartOperation,
  mockGetOperation,
  mockSubscriptionActionOperation,
  mockTrackBeginCheckout,
  mockTrackBillingEvent,
  mockShowDowngradeToPersonalDialog,
  mockUserId,
  mockIsTeamPlan,
  mockShouldUseWorkspaceBilling,
  mockSetActiveWorkspaceId,
  mockPermissions,
  mockSubscription
} = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockPreviewSubscribe: vi.fn(),
  mockFetchPlans: vi.fn(),
  mockFetchStatus: vi.fn(),
  mockFetchBalance: vi.fn(),
  mockPlans: { value: [] as Plan[] },
  mockResubscribe: vi.fn(),
  mockToastAdd: vi.fn(),
  mockStartOperation: vi.fn(),
  mockGetOperation: vi.fn(),
  mockSubscriptionActionOperation: {
    value: undefined as
      | {
          status: 'pending'
          workspaceId: string
          actionUrl: string
        }
      | undefined
  },
  mockTrackBeginCheckout: vi.fn(),
  mockTrackBillingEvent: vi.fn(),
  mockShowDowngradeToPersonalDialog: vi.fn(),
  mockUserId: { value: 'user-1' as string | null },
  mockIsTeamPlan: { value: false },
  mockShouldUseWorkspaceBilling: { value: true },
  mockSetActiveWorkspaceId: vi.fn<(workspaceId: string) => void>(),
  mockPermissions: {
    value: {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
  },
  mockSubscription: { value: null as { isCancelled: boolean } | null }
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscribe: mockSubscribe,
    previewSubscribe: mockPreviewSubscribe,
    plans: mockPlans,
    fetchPlans: mockFetchPlans,
    fetchStatus: mockFetchStatus,
    fetchBalance: mockFetchBalance,
    isTeamPlan: computed(() => mockIsTeamPlan.value),
    resubscribe: mockResubscribe,
    subscription: computed(() => mockSubscription.value)
  })
}))

vi.mock('@/composables/billing/useBillingRouting', () => ({
  useBillingRouting: () => ({
    shouldUseWorkspaceBilling: computed(
      () => mockShouldUseWorkspaceBilling.value
    )
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
    getOperation: mockGetOperation,
    get subscriptionActionOperation() {
      return mockSubscriptionActionOperation.value
    }
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', async () => {
  const { ref } = await import('vue')
  const activeWorkspaceId = ref('workspace-1')
  mockSetActiveWorkspaceId.mockImplementation((workspaceId) => {
    activeWorkspaceId.value = workspaceId
  })
  return {
    useTeamWorkspaceStore: () => ({
      get activeWorkspaceId() {
        return activeWorkspaceId.value
      }
    })
  }
})

vi.mock('@/config/comfyApi', () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd })
}))

const mockTrackResubscribeClicked = vi.hoisted(() => vi.fn())

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackBillingEvent: mockTrackBillingEvent,
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
    mockSubscriptionActionOperation.value = undefined
    mockPlans.value = allPlans()
    mockFetchPlans.mockResolvedValue(undefined)
    mockStartOperation.mockResolvedValue({
      status: 'succeeded',
      workspaceId: 'workspace-1'
    })
    mockGetOperation.mockReturnValue(undefined)
    mockShowDowngradeToPersonalDialog.mockResolvedValue(null)
    mockUserId.value = 'user-1'
    mockIsTeamPlan.value = false
    mockShouldUseWorkspaceBilling.value = true
    mockSetActiveWorkspaceId('workspace-1')
    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    mockSubscription.value = null
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
      expect(mockSubscribe).not.toHaveBeenCalled()
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
      expect(mockFetchPlans).toHaveBeenCalledOnce()
    })

    it('waits for plans before opening a deep-linked confirmation', async () => {
      const checkout = await setup()
      mockPlans.value = []
      let resolvePlans = () => {}
      mockFetchPlans.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolvePlans = () => {
              mockPlans.value = [makeCreatorMonthly()]
              resolve()
            }
          })
      )
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'new_subscription',
        effective_at: '2025-01-01',
        is_immediate: true,
        cost_today_cents: 3500,
        cost_next_period_cents: 3500,
        credits_today_cents: 7400,
        credits_next_period_cents: 7400,
        new_plan: makeCreatorMonthly().seat_summary
      })

      const checkoutPromise = checkout.handleSubscribeClick({
        tierKey: 'creator',
        billingCycle: 'monthly'
      })

      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(mockPreviewSubscribe).not.toHaveBeenCalled()
      resolvePlans()
      await checkoutPromise

      expect(mockFetchPlans).toHaveBeenCalledOnce()
      expect(mockPreviewSubscribe).toHaveBeenCalledWith('creator-monthly')
      expect(checkout.checkoutStep.value).toBe('preview')
      expect(mockSubscribe).not.toHaveBeenCalled()
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
      expect(mockTrackBillingEvent).not.toHaveBeenCalled()
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
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'subscription_checkout',
        stage: 'succeeded',
        outcome: 'success',
        tier: 'creator',
        cycle: 'monthly',
        checkout_type: 'change',
        payment_intent_source: undefined,
        billing_op_id: 'immediate-downgrade'
      })
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

    // Regression guard: a cancelled personal subscriber picking Team has no
    // existing team plan to "change", so isChange is false — but this is a
    // reactivation, not a fresh subscribe, and the consent-less add-payment
    // screen that isChange:false would otherwise route to can never collect
    // confirm_reactivation.
    it('previews a cancelled personal subscriber choosing Team, even though nothing existing is changing', async () => {
      mockSubscription.value = { isCancelled: true }
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 70_000
      })
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

      expect(mockPreviewSubscribe).toHaveBeenCalledWith(
        'team_per_credit_monthly',
        {
          teamCreditStopId: 'team_700',
          billingCycle: 'monthly'
        }
      )
      expect(checkout.previewData.value).not.toBeNull()
      expect(checkout.previewVariant.value).toBe('team-change')
    })

    it('bounces a cancelled subscriber back to pricing when the preview does not qualify', async () => {
      mockSubscription.value = { isCancelled: true }
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'new_subscription',
        is_immediate: true
      })
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

      expect(checkout.previewData.value).toBeNull()
      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(checkout.selectedTeamStop.value).toBeNull()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it('bounces a cancelled subscriber back to pricing when the preview request fails', async () => {
      mockSubscription.value = { isCancelled: true }
      mockPreviewSubscribe.mockRejectedValueOnce(new Error('not supported'))
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

      expect(checkout.previewData.value).toBeNull()
      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'not supported' })
      )
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
        cancelUrl: 'https://platform.comfy.org/payment/failed',
        confirmReactivation: false
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

    it('forwards confirmReactivation true when the disclosure banner reports consent', async () => {
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
        billing_op_id: 'op-team-reactivate'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      await checkout.handleTeamSubscribe(true)

      expect(mockSubscribe).toHaveBeenCalledWith(
        'team_per_credit_monthly',
        expect.objectContaining({ confirmReactivation: true })
      )
    })

    // Regression guard: confirmReactivation must come from the disclosure
    // banner's own confirm action, never be re-derived from
    // subscription.isCancelled. A path with no banner (team-new fallback)
    // always calls in with confirmReactivation=false, so a cancelled
    // subscription must block the request rather than silently send it and
    // let the BE reject it with no way for the user to consent.
    it('blocks the team subscribe and shows an error for a cancelled subscription with no confirmation', async () => {
      mockSubscription.value = { isCancelled: true }
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

      await checkout.handleTeamSubscribe()

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it('refuses to bill a team reactivation when a fresh preview no longer matches the confirmed charge', async () => {
      mockSubscription.value = { isCancelled: true }
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
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 120_000
      })

      await checkout.handleTeamSubscribe(true)

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'subscription.preview.reactivation.amountChanged'
        })
      )
      // Regression guard: the rejected drift preview must still be installed
      // so the confirm screen shows the new amount and a retry compares
      // against what's on screen, instead of repeating this same rejection
      // forever against the stale original amount.
      expect(checkout.previewData.value?.cost_today_cents).toBe(120_000)

      // Retry now that the updated amount is showing and re-consented to.
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 120_000
      })
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-team-retry-amount-changed'
      })

      await checkout.handleTeamSubscribe(true)

      expect(mockSubscribe).toHaveBeenCalledWith(
        'team_per_credit_monthly',
        expect.objectContaining({ confirmReactivation: true })
      )
      expect(checkout.checkoutStep.value).toBe('success')
    })

    // Regression guard: fetchStatus() and the reactivation guard must run
    // inside the same protected/loading section as the rest of the submit,
    // so a refresh failure surfaces the normal error toast/telemetry and
    // clears loading, instead of escaping uncaught while the CTA stays
    // enabled for a concurrent submit.
    it('surfaces an error and clears loading when the pre-submit status refresh rejects', async () => {
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
      mockFetchStatus.mockRejectedValueOnce(new Error('status unavailable'))

      const submitPromise = checkout.handleTeamSubscribe()
      expect(checkout.isSubscribing.value).toBe(true)
      await submitPromise

      expect(checkout.isSubscribing.value).toBe(false)
      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'status unavailable'
        })
      )
      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'subscription_checkout',
          stage: 'failed',
          outcome: 'failure'
        })
      )
    })

    // Regression guard: drift recovery must reuse the same reactivation-
    // capable predicate as the initial cancelled-Team preview. A refreshed
    // preview that comes back as a fresh subscribe can't feed the banner or
    // emit confirm_reactivation, so installing it as a team-change would
    // strand every retry; this must bounce back to pricing instead.
    it('bounces to pricing when a status-drift refresh returns a preview that cannot collect reactivation consent', async () => {
      mockSubscription.value = { isCancelled: false }
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

      mockFetchStatus.mockImplementationOnce(() => {
        mockSubscription.value = { isCancelled: true }
        return Promise.resolve()
      })
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'new_subscription',
        is_immediate: true
      })

      await checkout.handleTeamSubscribe()

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(checkout.previewData.value).toBeNull()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
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

    it('opens the payment URL when the team subscribe needs a payment method', async () => {
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
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'subscription_checkout',
        stage: 'failed',
        outcome: 'failure',
        tier: 'team',
        cycle: 'yearly',
        checkout_type: 'new',
        payment_intent_source: undefined,
        failure_category: 'unknown'
      })
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

    it('refreshes stale cancellation state before a team submit and lets a retry succeed after the subscription is cancelled elsewhere', async () => {
      mockSubscription.value = { isCancelled: false }
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

      mockFetchStatus.mockImplementationOnce(() => {
        mockSubscription.value = { isCancelled: true }
        return Promise.resolve()
      })
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 110_000
      })

      await checkout.handleTeamSubscribe()

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(checkout.previewData.value?.cost_today_cents).toBe(110_000)

      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 110_000
      })
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-team-retry-active-to-cancelled'
      })

      await checkout.handleTeamSubscribe(true)

      expect(mockSubscribe).toHaveBeenCalledWith(
        'team_per_credit_monthly',
        expect.objectContaining({ confirmReactivation: true })
      )
      expect(checkout.checkoutStep.value).toBe('success')
    })
  })

  describe('handleBackToPricing', () => {
    it('surfaces a subscription operation recovered from billing status', async () => {
      mockSubscriptionActionOperation.value = {
        status: 'pending',
        workspaceId: 'workspace-1',
        actionUrl: 'https://verify.example/sensitive-token'
      }

      const checkout = await setup()

      expect(checkout.activeCheckoutActionUrl.value).toBe(
        'https://verify.example/sensitive-token'
      )
      expect(checkout.isPolling.value).toBe(true)
    })

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

    it('keeps the active payment preview open while polling', async () => {
      const checkout = await setup()
      checkout.checkoutStep.value = 'preview'
      checkout.selectedTierKey.value = 'standard'
      mockSubscribe.mockResolvedValueOnce({
        status: 'pending_payment',
        billing_op_id: 'op-pending'
      })
      mockGetOperation.mockImplementation((opId) =>
        opId === 'op-pending'
          ? { status: 'pending', workspaceId: 'workspace-1' }
          : undefined
      )
      let resolveOperation!: (operation: { status: 'failed' }) => void
      mockStartOperation.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOperation = resolve
          })
      )

      const payment = checkout.handleAddCreditCard()
      await vi.waitFor(() => expect(mockStartOperation).toHaveBeenCalledOnce())
      checkout.handleBackToPricing()

      expect(checkout.checkoutStep.value).toBe('preview')

      resolveOperation({ status: 'failed' })
      await payment
    })

    it('does not apply an operation result after switching workspaces', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      mockSubscribe.mockResolvedValueOnce({
        status: 'pending_payment',
        billing_op_id: 'op-pending'
      })
      mockGetOperation.mockReturnValue({
        status: 'pending',
        workspaceId: 'workspace-1',
        actionUrl: 'https://verify.example/sensitive-token'
      })
      let resolveOperation!: (operation: {
        status: 'succeeded'
        workspaceId: string
      }) => void
      mockStartOperation.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOperation = resolve
          })
      )

      const payment = checkout.handleAddCreditCard()
      await vi.waitFor(() =>
        expect(checkout.activeCheckoutActionUrl.value).not.toBeNull()
      )

      mockSetActiveWorkspaceId('workspace-2')

      expect(checkout.activeCheckoutActionUrl.value).toBeNull()
      expect(checkout.isPolling.value).toBe(false)

      resolveOperation({
        status: 'succeeded',
        workspaceId: 'workspace-1'
      })
      await payment

      expect(checkout.checkoutStep.value).not.toBe('success')
    })
  })

  describe('handleAddCreditCard', () => {
    it('shows existing success immediately without owning post-response reconciliation', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-1'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockReturnValueOnce(new Promise(() => {}))

      await checkout.handleAddCreditCard()

      expect(mockSubscribe).toHaveBeenCalledWith('standard-yearly', {
        returnUrl: 'https://platform.comfy.org/payment/success',
        cancelUrl: 'https://platform.comfy.org/payment/failed',
        confirmReactivation: false
      })
      expect(checkout.checkoutStep.value).toBe('success')
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'subscription_checkout',
        stage: 'succeeded',
        outcome: 'success',
        tier: 'standard',
        cycle: 'yearly',
        checkout_type: 'new',
        payment_intent_source: undefined,
        billing_op_id: 'op-1'
      })
      // Refreshed once, pre-submit, to keep the reactivation guard honest —
      // but balance reconciliation after a successful response is still not
      // this composable's job.
      expect(mockFetchStatus).toHaveBeenCalledTimes(1)
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

    it('warns when the payment popup is blocked', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'needs_payment_method',
        billing_op_id: 'op-blocked',
        payment_method_url: 'https://stripe.com/pay'
      })
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)

      await checkout.handleAddCreditCard()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warn',
          detail: 'subscription.preview.paymentPopupBlocked'
        })
      )
      openSpy.mockRestore()
    })

    it('polls the operation without opening a window when needs_payment_method has no URL', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'needs_payment_method',
        billing_op_id: 'op-no-url'
      })
      mockStartOperation.mockResolvedValueOnce({
        status: 'succeeded',
        workspaceId: 'workspace-1'
      })
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      await checkout.handleAddCreditCard()

      expect(openSpy).not.toHaveBeenCalled()
      expect(mockStartOperation).toHaveBeenCalledWith(
        'op-no-url',
        'subscription',
        {
          tier: 'standard',
          cycle: 'yearly',
          checkoutType: 'new',
          paymentIntentSource: undefined
        }
      )
      expect(checkout.checkoutStep.value).toBe('success')
      openSpy.mockRestore()
    })

    it('advances to success once the async payment operation succeeds', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'needs_payment_method',
        billing_op_id: 'op-async-1',
        payment_method_url: 'https://stripe.com/pay'
      })
      mockStartOperation.mockResolvedValueOnce({
        status: 'succeeded',
        workspaceId: 'workspace-1'
      })
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      await checkout.handleAddCreditCard()

      expect(mockStartOperation).toHaveBeenCalledWith(
        'op-async-1',
        'subscription',
        {
          tier: 'standard',
          cycle: 'yearly',
          checkoutType: 'new',
          paymentIntentSource: undefined
        }
      )
      expect(checkout.checkoutStep.value).toBe('success')
      openSpy.mockRestore()
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
        'subscription',
        {
          tier: 'standard',
          cycle: 'yearly',
          checkoutType: 'new',
          paymentIntentSource: undefined
        }
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
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'subscription_checkout',
        stage: 'failed',
        outcome: 'failure',
        tier: 'standard',
        cycle: 'yearly',
        checkout_type: 'new',
        payment_intent_source: undefined,
        failure_category: 'unknown'
      })
    })

    it('reports an empty workspace response as a sanitized failure', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce(undefined)

      await checkout.handleAddCreditCard()

      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'subscription_checkout',
        stage: 'failed',
        outcome: 'failure',
        tier: 'standard',
        cycle: 'yearly',
        checkout_type: 'new',
        payment_intent_source: undefined,
        failure_category: 'unknown',
        error_code: 'missing_checkout_response'
      })
    })

    it('does not report an empty legacy checkout launch as failure', async () => {
      mockShouldUseWorkspaceBilling.value = false
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce(undefined)

      await checkout.handleAddCreditCard()

      expect(mockTrackBillingEvent).not.toHaveBeenCalled()
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

    it('forwards confirmReactivation true when the disclosure banner reports consent', async () => {
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-reactivate'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      await checkout.handleConfirmTransition(true)

      expect(mockSubscribe).toHaveBeenCalledWith(
        'standard-yearly',
        expect.objectContaining({ confirmReactivation: true })
      )
    })

    // Regression guard: confirmReactivation must come from the disclosure
    // banner's own confirm action, never be re-derived from
    // subscription.isCancelled. A path with no banner (add-payment preview)
    // always calls in with confirmReactivation=false, so a cancelled
    // subscription must block the request rather than silently send it and
    // let the BE reject it with no way for the user to consent.
    it('blocks the subscribe and shows an error for a cancelled subscription with no confirmation', async () => {
      mockSubscription.value = { isCancelled: true }
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'

      await checkout.handleConfirmTransition()

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it('refuses to bill when a fresh preview no longer matches the confirmed charge', async () => {
      // The user saw and consented to $15.00; proration moved the price to
      // $20.00 before this confirm click — billing on the new figure would
      // charge an amount never actually shown to the user.
      mockSubscription.value = { isCancelled: true }
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        cost_today_cents: 1500
      })
      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        cost_today_cents: 2000
      })

      await checkout.handleConfirmTransition(true)

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'subscription.preview.reactivation.amountChanged'
        })
      )
      // Regression guard: the rejected drift preview must still be installed
      // so the confirm screen shows the new amount and a retry compares
      // against what's on screen, instead of repeating this same rejection
      // forever against the stale original amount.
      expect(checkout.previewData.value?.cost_today_cents).toBe(2000)

      // Retry now that the updated amount is showing and re-consented to.
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        cost_today_cents: 2000
      })
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-retry-amount-changed'
      })

      await checkout.handleConfirmTransition(true)

      expect(mockSubscribe).toHaveBeenCalledWith(
        'standard-yearly',
        expect.objectContaining({ confirmReactivation: true })
      )
      expect(checkout.checkoutStep.value).toBe('success')
    })

    it('re-previews and bills once the confirmed charge still matches', async () => {
      mockSubscription.value = { isCancelled: true }
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        cost_today_cents: 1500
      })
      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        cost_today_cents: 1500
      })
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-reactivate-checked'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      await checkout.handleConfirmTransition(true)

      expect(mockPreviewSubscribe).toHaveBeenCalledTimes(2)
      expect(mockSubscribe).toHaveBeenCalledWith(
        'standard-yearly',
        expect.objectContaining({ confirmReactivation: true })
      )
      expect(checkout.checkoutStep.value).toBe('success')
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

    it('refreshes stale cancellation state before submit and lets a retry succeed after the subscription is cancelled elsewhere', async () => {
      mockSubscription.value = { isCancelled: false }
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        cost_today_cents: 1500
      })
      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })
      expect(checkout.checkoutStep.value).toBe('preview')

      // Cancelled in another tab while this confirm screen stays open; the
      // banner never showed here because it wasn't cancelled when the
      // preview loaded, so this submit still carries confirmReactivation=false.
      mockFetchStatus.mockImplementationOnce(() => {
        mockSubscription.value = { isCancelled: true }
        return Promise.resolve()
      })
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 1600
      })

      await checkout.handleConfirmTransition()

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(checkout.checkoutStep.value).toBe('preview')
      // The blocked confirm screen's preview is refreshed to the real,
      // current transaction rather than the stale pre-cancellation one.
      expect(checkout.previewData.value?.cost_today_cents).toBe(1600)

      // Retry, now that the reactivation banner (driven by the refreshed
      // previewData) is showing and the charge has been consented to.
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 1600
      })
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-retry-active-to-cancelled'
      })

      await checkout.handleConfirmTransition(true)

      expect(mockSubscribe).toHaveBeenCalledWith(
        'standard-yearly',
        expect.objectContaining({ confirmReactivation: true })
      )
      expect(checkout.checkoutStep.value).toBe('success')
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
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'resubscribe',
        stage: 'succeeded',
        outcome: 'success',
        source: 'pricing_dialog',
        payment_intent_source: 'subscribe_to_run'
      })
    })

    it('shows error toast on failure', async () => {
      const checkout = await setup()
      mockResubscribe.mockRejectedValueOnce(
        new Error('Resubscribe failed for person@example.com')
      )

      await checkout.handleResubscribe()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Resubscribe failed for person@example.com'
        })
      )
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'resubscribe',
        stage: 'failed',
        outcome: 'failure',
        source: 'pricing_dialog',
        payment_intent_source: undefined,
        failure_category: 'unknown'
      })
    })

    it('does not report checkout launch as terminal legacy success', async () => {
      mockShouldUseWorkspaceBilling.value = false
      mockResubscribe.mockResolvedValueOnce(undefined)
      const checkout = await setup('subscribe_to_run')

      await checkout.handleResubscribe()

      expect(mockResubscribe).toHaveBeenCalledOnce()
      expect(mockTrackResubscribeClicked).toHaveBeenCalledOnce()
      expect(mockTrackBillingEvent).not.toHaveBeenCalled()
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
