import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

const {
  mockSubscribe,
  mockReconcile,
  mockToastAdd,
  mockStartOperation,
  mockShowSignInDialog,
  mockFirebaseUser,
  mockOpen
} = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockReconcile: vi.fn(),
  mockToastAdd: vi.fn(),
  mockStartOperation: vi.fn(),
  mockShowSignInDialog: vi.fn(),
  mockFirebaseUser: { value: null as { uid: string } | null },
  mockOpen: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscribe: mockSubscribe,
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
    mockFirebaseUser.value = { uid: 'user-1' }
    mockShowSignInDialog.mockResolvedValue(true)
    mockStartOperation.mockResolvedValue({ status: 'succeeded' })
    mockReconcile.mockResolvedValue(undefined)
    mockOpen.mockReturnValue({} as Window)
    vi.stubGlobal('open', mockOpen)
  })

  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop())
  })

  it('subscribes with the catalog slug, platform return URLs, and cycle', async () => {
    const checkout = await setup()
    mockSubscribe.mockResolvedValueOnce({
      status: 'subscribed',
      billing_op_id: 'op-1'
    })

    await checkout.subscribeToPersonal('standard-yearly', 'yearly')

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

    await checkout.subscribeToPersonal('standard-yearly', 'yearly')

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

    await checkout.subscribeToPersonal('standard-yearly', 'yearly')

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

    await checkout.subscribeToPersonal('standard-yearly', 'yearly')

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

    await checkout.subscribeToPersonal('standard-yearly', 'yearly')

    expect(mockOpen).not.toHaveBeenCalled()
    expect(mockStartOperation).toHaveBeenCalledWith('op-3', 'subscription')
  })

  it('keeps the checkout locked until the billing op reaches a terminal state', async () => {
    const checkout = await setup()
    let resolveOperation!: (value: { status: string }) => void
    mockStartOperation.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOperation = resolve
      })
    )
    mockSubscribe.mockResolvedValue({
      status: 'needs_payment_method',
      payment_method_url: 'https://checkout.stripe.com/pay',
      billing_op_id: 'op-lock'
    })

    const firstClick = checkout.subscribeToPersonal('standard-yearly', 'yearly')
    await vi.waitFor(() => expect(mockStartOperation).toHaveBeenCalledTimes(1))
    expect(checkout.isSubscribing.value).toBe(true)

    await checkout.subscribeToPersonal('standard-yearly', 'yearly')
    expect(mockSubscribe).toHaveBeenCalledTimes(1)

    resolveOperation({ status: 'succeeded' })
    await firstClick
    expect(checkout.isSubscribing.value).toBe(false)
  })

  it('warns about a blocked popup and keeps polling', async () => {
    const checkout = await setup()
    mockOpen.mockReturnValueOnce(null)
    mockSubscribe.mockResolvedValueOnce({
      status: 'needs_payment_method',
      payment_method_url: 'https://checkout.stripe.com/pay',
      billing_op_id: 'op-4'
    })

    await checkout.subscribeToPersonal('standard-yearly', 'yearly')

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

    await checkout.subscribeToPersonal('standard-yearly', 'yearly')

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

    await checkout.subscribeToPersonal('standard-yearly', 'yearly')

    expect(mockSubscribe).not.toHaveBeenCalled()
  })

  it('skips the sign-in dialog for a Firebase user', async () => {
    const checkout = await setup()
    mockSubscribe.mockResolvedValueOnce({
      status: 'subscribed',
      billing_op_id: 'op-6'
    })

    await checkout.subscribeToPersonal('standard-yearly', 'yearly')

    expect(mockShowSignInDialog).not.toHaveBeenCalled()
  })

  it('shows the subscribe-failed toast when the slug is missing', async () => {
    const checkout = await setup()

    await checkout.subscribeToPersonal('', 'yearly')

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

    await checkout.subscribeToPersonal('standard-yearly', 'yearly')

    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'card declined'
    })
    expect(mockStartOperation).not.toHaveBeenCalled()
    expect(checkout.isSubscribing.value).toBe(false)
  })

  it('submits the caller-supplied team API slug verbatim with the stop id', async () => {
    const checkout = await setup()
    mockSubscribe.mockResolvedValueOnce({
      status: 'subscribed',
      billing_op_id: 'op-7'
    })

    // The slug is the API TEAM row passed by the caller — never synthesized
    // here, so the submitted slug is exactly what was rendered.
    await checkout.subscribeToTeam(
      'team-monthly-catalog',
      { id: 'team_700', usd: 700, credits: 147_700, discountPercentYearly: 10 },
      'monthly'
    )

    expect(mockSubscribe).toHaveBeenCalledWith('team-monthly-catalog', {
      billingCycle: 'monthly',
      teamCreditStopId: 'team_700',
      returnUrl: 'https://platform.comfy.org/payment/success',
      cancelUrl: 'https://platform.comfy.org/payment/failed'
    })
  })

  it('refuses a team subscribe on a stop without a backend id', async () => {
    const checkout = await setup()

    await checkout.subscribeToTeam(
      'team-monthly-catalog',
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
