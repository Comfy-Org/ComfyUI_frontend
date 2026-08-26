import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, reactive } from 'vue'

import type { PaymentIntentSource } from '@/platform/telemetry/types'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import type {
  Plan,
  PreviewSubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import type { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

import { findPlanSlug } from './useSubscriptionCheckout'

type SubscriptionActionOperation = NonNullable<
  ReturnType<typeof useBillingOperationStore>['subscriptionActionOperation']
>
type MockSubscriptionActionOperation = Partial<SubscriptionActionOperation> &
  Pick<SubscriptionActionOperation, 'status' | 'workspaceId'>

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

function errorWithCode(code: string, message = 'error') {
  return Object.assign(new Error(message), { code })
}

interface ReactivationPreviewPlanInput {
  slug: string
  tier: PreviewSubscribeResponse['new_plan']['tier']
  duration: PreviewSubscribeResponse['new_plan']['duration']
  priceCents: number
  creditsCents: number
  periodEnd: string
}

interface ReactivationPreviewInput {
  effectiveAt: string
  costTodayCents: number
  costNextPeriodCents: number
  creditsTodayCents: number
  creditsNextPeriodCents: number
  currentPlan: ReactivationPreviewPlanInput
  newPlan: ReactivationPreviewPlanInput
}

function makeReactivationAuthorityPreview({
  effectiveAt,
  costTodayCents,
  costNextPeriodCents,
  creditsTodayCents,
  creditsNextPeriodCents,
  currentPlan,
  newPlan
}: ReactivationPreviewInput): PreviewSubscribeResponse {
  const makePlan = ({
    slug,
    tier,
    duration,
    priceCents,
    creditsCents,
    periodEnd
  }: ReactivationPreviewPlanInput): PreviewSubscribeResponse['new_plan'] => ({
    slug,
    tier,
    duration,
    price_cents: priceCents,
    credits_cents: creditsCents,
    period_end: periodEnd,
    seat_summary: {
      seat_count: 1,
      total_cost_cents: priceCents,
      total_credits_cents: creditsCents
    }
  })

  return {
    allowed: true,
    transition_type: 'upgrade',
    effective_at: effectiveAt,
    is_immediate: true,
    cost_today_cents: costTodayCents,
    cost_next_period_cents: costNextPeriodCents,
    credits_today_cents: creditsTodayCents,
    credits_next_period_cents: creditsNextPeriodCents,
    proration_at: '2026-07-30T00:00:00Z',
    requires_reactivation_confirmation: true,
    current_plan: makePlan(currentPlan),
    new_plan: makePlan(newPlan)
  }
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
  mockOpen,
  mockGetBillingStatus,
  mockGetPaymentPortalUrl,
  mockPlans,
  mockResubscribe,
  mockToastAdd,
  mockStartOperation,
  mockRetryPaymentAuthentication,
  mockGetOperation,
  mockSubscriptionActionOperation,
  mockListSavedPaymentMethods,
  mockTrackBeginCheckout,
  mockTrackBillingEvent,
  mockShowDowngradeToPersonalDialog,
  mockUserId,
  mockIsTeamPlan,
  mockShouldUseWorkspaceBilling,
  mockIncompleteEmbeddedPreview,
  mockSetActiveWorkspaceIdImpl,
  mockSetActiveWorkspaceId,
  mockPermissions,
  mockCapabilities,
  mockSubscription
} = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockPreviewSubscribe: vi.fn(),
  mockFetchPlans: vi.fn(),
  mockFetchStatus: vi.fn(),
  mockFetchBalance: vi.fn(),
  mockOpen: vi.fn(),
  mockGetBillingStatus: vi.fn(),
  mockGetPaymentPortalUrl: vi.fn(),
  mockPlans: { value: [] as Plan[] },
  mockResubscribe: vi.fn(),
  mockToastAdd: vi.fn(),
  mockStartOperation: vi.fn(),
  mockRetryPaymentAuthentication: vi.fn(),
  mockGetOperation: vi.fn(),
  mockSubscriptionActionOperation: {
    value: undefined as MockSubscriptionActionOperation | undefined
  },
  mockListSavedPaymentMethods: vi.fn(),
  mockTrackBeginCheckout: vi.fn(),
  mockTrackBillingEvent: vi.fn(),
  mockShowDowngradeToPersonalDialog: vi.fn(),
  mockUserId: { value: 'user-1' as string | null },
  mockIsTeamPlan: { value: false },
  mockShouldUseWorkspaceBilling: { value: true },
  mockIncompleteEmbeddedPreview: { value: false },
  mockSetActiveWorkspaceIdImpl: {
    value: undefined as ((workspaceId: string) => void) | undefined
  },
  mockSetActiveWorkspaceId: vi.fn<(workspaceId: string) => void>(
    (workspaceId) => {
      mockSetActiveWorkspaceIdImpl.value?.(workspaceId)
    }
  ),
  mockPermissions: {
    value: {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
  },
  mockCapabilities: {
    value: {
      canSubscribeSelfServe: true,
      canReactivate: true,
      canChangeSeats: true,
      canDowngradeToPersonal: true
    }
  },
  mockSubscription: { value: null as { isCancelled: boolean } | null }
}))

async function previewSubscribe(...args: unknown[]) {
  const response = await mockPreviewSubscribe(...args)
  const reactivationDescriptor = Object.getOwnPropertyDescriptor(
    response,
    'requires_reactivation_confirmation'
  )
  if (
    !response.allowed ||
    mockIncompleteEmbeddedPreview.value ||
    (reactivationDescriptor?.enumerable &&
      response.requires_reactivation_confirmation !== undefined)
  ) {
    return response
  }
  Object.defineProperty(response, 'requires_reactivation_confirmation', {
    configurable: true,
    value: mockSubscription.value?.isCancelled ?? false
  })
  return response
}

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscribe: mockSubscribe,
    previewSubscribe,
    plans: mockPlans,
    fetchPlans: mockFetchPlans,
    fetchStatus: mockFetchStatus,
    fetchBalance: mockFetchBalance,
    isTeamPlan: computed(() => mockIsTeamPlan.value),
    resubscribe: mockResubscribe,
    subscription: {
      get value() {
        return mockSubscription.value
      }
    }
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

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

vi.mock('@/platform/workspace/composables/useBillingCapabilities', () => ({
  useBillingCapabilities: () => ({
    canSubscribeSelfServe: {
      get value() {
        return mockCapabilities.value.canSubscribeSelfServe
      }
    },
    canReactivate: {
      get value() {
        return mockCapabilities.value.canReactivate
      }
    },
    canChangeSeats: {
      get value() {
        return mockCapabilities.value.canChangeSeats
      }
    },
    canDowngradeToPersonal: {
      get value() {
        return mockCapabilities.value.canDowngradeToPersonal
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
  workspaceApi: {
    resubscribe: mockResubscribe,
    listSavedPaymentMethods: mockListSavedPaymentMethods,
    getBillingStatus: mockGetBillingStatus,
    getPaymentPortalUrl: mockGetPaymentPortalUrl
  },
  WorkspaceApiError: class WorkspaceApiError extends Error {
    constructor(
      message: string,
      public readonly status?: number,
      public readonly code?: string
    ) {
      super(message)
      this.name = 'WorkspaceApiError'
    }
  }
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({
    startOperation: mockStartOperation,
    retryPaymentAuthentication: mockRetryPaymentAuthentication,
    getOperation: mockGetOperation,
    get subscriptionActionOperation() {
      return mockSubscriptionActionOperation.value
    }
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', async () => {
  const { ref } = await import('vue')
  const activeWorkspaceId = ref('workspace-1')
  mockSetActiveWorkspaceIdImpl.value = (workspaceId) => {
    activeWorkspaceId.value = workspaceId
  }
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
const mockTrackMonthlySubscriptionSucceeded = vi.hoisted(() => vi.fn())

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackBillingEvent: mockTrackBillingEvent,
    trackResubscribeClicked: mockTrackResubscribeClicked,
    trackBeginCheckout: mockTrackBeginCheckout,
    trackMonthlySubscriptionSucceeded: mockTrackMonthlySubscriptionSucceeded
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => reactive({ userId: computed(() => mockUserId.value) }),
  AuthStoreError: class AuthStoreError extends Error {
    readonly status: number | undefined
    constructor(message: string, status?: number) {
      super(message)
      this.name = 'AuthStoreError'
      this.status = status
    }
  }
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
  const scopes: ReturnType<typeof effectScope>[] = []

  async function setup(
    paymentIntentSource?: PaymentIntentSource,
    tierPlanType: 'personal' | 'team' = 'personal',
    embeddedCheckoutEnabled = true
  ) {
    const { useSubscriptionCheckout } =
      await import('./useSubscriptionCheckout')
    const scope = effectScope()
    scopes.push(scope)
    return scope.run(() =>
      useSubscriptionCheckout(emit as never, paymentIntentSource, {
        tierPlanType,
        embeddedCheckoutEnabled
      })
    )!
  }

  async function setupWithApprovedPreview(
    paymentIntentSource?: PaymentIntentSource
  ) {
    const checkout = await setup(paymentIntentSource)
    checkout.previewData.value = {
      allowed: true,
      transition_type: 'new_subscription',
      requires_reactivation_confirmation: false
    } as PreviewSubscribeResponse
    checkout.quoteIsCurrent.value = true
    return checkout
  }

  async function submitRejectedPreview(code: string, message = 'error') {
    const checkout = await setup()
    mockPreviewSubscribe.mockRejectedValueOnce(errorWithCode(code, message))
    await checkout.handleSubscribeClick({
      tierKey: 'standard',
      billingCycle: 'yearly'
    })
    return checkout
  }

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockSubscribe.mockReset()
    mockPreviewSubscribe.mockReset()
    mockFetchPlans.mockReset()
    mockFetchStatus.mockReset()
    mockStartOperation.mockReset()
    mockRetryPaymentAuthentication.mockReset()
    mockListSavedPaymentMethods.mockReset()
    mockSubscriptionActionOperation.value = undefined
    mockPlans.value = allPlans()
    mockFetchPlans.mockResolvedValue(undefined)
    mockPreviewSubscribe.mockResolvedValue({
      allowed: true,
      transition_type: 'new_subscription',
      is_immediate: true,
      requires_reactivation_confirmation: false
    })
    mockStartOperation.mockResolvedValue({
      status: 'succeeded',
      workspaceId: 'workspace-1'
    })
    mockListSavedPaymentMethods.mockResolvedValue([])
    mockGetOperation.mockReturnValue(undefined)
    mockShowDowngradeToPersonalDialog.mockResolvedValue(null)
    mockUserId.value = 'user-1'
    mockIsTeamPlan.value = false
    mockOpen.mockReturnValue({} as Window)
    mockGetBillingStatus.mockResolvedValue({ billing_status: 'paid' })
    mockGetPaymentPortalUrl.mockResolvedValue({
      url: 'https://billing.stripe.com/portal'
    })
    vi.stubGlobal('location', {
      href: 'https://app.test/subscribe?invite=secret#token',
      origin: 'https://app.test',
      pathname: '/subscribe'
    })
    vi.stubGlobal('open', mockOpen)
    mockShouldUseWorkspaceBilling.value = true
    mockIncompleteEmbeddedPreview.value = false
    mockSetActiveWorkspaceId('workspace-1')
    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    mockCapabilities.value = {
      canSubscribeSelfServe: true,
      canReactivate: true,
      canChangeSeats: true,
      canDowngradeToPersonal: true
    }
    mockSubscription.value = null
    sessionStorage.clear()
    emit = vi.fn()
  })

  afterEach(() => {
    for (const scope of scopes.splice(0)) scope.stop()
  })

  describe('handleSubscribeClick', () => {
    it('keeps embedded endpoints and request fields unreachable while disabled', async () => {
      const checkout = await setup(undefined, 'personal', false)

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })
      checkout.invalidateQuote()
      expect(await checkout.applyPromotionCode('SAVE20')).toBe(false)
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-legacy'
      })

      await checkout.handleConfirmTransition()

      expect(mockListSavedPaymentMethods).not.toHaveBeenCalled()
      expect(mockPreviewSubscribe).toHaveBeenCalledOnce()
      expect(mockPreviewSubscribe).toHaveBeenCalledWith('standard-yearly')
      expect(mockSubscribe).toHaveBeenCalledWith(
        'standard-yearly',
        expect.not.objectContaining({
          confirmationToken: expect.anything(),
          promotionCode: expect.anything(),
          quoteId: expect.anything(),
          quoteVersion: expect.anything(),
          savedPaymentMethodId: expect.anything()
        })
      )
      expect(mockSubscribe).toHaveBeenCalledWith(
        'standard-yearly',
        expect.objectContaining({
          returnUrl: 'https://platform.comfy.org/payment/success'
        })
      )
    })

    it('selects the backend default saved payment method', async () => {
      const checkout = await setup()
      mockListSavedPaymentMethods.mockResolvedValueOnce([
        {
          type: 'card',
          id: 'pm_first',
          brand: 'visa',
          last4: '1111',
          is_default: false
        },
        {
          type: 'alipay',
          id: 'pm_default',
          is_default: true
        }
      ])

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(checkout.selectedSavedPaymentMethodId.value).toBe('pm_default')
    })

    it('collects a new method when the backend has no default', async () => {
      const checkout = await setup()
      mockListSavedPaymentMethods.mockResolvedValueOnce([
        {
          type: 'card',
          id: 'pm_first',
          brand: 'visa',
          last4: '1111',
          is_default: false
        }
      ])

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(checkout.selectedSavedPaymentMethodId.value).toBeNull()
    })

    it('previews a promotion only after Apply and submits the exact quote', async () => {
      const checkout = await setup()
      mockListSavedPaymentMethods.mockResolvedValueOnce([
        {
          type: 'card',
          id: 'pm_saved',
          brand: 'visa',
          last4: '4242',
          is_default: true
        }
      ])
      mockPreviewSubscribe
        .mockResolvedValueOnce({
          allowed: true,
          transition_type: 'new_subscription'
        })
        .mockResolvedValueOnce({
          allowed: true,
          transition_type: 'new_subscription',
          promotion_code: 'SAVE20',
          quote_id: 'quote_123',
          quote_version: 2,
          amount_due_cents: 1280,
          currency: 'usd',
          renewal_amount_cents: 1600,
          renewal_at: '2027-06-19T00:00:00Z'
        })

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })
      expect(mockPreviewSubscribe).toHaveBeenCalledOnce()

      await checkout.applyPromotionCode(' SAVE20 ')
      expect(mockPreviewSubscribe).toHaveBeenLastCalledWith('standard-yearly', {
        promotionCode: 'SAVE20'
      })

      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-quoted'
      })
      await checkout.handleConfirmTransition()

      expect(mockSubscribe).toHaveBeenCalledWith(
        'standard-yearly',
        expect.objectContaining({
          savedPaymentMethodId: 'pm_saved',
          promotionCode: 'SAVE20',
          quoteId: 'quote_123',
          quoteVersion: 2
        })
      )
    })

    it('does not submit an invalidated quote', async () => {
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'new_subscription',
        quote_id: 'quote_123',
        quote_version: 1,
        amount_due_cents: 1600,
        currency: 'usd'
      })
      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      checkout.invalidateQuote()
      await checkout.handleConfirmTransition()

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'subscription.preview.applyQuoteBeforeContinuing'
        })
      )
    })

    it('submits a zero-dollar quote once with its quote identity and no payment token', async () => {
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'new_subscription',
        quote_id: 'quote_free',
        quote_version: 3,
        amount_due_cents: 0,
        currency: 'usd'
      })
      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-free'
      })

      await checkout.handleConfirmTransition()

      expect(mockSubscribe).toHaveBeenCalledOnce()
      expect(mockSubscribe).toHaveBeenCalledWith(
        'standard-yearly',
        expect.objectContaining({
          quoteId: 'quote_free',
          quoteVersion: 3
        })
      )
      expect(mockSubscribe).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ confirmationToken: expect.anything() })
      )
    })

    it('omits the auto-selected saved method on a plan change', async () => {
      const checkout = await setup()
      mockListSavedPaymentMethods.mockResolvedValueOnce([
        {
          type: 'card',
          id: 'pm_saved',
          brand: 'visa',
          last4: '4242',
          is_default: true
        }
      ])
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true
      })

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-upgrade'
      })
      await checkout.handleConfirmTransition()

      expect(mockSubscribe).toHaveBeenCalledWith(
        'standard-yearly',
        expect.not.objectContaining({
          savedPaymentMethodId: expect.anything()
        })
      )
    })

    it('returns a stale quote to review with a refreshed quote', async () => {
      const checkout = await setup()
      mockPreviewSubscribe
        .mockResolvedValueOnce({
          allowed: true,
          transition_type: 'new_subscription',
          promotion_code: 'SAVE20',
          quote_id: 'quote_old',
          quote_version: 1,
          amount_due_cents: 1280,
          currency: 'usd',
          renewal_amount_cents: 1600,
          renewal_at: '2027-06-19T00:00:00Z'
        })
        .mockResolvedValueOnce({
          allowed: true,
          transition_type: 'new_subscription',
          promotion_code: 'SAVE20',
          quote_id: 'quote_new',
          quote_version: 1,
          amount_due_cents: 1280,
          currency: 'usd',
          renewal_amount_cents: 1600,
          renewal_at: '2027-06-19T00:00:00Z'
        })
      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })
      mockSubscribe.mockRejectedValueOnce(
        Object.assign(new Error('preview again'), {
          code: 'SUBSCRIPTION_QUOTE_STALE'
        })
      )

      await checkout.handleConfirmTransition()

      expect(checkout.checkoutStep.value).toBe('preview')
      expect(checkout.previewData.value?.quote_id).toBe('quote_new')
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'subscription.preview.quoteStale' })
      )
    })

    it('returns to pricing when a stale quote cannot be refreshed', async () => {
      const checkout = await setup()
      mockPreviewSubscribe
        .mockResolvedValueOnce({
          allowed: true,
          transition_type: 'new_subscription',
          quote_id: 'quote_old',
          quote_version: 1,
          amount_due_cents: 1600,
          currency: 'usd'
        })
        .mockRejectedValueOnce(new Error('Preview unavailable'))
      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })
      mockSubscribe.mockRejectedValueOnce(
        errorWithCode('SUBSCRIPTION_QUOTE_STALE')
      )

      await checkout.handleConfirmTransition()

      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(checkout.previewData.value).toBeNull()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'subscription.preview.quoteRefreshFailed'
        })
      )
    })

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

    it('uses the backend reactivation decision instead of stale status', async () => {
      mockSubscription.value = { isCancelled: true }
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        requires_reactivation_confirmation: false,
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
      })
      const checkout = await setup()

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(checkout.reactivationRequired.value).toBe(false)
    })

    it('fails closed when an embedded preview omits the reactivation decision', async () => {
      mockIncompleteEmbeddedPreview.value = true
      mockPreviewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'new_subscription',
        is_immediate: true
      })
      const checkout = await setup()

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(checkout.reactivationRequired.value).toBe(true)

      await checkout.handleConfirmTransition()

      expect(checkout.reactivationRequired.value).toBe(false)
      expect(checkout.checkoutStep.value).toBe('pricing')
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

    it.for([
      ['SUBSCRIPTION_PAYMENT_REQUIRED', null],
      ['OUTSTANDING_PAYMENT_REQUIRED', null],
      ['TRANSITION_NOT_ALLOWED', 'payment_failed']
    ] as const)(
      'routes %s previews to the billing portal',
      async ([code, status]) => {
        if (status) {
          mockGetBillingStatus.mockResolvedValueOnce({ billing_status: status })
        }
        await submitRejectedPreview(code)
        expect(mockGetBillingStatus).toHaveBeenCalledTimes(status ? 1 : 0)
        expect(mockGetPaymentPortalUrl).toHaveBeenCalledWith(
          'https://app.test/subscribe'
        )
        expect(mockOpen).toHaveBeenCalledWith(
          'https://billing.stripe.com/portal',
          '_blank'
        )
        expect(globalThis.location.href).toBe(
          'https://app.test/subscribe?invite=secret#token'
        )
        expect(mockFetchStatus).not.toHaveBeenCalled()

        window.dispatchEvent(new Event('focus'))
        await vi.waitFor(() => expect(mockFetchStatus).toHaveBeenCalledOnce())
        window.dispatchEvent(new Event('focus'))
        expect(mockFetchStatus).toHaveBeenCalledOnce()
      }
    )

    it('preserves the checkout when the billing portal popup is blocked', async () => {
      mockOpen.mockReturnValueOnce(null)
      const checkout = await submitRejectedPreview(
        'SUBSCRIPTION_PAYMENT_REQUIRED'
      )

      expect(checkout.selectedTierKey.value).toBe('standard')
      expect(globalThis.location.href).toBe(
        'https://app.test/subscribe?invite=secret#token'
      )
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warn',
          detail: 'subscription.preview.paymentPopupBlocked'
        })
      )
    })

    it('keeps the original error path for non-payment transition failures', async () => {
      await submitRejectedPreview(
        'TRANSITION_NOT_ALLOWED',
        'Plan change is unavailable'
      )
      expect(mockGetPaymentPortalUrl).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'Plan change is unavailable' })
      )
    })

    it('shows the portal error when payment recovery cannot open', async () => {
      mockGetPaymentPortalUrl.mockRejectedValueOnce(
        new Error('Portal unavailable')
      )
      await submitRejectedPreview('SUBSCRIPTION_PAYMENT_REQUIRED')
      expect(globalThis.location.href).toBe(
        'https://app.test/subscribe?invite=secret#token'
      )
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'Portal unavailable' })
      )
    })

    it.for([
      undefined,
      '',
      'javascript:alert(1)',
      'https://billing.stripe.com.evil.test/portal'
    ])('rejects an unsafe billing portal URL: %s', async (url) => {
      mockGetPaymentPortalUrl.mockResolvedValueOnce({ url })
      await submitRejectedPreview('SUBSCRIPTION_PAYMENT_REQUIRED')
      expect(globalThis.location.href).toBe(
        'https://app.test/subscribe?invite=secret#token'
      )
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'toastMessages.failedToAccessBillingPortal'
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
      mockCapabilities.value = {
        canSubscribeSelfServe: false,
        canReactivate: false,
        canChangeSeats: false,
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

    it('does not preview a plan when the server denies checkout to a client-side owner', async () => {
      mockCapabilities.value.canSubscribeSelfServe = false
      mockCapabilities.value.canChangeSeats = false
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
      mockCapabilities.value.canDowngradeToPersonal = false
      const checkout = await setup()

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(mockShowDowngradeToPersonalDialog).not.toHaveBeenCalled()
      expect(mockPreviewSubscribe).not.toHaveBeenCalled()
      expect(checkout.checkoutStep.value).toBe('pricing')
    })

    it('does not start the Team-to-personal downgrade when the server denies it to a client-side owner', async () => {
      mockIsTeamPlan.value = true
      mockCapabilities.value.canDowngradeToPersonal = false
      const checkout = await setup()

      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })

      expect(mockShowDowngradeToPersonalDialog).not.toHaveBeenCalled()
      expect(mockPreviewSubscribe).not.toHaveBeenCalled()
      expect(checkout.checkoutStep.value).toBe('pricing')
    })

    it('allows a promoted owner to preview a legacy Team-plan change', async () => {
      mockIsTeamPlan.value = true
      mockPermissions.value.canDowngradeToPersonal = false
      mockCapabilities.value.canDowngradeToPersonal = false
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

    it('does not duplicate telemetry owned by the Team downgrade orchestration', async () => {
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
      expect(mockTrackBillingEvent).not.toHaveBeenCalled()
    })
  })

  describe('handleSubscribeTeamClick', () => {
    const teamStop = {
      id: 'team_1400',
      usd: 1400,
      credits: 295_400,
      discountedUsd: 1295
    }

    async function startTeamPaymentRecovery() {
      mockPreviewSubscribe.mockRejectedValueOnce(
        errorWithCode('SUBSCRIPTION_PAYMENT_REQUIRED')
      )
      const checkout = await setup()
      const selection = checkout.handleSubscribeTeamClick({
        stop: teamStop,
        billingCycle: 'monthly',
        isChange: true
      })
      return { checkout, selection }
    }

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
      expect(checkout.previewData.value?.transition_type).toBe(
        'new_subscription'
      )
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
        { teamCreditStopId: 'team_1400' }
      )
      expect(checkout.previewData.value).toStrictEqual(transition)
    })

    it('does not expose Team confirmation until its preview resolves', async () => {
      let resolvePreview!: (preview: Partial<PreviewSubscribeResponse>) => void
      mockPreviewSubscribe.mockImplementationOnce(
        () =>
          new Promise<Partial<PreviewSubscribeResponse>>((resolve) => {
            resolvePreview = resolve
          })
      )
      const checkout = await setup()

      const selectionPromise = checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_1400',
          usd: 1400,
          credits: 295_400,
          discountedUsd: 1295
        },
        billingCycle: 'monthly',
        isChange: true
      })

      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(checkout.isLoadingPreview.value).toBe(true)
      await checkout.handleTeamSubscribe()
      expect(mockSubscribe).not.toHaveBeenCalled()

      resolvePreview({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 105_000
      })
      await selectionPromise

      expect(checkout.isLoadingPreview.value).toBe(false)
      expect(checkout.checkoutStep.value).toBe('preview')
      expect(checkout.previewVariant.value).toBe('team-change')
    })

    it('does not expose payment collection while a new Team preview loads', async () => {
      mockPreviewSubscribe.mockImplementationOnce(() => new Promise(() => {}))
      const checkout = await setup()

      void checkout.handleSubscribeTeamClick({
        stop: teamStop,
        billingCycle: 'monthly',
        isChange: false
      })

      expect(checkout.previewVariant.value).toBe('team-new')
      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(checkout.isLoadingPreview.value).toBe(true)
    })

    it('discards a Team preview for a superseded stop and cycle', async () => {
      let resolveStalePreview!: (
        preview: Partial<PreviewSubscribeResponse>
      ) => void
      mockPreviewSubscribe
        .mockImplementationOnce(
          () =>
            new Promise<Partial<PreviewSubscribeResponse>>((resolve) => {
              resolveStalePreview = resolve
            })
        )
        .mockResolvedValueOnce({
          allowed: true,
          transition_type: 'downgrade',
          is_immediate: false,
          cost_today_cents: 0
        })
      const checkout = await setup()

      const staleSelection = checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_1400',
          usd: 1400,
          credits: 295_400,
          discountedUsd: 1295
        },
        billingCycle: 'monthly',
        isChange: true
      })
      await checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_700',
          usd: 700,
          credits: 147_700,
          discountedUsd: 630
        },
        billingCycle: 'yearly',
        isChange: true
      })

      resolveStalePreview({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 105_000
      })
      await staleSelection

      expect(checkout.selectedTeamStop.value?.id).toBe('team_700')
      expect(checkout.selectedBillingCycle.value).toBe('yearly')
      expect(checkout.previewData.value).toMatchObject({
        transition_type: 'downgrade',
        cost_today_cents: 0
      })
      expect(checkout.isLoadingPreview.value).toBe(false)
    })

    it('ignores a stale Team payment recovery after returning to pricing', async () => {
      let resolvePortal!: (portal: { url: string }) => void
      mockGetPaymentPortalUrl.mockImplementationOnce(
        () =>
          new Promise<{ url: string }>((resolve) => {
            resolvePortal = resolve
          })
      )
      const { checkout, selection } = await startTeamPaymentRecovery()
      await vi.waitFor(() => expect(mockGetPaymentPortalUrl).toHaveBeenCalled())
      expect(checkout.isLoadingPreview.value).toBe(true)

      checkout.handleBackToPricing()
      resolvePortal({ url: 'https://billing.stripe.com/portal' })
      await selection

      expect(globalThis.location.href).toBe(
        'https://app.test/subscribe?invite=secret#token'
      )
      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(mockOpen).not.toHaveBeenCalled()
      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('returns a failed Team payment recovery to pricing', async () => {
      mockGetPaymentPortalUrl.mockRejectedValueOnce(
        new Error('Portal unavailable')
      )
      const { checkout, selection } = await startTeamPaymentRecovery()
      await selection

      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(checkout.selectedTeamStop.value).toBeNull()
      expect(mockToastAdd).toHaveBeenCalledOnce()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'Portal unavailable' })
      )
    })

    it('keeps the backend quote for a fresh subscription', async () => {
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

      expect(checkout.previewData.value?.transition_type).toBe(
        'new_subscription'
      )
    })

    it('returns to pricing when the exact preview request fails', async () => {
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
      expect(checkout.checkoutStep.value).toBe('pricing')
    })

    it('previews a fresh team subscribe for exact billing terms', async () => {
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
          teamCreditStopId: 'team_700'
        }
      )
      expect(checkout.previewData.value?.transition_type).toBe(
        'new_subscription'
      )
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
        cost_today_cents: 70_000,
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
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
          teamCreditStopId: 'team_700'
        }
      )
      expect(checkout.previewData.value).not.toBeNull()
      expect(checkout.previewVariant.value).toBe('team-change')
    })

    it('shows the reactivation preview for a cancelled Team downgrade scheduled at period end', async () => {
      mockSubscription.value = { isCancelled: true }
      const preview = {
        allowed: true,
        transition_type: 'downgrade' as const,
        is_immediate: false,
        cost_today_cents: 0,
        proration_at: '2026-07-29T12:00:00Z',
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
      }
      mockPreviewSubscribe.mockResolvedValueOnce(preview)
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

      expect(checkout.previewData.value).toEqual(preview)
      expect(checkout.previewVariant.value).toBe('team-change')
      expect(mockToastAdd).not.toHaveBeenCalled()

      mockPreviewSubscribe.mockResolvedValueOnce({
        ...preview,
        proration_at: '2026-07-29T12:01:00Z'
      })
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-team-scheduled-reactivation'
      })
      await checkout.handleTeamSubscribe(true)

      expect(mockSubscribe).toHaveBeenCalledWith(
        'team_per_credit_monthly',
        expect.objectContaining({
          confirmReactivation: true,
          prorationAt: undefined
        })
      )
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

    it('uses the backend reactivation decision when cached team status is cancelled', async () => {
      mockSubscription.value = { isCancelled: true }
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'new_subscription',
        is_immediate: true,
        requires_reactivation_confirmation: false
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

      expect(checkout.checkoutStep.value).toBe('preview')
      expect(checkout.previewVariant.value).toBe('team-new')
      expect(checkout.reactivationRequired.value).toBe(false)
      expect(mockToastAdd).not.toHaveBeenCalled()
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
      mockCapabilities.value.canChangeSeats = false
      mockCapabilities.value.canSubscribeSelfServe = false
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

    it('does not prepare a team checkout when the server denies seat changes to a client-side owner', async () => {
      mockCapabilities.value.canChangeSeats = false
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
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'new_subscription',
        is_immediate: true
      })

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
    it('fires a started event before subscribing', async () => {
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

      await checkout.handleTeamSubscribe()

      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'subscription_checkout',
        stage: 'started',
        outcome: 'pending',
        tier: 'team',
        cycle: 'monthly',
        checkout_type: 'new',
        payment_intent_source: undefined
      })
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'operation',
        stage: 'started',
        outcome: 'pending',
        operation_type: 'subscription',
        tier: 'team',
        cycle: 'monthly',
        checkout_type: 'new',
        payment_intent_source: undefined
      })
    })

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
        returnUrl: 'https://app.test/subscribe',
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

    it('keeps the quoted Team charge when fresh material state is unchanged', async () => {
      mockSubscription.value = { isCancelled: true }
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        promotion_code: 'SAVE20',
        is_immediate: true,
        cost_today_cents: 105_000,
        credits_today_cents: 221_550,
        proration_at: '2026-07-29T12:00:00Z',
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
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
        promotion_code: 'SAVE20',
        is_immediate: true,
        cost_today_cents: 104_999,
        credits_today_cents: 221_548,
        proration_at: '2026-07-29T12:05:00Z',
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
      })
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-team-quoted-reactivation'
      })

      await checkout.handleTeamSubscribe(true)

      expect(mockPreviewSubscribe).toHaveBeenCalledTimes(2)
      expect(mockPreviewSubscribe).toHaveBeenLastCalledWith(
        'team_per_credit_monthly',
        expect.objectContaining({ promotionCode: 'SAVE20' })
      )
      expect(mockSubscribe).toHaveBeenCalledWith(
        'team_per_credit_monthly',
        expect.objectContaining({
          confirmReactivation: true,
          prorationAt: '2026-07-29T12:00:00Z'
        })
      )
    })

    it('blocks a quoted Team charge when material preview state changed', async () => {
      mockSubscription.value = { isCancelled: true }
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 105_000,
        credits_next_period_cents: 295_400,
        proration_at: '2026-07-29T12:00:00Z',
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
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
        cost_today_cents: 105_000,
        credits_next_period_cents: 300_000,
        proration_at: '2026-07-29T12:05:00Z',
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
      })

      await checkout.handleTeamSubscribe(true)

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(checkout.previewData.value?.credits_next_period_cents).toBe(
        300_000
      )
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'subscription.preview.reactivation.confirmationRequired'
        })
      )
    })

    it('refreshes an expired Team quote and submits only after reconfirmation', async () => {
      mockSubscription.value = { isCancelled: true }
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 105_000,
        proration_at: '2026-07-29T12:00:00Z',
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
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
        cost_today_cents: 104_999,
        proration_at: '2026-07-29T12:14:00Z',
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
      })
      mockSubscribe.mockRejectedValueOnce(
        Object.assign(new Error('Quote expired'), {
          code: 'PRORATION_QUOTE_EXPIRED'
        })
      )
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 105_000,
        proration_at: '2026-07-29T12:16:00Z',
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
      })

      await checkout.handleTeamSubscribe(true)

      expect(mockSubscribe).toHaveBeenCalledTimes(1)
      expect(checkout.previewData.value?.proration_at).toBe(
        '2026-07-29T12:16:00Z'
      )
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'subscription.preview.reactivation.confirmationRequired'
        })
      )
      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'subscription_checkout',
          stage: 'failed',
          outcome: 'failure',
          tier: 'team'
        })
      )

      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-team-refreshed-quote'
      })
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 104_999,
        proration_at: '2026-07-29T12:16:05Z',
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
      })
      await checkout.handleTeamSubscribe(true)

      expect(mockSubscribe).toHaveBeenLastCalledWith(
        'team_per_credit_monthly',
        expect.objectContaining({
          confirmReactivation: true,
          prorationAt: '2026-07-29T12:16:00Z'
        })
      )
      expect(checkout.checkoutStep.value).toBe('success')
    })

    it('blocks the team subscribe and shows an error for a cancelled subscription with no confirmation', async () => {
      mockSubscription.value = { isCancelled: true }
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        requires_reactivation_confirmation: true,
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
      })
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
      // Regression guard: this reactivation-consent guard is not a checkout
      // attempt, so it must not open a funnel entry no terminal event will
      // ever close.
      expect(mockTrackBillingEvent).not.toHaveBeenCalled()
    })

    it('refuses to bill a team reactivation when a fresh preview no longer matches the confirmed charge', async () => {
      mockSubscription.value = { isCancelled: true }
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 105_000,
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
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
        cost_today_cents: 120_000,
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
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
        cost_today_cents: 120_000,
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
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
      expect(mockTrackBillingEvent).not.toHaveBeenCalled()
    })

    it('bounces to pricing when a required reactivation refresh cannot collect consent', async () => {
      mockSubscription.value = { isCancelled: false }
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 105_000,
        requires_reactivation_confirmation: true,
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
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

      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
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

    it('recovers when the subscribe authority sees a cancellation omitted by the status read', async () => {
      mockSubscription.value = { isCancelled: false }
      const checkout = await setup()
      const preview = makeReactivationAuthorityPreview({
        effectiveAt: '2026-08-30T00:00:00Z',
        costTodayCents: 18_999,
        costNextPeriodCents: 39_000,
        creditsTodayCents: 42_200,
        creditsNextPeriodCents: 84_400,
        currentPlan: {
          slug: 'team_per_credit_monthly',
          tier: 'TEAM',
          duration: 'MONTHLY',
          priceCents: 20_000,
          creditsCents: 42_200,
          periodEnd: '2026-08-29T00:00:00Z'
        },
        newPlan: {
          slug: 'team_per_credit_monthly',
          tier: 'TEAM',
          duration: 'MONTHLY',
          priceCents: 39_000,
          creditsCents: 84_400,
          periodEnd: '2026-08-30T00:00:00Z'
        }
      })
      mockPreviewSubscribe.mockResolvedValueOnce({
        ...preview,
        requires_reactivation_confirmation: false
      })
      await checkout.handleSubscribeTeamClick({
        stop: {
          id: 'team_400',
          usd: 400,
          credits: 84_400,
          discountedUsd: 390
        },
        billingCycle: 'monthly',
        isChange: true
      })

      mockSubscribe.mockRejectedValueOnce(
        Object.assign(new Error('reactivation confirmation required'), {
          code: 'REACTIVATION_CONFIRMATION_REQUIRED'
        })
      )
      mockPreviewSubscribe.mockResolvedValueOnce(preview)

      await checkout.handleTeamSubscribe()

      expect(checkout.reactivationRequired.value).toBe(true)
      expect(checkout.previewData.value).toStrictEqual(preview)
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'subscription.preview.reactivation.confirmationRequired'
        })
      )
      expect(mockTrackBillingEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'failed' })
      )

      mockPreviewSubscribe.mockResolvedValueOnce(preview)
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-team-authoritative-reactivation'
      })

      await checkout.handleTeamSubscribe(true)

      expect(mockSubscribe).toHaveBeenLastCalledWith(
        'team_per_credit_monthly',
        expect.objectContaining({
          confirmReactivation: true,
          prorationAt: '2026-07-30T00:00:00Z'
        })
      )
      expect(checkout.checkoutStep.value).toBe('success')
      expect(
        mockTrackBillingEvent.mock.calls.filter(
          ([event]) =>
            event.operation === 'subscription_checkout' &&
            event.stage === 'started'
        )
      ).toHaveLength(1)
      expect(
        mockTrackBillingEvent.mock.calls.filter(
          ([event]) =>
            event.operation === 'operation' && event.stage === 'started'
        )
      ).toHaveLength(1)
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
        failure_category: 'unknown',
        duration_ms: expect.any(Number)
      })
    })

    it('does not submit a team change when the required quote fails', async () => {
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
      await checkout.handleTeamSubscribe()

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'not supported' })
      )
    })

    it('refreshes a required team reactivation before submit and lets a retry succeed', async () => {
      mockSubscription.value = { isCancelled: false }
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 105_000,
        requires_reactivation_confirmation: true,
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
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

      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 110_000,
        requires_reactivation_confirmation: true,
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
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
        cost_today_cents: 110_000,
        requires_reactivation_confirmation: true,
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
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
        opId: 'op-recovered-3ds',
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

    it('surfaces and retries recovered failed authentication', async () => {
      mockSubscriptionActionOperation.value = {
        opId: 'op-recovered-3ds',
        status: 'pending',
        workspaceId: 'workspace-1',
        authenticationState: 'failed_retryable',
        errorMessage: 'Challenge was closed',
        canRetryAuthentication: true,
        isAuthenticating: false
      }
      mockRetryPaymentAuthentication.mockResolvedValue(true)

      const checkout = await setup()

      expect(checkout.authenticationState.value).toBe('failed_retryable')
      expect(checkout.authenticationError.value).toBe('Challenge was closed')
      expect(checkout.canRetryAuthentication.value).toBe(true)
      expect(checkout.isPolling.value).toBe(false)

      await checkout.retryPaymentAuthentication()
      expect(mockRetryPaymentAuthentication).toHaveBeenCalledWith(
        'op-recovered-3ds'
      )
    })

    it('surfaces an operation that needs reconciliation', async () => {
      mockSubscriptionActionOperation.value = {
        opId: 'op-reconciliation',
        status: 'reconciliation_needed',
        workspaceId: 'workspace-1'
      }

      const checkout = await setup()

      expect(checkout.reconciliationOperationId.value).toBe('op-reconciliation')
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
      const checkout = await setupWithApprovedPreview()
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

    it('keeps the confirmation open while a submit is in flight', async () => {
      const checkout = await setup()
      checkout.checkoutStep.value = 'preview'
      checkout.isSubscribing.value = true

      checkout.handleBackToPricing()

      expect(checkout.checkoutStep.value).toBe('preview')
    })

    it('does not apply an operation result after switching workspaces', async () => {
      const checkout = await setupWithApprovedPreview()
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

  describe('busy continuity through checkout', () => {
    async function startPendingCheckout(operation: Record<string, unknown>) {
      const checkout = await setupWithApprovedPreview()
      checkout.checkoutStep.value = 'preview'
      checkout.selectedTierKey.value = 'standard'
      mockSubscribe.mockResolvedValueOnce({
        status: 'pending_payment',
        billing_op_id: 'op-busy'
      })
      mockGetOperation.mockImplementation((opId) =>
        opId === 'op-busy' ? operation : undefined
      )
      let resolveOperation!: (operation: {
        status: string
        workspaceId: string
      }) => void
      mockStartOperation.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOperation = resolve
          })
      )
      const payment = checkout.handleAddCreditCard()
      await vi.waitFor(() => expect(mockStartOperation).toHaveBeenCalledOnce())
      return { checkout, payment, finish: () => resolveOperation }
    }

    it('stays busy while this tab drives the payment challenge', async () => {
      const { checkout, payment, finish } = await startPendingCheckout({
        status: 'pending',
        workspaceId: 'workspace-1',
        authenticationState: 'requires_action',
        isAuthenticating: true
      })

      expect(checkout.isPolling.value).toBe(true)

      finish()({ status: 'failed', workspaceId: 'workspace-1' })
      await payment
    })

    it('releases the confirm action while parked on a challenge the customer abandoned', async () => {
      const { checkout, payment, finish } = await startPendingCheckout({
        status: 'pending',
        workspaceId: 'workspace-1',
        authenticationState: 'requires_action',
        isAuthenticating: false
      })

      expect(checkout.isPolling.value).toBe(false)

      finish()({ status: 'failed', workspaceId: 'workspace-1' })
      await payment
    })

    it('stays busy from settlement until the success step takes over', async () => {
      const { checkout, payment, finish } = await startPendingCheckout({
        status: 'succeeded',
        workspaceId: 'workspace-1'
      })

      expect(checkout.isPolling.value).toBe(true)
      expect(checkout.checkoutStep.value).toBe('preview')

      finish()({ status: 'succeeded', workspaceId: 'workspace-1' })
      await payment
      expect(checkout.checkoutStep.value).toBe('success')
    })
  })

  describe('handleAddCreditCard', () => {
    it('fires a started event before subscribing', async () => {
      const checkout = await setupWithApprovedPreview()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-1'
      })

      await checkout.handleAddCreditCard()

      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'subscription_checkout',
        stage: 'started',
        outcome: 'pending',
        tier: 'standard',
        cycle: 'yearly',
        checkout_type: 'new',
        payment_intent_source: undefined
      })
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'operation',
        stage: 'started',
        outcome: 'pending',
        operation_type: 'subscription',
        tier: 'standard',
        cycle: 'yearly',
        checkout_type: 'new',
        payment_intent_source: undefined
      })
    })

    it('shows existing success immediately without owning post-response reconciliation', async () => {
      const checkout = await setupWithApprovedPreview()
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
        returnUrl: 'https://app.test/subscribe',
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
        billing_op_id: 'op-1',
        duration_ms: expect.any(Number)
      })
      // PostHog implements both trackBillingEvent and
      // trackMonthlySubscriptionSucceeded, so also firing the legacy event
      // here would double-count this success for it.
      expect(mockTrackMonthlySubscriptionSucceeded).not.toHaveBeenCalled()
      // Refreshed once, pre-submit, to keep the reactivation guard honest —
      // but balance reconciliation after a successful response is still not
      // this composable's job.
      expect(mockFetchStatus).toHaveBeenCalledTimes(1)
      expect(mockFetchBalance).not.toHaveBeenCalled()
    })

    it('skips begin_checkout when no user id is available', async () => {
      mockUserId.value = null
      const checkout = await setupWithApprovedPreview('subscribe_to_run')
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
      const checkout = await setupWithApprovedPreview('subscribe_to_run')
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
      const checkout = await setupWithApprovedPreview()
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
      const checkout = await setupWithApprovedPreview()
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
      expect(mockStartOperation).toHaveBeenCalledWith(
        'op-blocked',
        'subscription',
        expect.any(Object),
        'https://stripe.com/pay'
      )
      openSpy.mockRestore()
    })

    it('rejects needs_payment_method without a payment URL', async () => {
      const checkout = await setupWithApprovedPreview()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'needs_payment_method',
        billing_op_id: 'op-no-url'
      })
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      await checkout.handleAddCreditCard()

      expect(openSpy).not.toHaveBeenCalled()
      expect(mockStartOperation).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'subscription.preview.stripeUnavailable'
        })
      )
      openSpy.mockRestore()
    })

    it('advances to success once the async payment operation succeeds', async () => {
      const checkout = await setupWithApprovedPreview()
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
          paymentIntentSource: undefined,
          attemptStartedAt: expect.any(Number),
          suppressProcessingToast: true,
          autoHandleRequiresAction: true
        },
        'https://stripe.com/pay'
      )
      expect(checkout.checkoutStep.value).toBe('success')
      openSpy.mockRestore()
    })

    it('stays on the confirm step when the async operation does not succeed', async () => {
      const checkout = await setupWithApprovedPreview()
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
          paymentIntentSource: undefined,
          attemptStartedAt: expect.any(Number),
          suppressProcessingToast: true,
          autoHandleRequiresAction: true
        }
      )
      expect(checkout.checkoutStep.value).toBe('preview')
    })

    it('persists the pending attempt until its operation becomes terminal', async () => {
      const checkout = await setupWithApprovedPreview()
      checkout.selectedTierKey.value = 'creator'
      checkout.selectedBillingCycle.value = 'monthly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'pending_payment',
        billing_op_id: 'op-alipay'
      })
      let resolveOperation!: (operation: {
        status: 'failed'
        workspaceId: string
      }) => void
      mockStartOperation.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOperation = resolve
          })
      )

      const payment = checkout.handleAddCreditCard()
      await vi.waitFor(() => {
        expect(
          JSON.parse(
            sessionStorage.getItem('comfy:pending-subscription-checkout') ??
              'null'
          )
        ).toMatchObject({
          operationId: 'op-alipay',
          workspaceId: 'workspace-1',
          selection: {
            planMode: 'personal',
            tierKey: 'creator',
            billingCycle: 'monthly'
          }
        })
      })

      resolveOperation({ status: 'failed', workspaceId: 'workspace-1' })
      await payment

      expect(
        sessionStorage.getItem('comfy:pending-subscription-checkout')
      ).toBeNull()
    })

    it('persists pending checkout context on the legacy Stripe rail', async () => {
      mockShouldUseWorkspaceBilling.value = false
      const checkout = await setup(undefined, 'personal', false)
      checkout.selectedTierKey.value = 'creator'
      checkout.selectedBillingCycle.value = 'monthly'
      mockSubscribe.mockResolvedValueOnce({
        status: 'pending_payment',
        billing_op_id: 'op-legacy-alipay'
      })
      let resolveOperation!: (operation: {
        status: 'failed'
        workspaceId: string
      }) => void
      mockStartOperation.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOperation = resolve
          })
      )

      const payment = checkout.handleAddCreditCard()
      await vi.waitFor(() => expect(mockSubscribe).toHaveBeenCalledOnce())
      await vi.waitFor(() => {
        expect(
          JSON.parse(
            sessionStorage.getItem('comfy:pending-subscription-checkout') ??
              'null'
          )
        ).toMatchObject({
          operationId: 'op-legacy-alipay',
          workspaceId: 'workspace-1',
          ownerUid: 'user-1',
          selection: {
            planMode: 'personal',
            tierKey: 'creator',
            billingCycle: 'monthly'
          },
          attemptedAt: expect.any(Number)
        })
      })

      resolveOperation({ status: 'failed', workspaceId: 'workspace-1' })
      await payment

      expect(
        sessionStorage.getItem('comfy:pending-subscription-checkout')
      ).toBeNull()
    })

    it('shows error toast on subscribe failure', async () => {
      const checkout = await setupWithApprovedPreview()
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
        failure_category: 'unknown',
        duration_ms: expect.any(Number)
      })
    })

    it('reports an empty workspace response as a sanitized failure', async () => {
      const checkout = await setupWithApprovedPreview()
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
        error_code: 'missing_checkout_response',
        duration_ms: expect.any(Number)
      })
    })

    it('does not report an empty legacy checkout launch as failure', async () => {
      mockShouldUseWorkspaceBilling.value = false
      const checkout = await setupWithApprovedPreview()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockSubscribe.mockResolvedValueOnce(undefined)

      await checkout.handleAddCreditCard()

      expect(mockTrackBillingEvent).not.toHaveBeenCalled()
    })

    it('does not submit when workspace ownership is revoked', async () => {
      const checkout = await setupWithApprovedPreview()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      mockPermissions.value.canManageSubscription = false
      mockCapabilities.value.canChangeSeats = false
      mockCapabilities.value.canSubscribeSelfServe = false

      await checkout.handleAddCreditCard()

      expect(mockSubscribe).not.toHaveBeenCalled()
    })
  })

  describe('handleConfirmTransition', () => {
    it('transitions to success step on subscribed status', async () => {
      const checkout = await setupWithApprovedPreview()
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
      // PostHog implements both trackBillingEvent and
      // trackMonthlySubscriptionSucceeded, so also firing the legacy event
      // here would double-count this success for it.
      expect(mockTrackMonthlySubscriptionSucceeded).not.toHaveBeenCalled()
    })

    it('shows error toast on failure', async () => {
      const checkout = await setupWithApprovedPreview()
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

    it('returns to pricing when reactivation payment recovery fails', async () => {
      mockSubscription.value = { isCancelled: true }
      mockPreviewSubscribe.mockRejectedValueOnce(
        errorWithCode('SUBSCRIPTION_PAYMENT_REQUIRED')
      )
      mockGetPaymentPortalUrl.mockRejectedValueOnce(
        new Error('Portal unavailable')
      )
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'
      checkout.previewData.value = {} as never

      await checkout.handleConfirmTransition()

      expect(checkout.checkoutStep.value).toBe('pricing')
      expect(checkout.previewData.value).toBeNull()
      expect(mockSubscribe).not.toHaveBeenCalled()
    })

    it('recovers payment failure while refreshing an expired quote', async () => {
      mockSubscribe.mockRejectedValueOnce(
        errorWithCode('PRORATION_QUOTE_EXPIRED', 'Quote expired')
      )
      mockPreviewSubscribe.mockRejectedValueOnce(
        errorWithCode('SUBSCRIPTION_PAYMENT_REQUIRED')
      )
      const checkout = await setup()
      checkout.selectedTierKey.value = 'standard'
      checkout.selectedBillingCycle.value = 'yearly'

      await checkout.handleConfirmTransition()

      expect(mockOpen).toHaveBeenCalledWith(
        'https://billing.stripe.com/portal',
        '_blank'
      )
      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('forwards confirmReactivation true when the disclosure banner reports consent', async () => {
      const checkout = await setupWithApprovedPreview()
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

    it('recovers a personal transition when the subscribe authority requires reactivation consent', async () => {
      mockSubscription.value = { isCancelled: false }
      const checkout = await setup()
      const preview = makeReactivationAuthorityPreview({
        effectiveAt: '2026-08-29T00:00:00Z',
        costTodayCents: 1500,
        costNextPeriodCents: 1600,
        creditsTodayCents: 3150,
        creditsNextPeriodCents: 4200,
        currentPlan: {
          slug: 'creator-monthly',
          tier: 'CREATOR',
          duration: 'MONTHLY',
          priceCents: 3500,
          creditsCents: 7400,
          periodEnd: '2026-08-29T00:00:00Z'
        },
        newPlan: {
          slug: 'standard-yearly',
          tier: 'STANDARD',
          duration: 'ANNUAL',
          priceCents: 1600,
          creditsCents: 4200,
          periodEnd: '2027-08-29T00:00:00Z'
        }
      })
      mockPreviewSubscribe.mockResolvedValueOnce({
        ...preview,
        requires_reactivation_confirmation: false
      })
      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })
      mockSubscribe.mockRejectedValueOnce(
        Object.assign(new Error('reactivation confirmation required'), {
          code: 'REACTIVATION_CONFIRMATION_REQUIRED'
        })
      )
      mockPreviewSubscribe.mockResolvedValueOnce(preview)

      await checkout.handleConfirmTransition()

      expect(checkout.reactivationRequired.value).toBe(true)
      expect(checkout.previewData.value).toStrictEqual(preview)
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'subscription.preview.reactivation.confirmationRequired'
        })
      )
      expect(mockTrackBillingEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'failed' })
      )
    })

    it('keeps a pinned immediate duration-change quote when time-derived values drift', async () => {
      mockSubscription.value = { isCancelled: true }
      const checkout = await setup()
      const currentPlan = {
        slug: 'creator-monthly',
        tier: 'CREATOR',
        duration: 'MONTHLY',
        price_cents: 3500,
        credits_cents: 7400,
        period_end: '2026-08-29T00:00:00Z'
      }
      const newPlan = {
        slug: 'standard-yearly',
        tier: 'STANDARD',
        duration: 'ANNUAL',
        price_cents: 1600,
        credits_cents: 4200,
        period_end: '2027-08-29T00:00:00Z'
      }
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'duration_change',
        promotion_code: 'SAVE20',
        is_immediate: true,
        cost_today_cents: 1500,
        credits_today_cents: 3150,
        proration_at: '2026-07-29T12:00:00Z',
        current_plan: currentPlan,
        new_plan: newPlan
      })
      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'duration_change',
        promotion_code: 'SAVE20',
        is_immediate: true,
        cost_today_cents: 1499,
        credits_today_cents: 3148,
        proration_at: '2026-07-29T12:05:00Z',
        current_plan: currentPlan,
        new_plan: newPlan
      })
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-personal-quoted-reactivation'
      })

      await checkout.handleConfirmTransition(true)

      expect(mockPreviewSubscribe).toHaveBeenCalledTimes(2)
      expect(mockPreviewSubscribe).toHaveBeenLastCalledWith(
        'standard-yearly',
        expect.objectContaining({ promotionCode: 'SAVE20' })
      )
      expect(mockSubscribe).toHaveBeenCalledWith(
        'standard-yearly',
        expect.objectContaining({
          confirmReactivation: true,
          prorationAt: '2026-07-29T12:00:00Z'
        })
      )
    })

    it('refreshes an expired personal quote and submits only after reconfirmation', async () => {
      mockSubscription.value = { isCancelled: true }
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 1500,
        proration_at: '2026-07-29T12:00:00Z'
      })
      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 1499,
        proration_at: '2026-07-29T12:14:00Z'
      })
      mockSubscribe.mockRejectedValueOnce(
        Object.assign(new Error('Quote expired'), {
          code: 'PRORATION_QUOTE_EXPIRED'
        })
      )
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 1600,
        proration_at: '2026-07-29T12:16:00Z',
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
      })

      await checkout.handleConfirmTransition(true)

      expect(mockSubscribe).toHaveBeenCalledTimes(1)
      expect(checkout.previewData.value?.proration_at).toBe(
        '2026-07-29T12:16:00Z'
      )
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'subscription.preview.reactivation.amountChanged'
        })
      )
      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'subscription_checkout',
          stage: 'failed',
          outcome: 'failure',
          tier: 'standard'
        })
      )

      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-personal-refreshed-quote'
      })
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 1599,
        proration_at: '2026-07-29T12:16:05Z',
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
      })
      await checkout.handleConfirmTransition(true)

      expect(mockSubscribe).toHaveBeenLastCalledWith(
        'standard-yearly',
        expect.objectContaining({
          confirmReactivation: true,
          prorationAt: '2026-07-29T12:16:00Z'
        })
      )
      expect(checkout.checkoutStep.value).toBe('success')
    })

    it('keeps the confirmation open when an expired-quote refresh fails', async () => {
      mockSubscription.value = { isCancelled: true }
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 1500,
        proration_at: '2026-07-29T12:00:00Z'
      })
      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 1499
      })
      mockSubscribe.mockRejectedValueOnce(
        Object.assign(new Error('Quote expired'), {
          code: 'PRORATION_QUOTE_EXPIRED'
        })
      )
      mockPreviewSubscribe.mockRejectedValueOnce(new Error('Preview offline'))

      await checkout.handleConfirmTransition(true)

      expect(checkout.checkoutStep.value).toBe('preview')
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'Preview offline' })
      )
      expect(mockToastAdd).not.toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'subscription.preview.reactivation.unavailable'
        })
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
      // Regression guard: this reactivation-consent guard is not a checkout
      // attempt, so it must not open a funnel entry no terminal event will
      // ever close.
      expect(mockTrackBillingEvent).not.toHaveBeenCalled()
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
      mockCapabilities.value.canChangeSeats = false
      mockCapabilities.value.canSubscribeSelfServe = false

      await checkout.handleConfirmTransition()

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(mockTrackBeginCheckout).not.toHaveBeenCalled()
      expect(emit).not.toHaveBeenCalled()
      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('refreshes a required reactivation before submit and lets a retry succeed', async () => {
      mockSubscription.value = { isCancelled: false }
      const checkout = await setup()
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        cost_today_cents: 1500,
        requires_reactivation_confirmation: true
      })
      await checkout.handleSubscribeClick({
        tierKey: 'standard',
        billingCycle: 'yearly'
      })
      expect(checkout.checkoutStep.value).toBe('preview')

      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 1600,
        requires_reactivation_confirmation: true,
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
      })

      await checkout.handleConfirmTransition()

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(checkout.checkoutStep.value).toBe('preview')
      expect(checkout.previewData.value?.cost_today_cents).toBe(1600)

      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: true,
        transition_type: 'upgrade',
        is_immediate: true,
        cost_today_cents: 1600,
        requires_reactivation_confirmation: true,
        current_plan: { period_end: '2026-08-29T00:00:00Z' }
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
    it('fires a started event before resubscribe resolves', async () => {
      const checkout = await setup('subscribe_to_run')
      mockResubscribe.mockResolvedValueOnce({
        billing_op_id: 'op-4',
        status: 'active'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      await checkout.handleResubscribe()

      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'resubscribe',
        stage: 'started',
        outcome: 'pending',
        source: 'pricing_dialog',
        payment_intent_source: 'subscribe_to_run'
      })
    })

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
      expect(mockTrackBillingEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'succeeded' })
      )
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'resubscribe',
        stage: 'started',
        outcome: 'pending',
        source: 'pricing_dialog',
        payment_intent_source: 'subscribe_to_run'
      })
      // Exactly one started event on the legacy success rail: the pre-call start,
      // with no duplicate post-await started/pending emitted after resubscribe() resolves.
      expect(mockTrackBillingEvent).toHaveBeenCalledTimes(1)
    })

    it('fires resubscribe failure telemetry on the legacy rail too', async () => {
      mockShouldUseWorkspaceBilling.value = false
      const workspaceApiError = new WorkspaceApiError('checkout rejected', 500)
      mockResubscribe.mockRejectedValueOnce(workspaceApiError)
      const checkout = await setup()

      await checkout.handleResubscribe()

      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'resubscribe',
        stage: 'failed',
        outcome: 'failure',
        source: 'pricing_dialog',
        payment_intent_source: undefined,
        failure_category: 'api_rejected'
      })
    })

    it('does not resubscribe for a member', async () => {
      mockPermissions.value.canManageSubscriptionLifecycle = false
      mockCapabilities.value.canReactivate = false
      const checkout = await setup()

      await checkout.handleResubscribe()

      expect(mockResubscribe).not.toHaveBeenCalled()
      expect(mockTrackResubscribeClicked).not.toHaveBeenCalled()
    })

    it('does not resubscribe when the server denies reactivation to a client-side owner', async () => {
      mockCapabilities.value.canReactivate = false
      const checkout = await setup()

      await checkout.handleResubscribe()

      expect(mockResubscribe).not.toHaveBeenCalled()
      expect(mockTrackResubscribeClicked).not.toHaveBeenCalled()
    })

    it('emits started before the awaited resubscribe call resolves', async () => {
      const callOrder: string[] = []
      mockResubscribe.mockImplementationOnce(async () => {
        callOrder.push('resubscribe')
        return { billing_op_id: 'op-4', status: 'active' }
      })
      mockTrackBillingEvent.mockImplementationOnce(
        (event: { stage: string }) => {
          callOrder.push(`trackBillingEvent:${event.stage}`)
        }
      )
      const checkout = await setup('subscribe_to_run')

      await checkout.handleResubscribe()

      expect(callOrder.indexOf('trackBillingEvent:started')).toBeLessThan(
        callOrder.indexOf('resubscribe')
      )
    })
  })
})
