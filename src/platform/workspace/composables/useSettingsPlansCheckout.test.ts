import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { Plan } from '@/platform/workspace/api/workspaceApi'

const {
  mockSubscribe,
  mockReconcile,
  mockPlans,
  mockToastAdd,
  mockStartOperation,
  mockShowSignInDialog,
  mockFirebaseUser,
  mockOpen
} = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockReconcile: vi.fn(),
  mockPlans: { value: [] as Plan[] },
  mockToastAdd: vi.fn(),
  mockStartOperation: vi.fn(),
  mockShowSignInDialog: vi.fn(),
  mockFirebaseUser: { value: null as { uid: string } | null },
  mockOpen: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscribe: mockSubscribe,
    plans: mockPlans,
    reconcileSubscriptionSuccess: mockReconcile
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    get currentUser() {
      return mockFirebaseUser.value
    }
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showSignInDialog: mockShowSignInDialog
  })
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({
    startOperation: mockStartOperation
  })
}))

vi.mock('@/config/comfyApi', () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd })
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

function makePlan(
  slug: string,
  tier: Plan['tier'],
  duration: Plan['duration']
): Plan {
  return {
    slug,
    tier,
    duration,
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

describe('useSettingsPlansCheckout', () => {
  const scopes: ReturnType<typeof effectScope>[] = []

  async function setup() {
    const { useSettingsPlansCheckout } =
      await import('./useSettingsPlansCheckout')
    const scope = effectScope()
    scopes.push(scope)
    return scope.run(() => useSettingsPlansCheckout())!
  }

  beforeEach(() => {
    mockPlans.value = [
      makePlan('standard-yearly', 'STANDARD', 'ANNUAL'),
      makePlan('creator-monthly', 'CREATOR', 'MONTHLY')
    ]
    mockFirebaseUser.value = { uid: 'user-1' }
    mockShowSignInDialog.mockResolvedValue(true)
    mockStartOperation.mockResolvedValue({ status: 'succeeded' })
    mockReconcile.mockResolvedValue(undefined)
    mockOpen.mockReturnValue({} as Window)
    vi.stubGlobal('open', mockOpen)
  })

  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop())
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('subscribes with the catalog slug, platform return URLs, and cycle', async () => {
    const checkout = await setup()
    mockSubscribe.mockResolvedValueOnce({
      status: 'subscribed',
      billing_op_id: 'op-1'
    })

    await checkout.subscribeToPersonal('standard', 'yearly')

    expect(mockSubscribe).toHaveBeenCalledWith('standard-yearly', {
      billingCycle: 'yearly',
      returnUrl: 'https://platform.comfy.org/payment/success',
      cancelUrl: 'https://platform.comfy.org/payment/failed'
    })
  })

  it('reconciles both billing contexts on an immediate subscribed outcome', async () => {
    const checkout = await setup()
    mockSubscribe.mockResolvedValueOnce({
      status: 'subscribed',
      billing_op_id: 'op-1'
    })

    await checkout.subscribeToPersonal('standard', 'yearly')

    expect(mockReconcile).toHaveBeenCalledTimes(1)
    expect(mockStartOperation).not.toHaveBeenCalled()
    expect(mockOpen).not.toHaveBeenCalled()
  })

  it('does not surface a reconcile failure as a failed subscribe', async () => {
    const checkout = await setup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSubscribe.mockResolvedValueOnce({
      status: 'subscribed',
      billing_op_id: 'op-1'
    })
    mockReconcile.mockRejectedValueOnce(new Error('refresh failed'))

    await checkout.subscribeToPersonal('standard', 'yearly')

    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalled()
  })

  it('opens the payment page and polls the billing op on needs_payment_method', async () => {
    const checkout = await setup()
    mockSubscribe.mockResolvedValueOnce({
      status: 'needs_payment_method',
      payment_method_url: 'https://checkout.stripe.com/pay',
      billing_op_id: 'op-2'
    })

    await checkout.subscribeToPersonal('standard', 'yearly')

    expect(mockOpen).toHaveBeenCalledWith(
      'https://checkout.stripe.com/pay',
      '_blank'
    )
    expect(mockStartOperation).toHaveBeenCalledWith('op-2', 'subscription')
  })

  it('still polls the billing op when payment_method_url is missing', async () => {
    const checkout = await setup()
    mockSubscribe.mockResolvedValueOnce({
      status: 'needs_payment_method',
      billing_op_id: 'op-3'
    })

    await checkout.subscribeToPersonal('standard', 'yearly')

    expect(mockOpen).not.toHaveBeenCalled()
    expect(mockStartOperation).toHaveBeenCalledWith('op-3', 'subscription')
  })

  it('warns about a blocked popup and keeps polling', async () => {
    const checkout = await setup()
    mockOpen.mockReturnValueOnce(null)
    mockSubscribe.mockResolvedValueOnce({
      status: 'needs_payment_method',
      payment_method_url: 'https://checkout.stripe.com/pay',
      billing_op_id: 'op-4'
    })

    await checkout.subscribeToPersonal('standard', 'yearly')

    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'warn',
      summary: 'g.warning',
      detail: 'subscription.preview.paymentPopupBlocked'
    })
    expect(mockStartOperation).toHaveBeenCalledWith('op-4', 'subscription')
  })

  it('routes an api-key-only user through sign-in before subscribing', async () => {
    const checkout = await setup()
    mockFirebaseUser.value = null
    mockSubscribe.mockResolvedValueOnce({
      status: 'subscribed',
      billing_op_id: 'op-5'
    })

    await checkout.subscribeToPersonal('standard', 'yearly')

    expect(mockShowSignInDialog).toHaveBeenCalledTimes(1)
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    expect(mockShowSignInDialog.mock.invocationCallOrder[0]).toBeLessThan(
      mockSubscribe.mock.invocationCallOrder[0]
    )
  })

  it('issues no request when the api-key-only user declines sign-in', async () => {
    const checkout = await setup()
    mockFirebaseUser.value = null
    mockShowSignInDialog.mockResolvedValueOnce(false)

    await checkout.subscribeToPersonal('standard', 'yearly')

    expect(mockSubscribe).not.toHaveBeenCalled()
  })

  it('skips the sign-in dialog for a Firebase user', async () => {
    const checkout = await setup()
    mockSubscribe.mockResolvedValueOnce({
      status: 'subscribed',
      billing_op_id: 'op-6'
    })

    await checkout.subscribeToPersonal('standard', 'yearly')

    expect(mockShowSignInDialog).not.toHaveBeenCalled()
  })

  it('shows the subscribe-failed toast when the catalog has no matching plan', async () => {
    const checkout = await setup()
    mockPlans.value = []

    await checkout.subscribeToPersonal('standard', 'yearly')

    expect(mockSubscribe).not.toHaveBeenCalled()
    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'subscription.subscribeFailed'
    })
  })

  it('surfaces a rejected subscribe through the error toast', async () => {
    const checkout = await setup()
    mockSubscribe.mockRejectedValueOnce(new Error('card declined'))

    await checkout.subscribeToPersonal('standard', 'yearly')

    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'card declined'
    })
    expect(mockStartOperation).not.toHaveBeenCalled()
    expect(checkout.isSubscribing.value).toBe(false)
  })

  it('subscribes to the team plan with the cycle slug and stop id', async () => {
    const checkout = await setup()
    mockSubscribe.mockResolvedValueOnce({
      status: 'subscribed',
      billing_op_id: 'op-7'
    })

    await checkout.subscribeToTeam(
      { id: 'team_700', usd: 700, credits: 147_700, discountPercentYearly: 10 },
      'monthly'
    )

    expect(mockSubscribe).toHaveBeenCalledWith('team_per_credit_monthly', {
      billingCycle: 'monthly',
      teamCreditStopId: 'team_700',
      returnUrl: 'https://platform.comfy.org/payment/success',
      cancelUrl: 'https://platform.comfy.org/payment/failed'
    })
  })

  it('refuses a team subscribe on a fallback stop without a backend id', async () => {
    const checkout = await setup()

    await checkout.subscribeToTeam(
      { usd: 700, credits: 147_700, discountPercentYearly: 10 },
      'monthly'
    )

    expect(mockSubscribe).not.toHaveBeenCalled()
    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'subscription.teamPlan.name',
      detail: 'subscription.teamPlan.unavailable'
    })
  })
})
