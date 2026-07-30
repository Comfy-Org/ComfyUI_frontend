import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type {
  BillingStatusResponse,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceBilling } from '@/platform/workspace/composables/useWorkspaceBilling'

const mockWorkspaceApi = vi.hoisted(() => ({
  getBillingStatus: vi.fn(),
  getBillingBalance: vi.fn(),
  getBillingOpStatus: vi.fn(),
  subscribe: vi.fn(),
  previewSubscribe: vi.fn(),
  getPaymentPortalUrl: vi.fn(),
  cancelSubscription: vi.fn(),
  resubscribe: vi.fn(),
  createTopup: vi.fn()
}))

const mockBillingPlans = vi.hoisted(() => ({
  plans: { value: [] as unknown[] },
  currentPlanSlug: { value: null as string | null },
  error: { value: null as string | null },
  fetchPlans: vi.fn()
}))

const mockShow = vi.hoisted(() => vi.fn())
const mockStartOperation = vi.hoisted(() => vi.fn())
const mockGetOperation = vi.hoisted(() => vi.fn())
const mockSetWorkspaceBillingRail = vi.hoisted(() => vi.fn())
const mockActiveWorkspaceId = vi.hoisted(() => ({ value: 'workspace-1' }))

// Hoisted so the vi.mock factory below can reference it: a plain top-level
// const is in its temporal dead zone when the hoisted factory runs under
// coverage instrumentation, which collects the file to zero tests.
const mockWorkspaceApiError = vi.hoisted(
  () =>
    class WorkspaceApiError extends Error {
      constructor(
        message: string,
        public readonly status?: number,
        public readonly code?: string
      ) {
        super(message)
        this.name = 'WorkspaceApiError'
      }
    }
)

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: mockWorkspaceApi,
  WorkspaceApiError: mockWorkspaceApiError
}))

vi.mock('@/platform/cloud/subscription/composables/useBillingPlans', () => ({
  useBillingPlans: () => mockBillingPlans
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({
      show: mockShow
    })
  })
)

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({
    getOperation: mockGetOperation,
    startOperation: mockStartOperation
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get activeWorkspace() {
      return { id: mockActiveWorkspaceId.value }
    },
    setWorkspaceBillingRail: mockSetWorkspaceBillingRail
  })
}))

let scope: ReturnType<typeof effectScope> | undefined

function setupBilling() {
  scope?.stop()
  scope = effectScope()
  const billing = scope.run(() => useWorkspaceBilling())
  if (!billing) {
    throw new Error('Failed to create billing composable')
  }
  return billing
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

const activeStatus = {
  is_active: true,
  has_funds: true,
  subscription_status: 'active' as const,
  subscription_tier: 'CREATOR' as const,
  subscription_duration: 'MONTHLY' as const,
  plan_slug: 'creator-monthly',
  renewal_date: '2026-05-01T00:00:00Z'
}

const freeStatus = {
  is_active: true,
  has_funds: true,
  subscription_tier: 'FREE' as const,
  plan_slug: 'free'
}

const zeroBalance = {
  amount_micros: 0,
  currency: 'USD'
}

const positiveBalance = {
  amount_micros: 5_000_000,
  currency: 'USD',
  effective_balance_micros: 5_000_000,
  prepaid_balance_micros: 3_000_000,
  cloud_credit_balance_micros: 2_000_000
}

const subscribeResponses = [
  {
    billing_op_id: 'op-subscribed',
    status: 'subscribed'
  },
  {
    billing_op_id: 'op-needs-payment-method',
    status: 'needs_payment_method',
    payment_method_url: 'https://billing.example/payment-method'
  },
  {
    billing_op_id: 'op-pending-payment',
    status: 'pending_payment'
  }
] satisfies SubscribeResponse[]

describe('useWorkspaceBilling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveWorkspaceId.value = 'workspace-1'
    mockBillingPlans.plans.value = []
    mockBillingPlans.currentPlanSlug.value = null
    mockBillingPlans.error.value = null
    mockBillingPlans.fetchPlans.mockResolvedValue(undefined)
  })

  afterEach(() => {
    scope?.stop()
    scope = undefined
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  describe('initialize', () => {
    it('fetches status, balance, and plans in parallel then marks initialized', async () => {
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(activeStatus)
      mockWorkspaceApi.getBillingBalance.mockResolvedValue(positiveBalance)

      const billing = setupBilling()
      await billing.initialize()

      expect(mockWorkspaceApi.getBillingStatus).toHaveBeenCalledTimes(1)
      expect(mockWorkspaceApi.getBillingBalance).toHaveBeenCalledTimes(1)
      expect(mockBillingPlans.fetchPlans).toHaveBeenCalledTimes(1)
      expect(billing.isInitialized.value).toBe(true)
      expect(billing.isLoading.value).toBe(false)
    })

    it('is a no-op after first successful initialize', async () => {
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(activeStatus)
      mockWorkspaceApi.getBillingBalance.mockResolvedValue(positiveBalance)

      const billing = setupBilling()
      await billing.initialize()
      await billing.initialize()

      expect(mockWorkspaceApi.getBillingStatus).toHaveBeenCalledTimes(1)
    })

    it('re-fetches balance when free tier starts with zero credits', async () => {
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(freeStatus)
      mockWorkspaceApi.getBillingBalance
        .mockResolvedValueOnce(zeroBalance)
        .mockResolvedValueOnce({
          amount_micros: 1_000_000,
          currency: 'USD'
        })

      const billing = setupBilling()
      await billing.initialize()

      expect(mockWorkspaceApi.getBillingBalance).toHaveBeenCalledTimes(2)
      expect(billing.balance.value?.amountMicros).toBe(1_000_000)
    })

    it('records an error message when initialization fails', async () => {
      mockWorkspaceApi.getBillingStatus.mockRejectedValue(
        new Error('network down')
      )
      mockWorkspaceApi.getBillingBalance.mockResolvedValue(positiveBalance)

      const billing = setupBilling()

      await expect(billing.initialize()).rejects.toThrow('network down')
      expect(billing.error.value).toBe('network down')
      expect(billing.isInitialized.value).toBe(false)
    })
  })

  describe('fetchStatus / computed subscription', () => {
    it('exposes a null subscription before any status fetch', () => {
      const billing = setupBilling()
      expect(billing.subscription.value).toBeNull()
      expect(billing.isActiveSubscription.value).toBe(false)
      expect(billing.isFreeTier.value).toBe(false)
    })

    it('maps status response into subscription info', async () => {
      mockWorkspaceApi.getBillingStatus.mockResolvedValue({
        ...activeStatus,
        billing_rail: 'stripe',
        subscription_status: 'canceled',
        cancel_at: '2026-06-01T00:00:00Z'
      })

      const billing = setupBilling()
      await billing.fetchStatus()

      expect(billing.subscription.value).toMatchObject({
        isActive: true,
        tier: 'CREATOR',
        duration: 'MONTHLY',
        planSlug: 'creator-monthly',
        renewalDate: '2026-05-01T00:00:00Z',
        endDate: '2026-06-01T00:00:00Z',
        isCancelled: true,
        hasFunds: true
      })
      expect(billing.isActiveSubscription.value).toBe(true)
      expect(billing.isFreeTier.value).toBe(false)
      expect(mockSetWorkspaceBillingRail).toHaveBeenCalledWith(
        'workspace-1',
        'stripe'
      )
    })

    it('recovers a pending subscription operation from billing status', async () => {
      const actionUrl = 'https://invoice.stripe.com/sensitive-token'
      mockWorkspaceApi.getBillingStatus.mockResolvedValue({
        ...activeStatus,
        billing_status: 'pending_payment',
        pending_billing_op_id: 'op-recovered',
        action_url: actionUrl
      } satisfies BillingStatusResponse)

      const billing = setupBilling()
      await billing.fetchStatus()

      expect(mockStartOperation).toHaveBeenCalledWith(
        'op-recovered',
        'subscription',
        undefined,
        actionUrl
      )
    })

    it('does not restart an operation recovered by an earlier status read', async () => {
      mockWorkspaceApi.getBillingStatus.mockResolvedValue({
        ...activeStatus,
        billing_status: 'pending_payment',
        pending_billing_op_id: 'op-recovered'
      } satisfies BillingStatusResponse)
      mockGetOperation
        .mockReturnValueOnce(undefined)
        .mockReturnValue({ status: 'pending' })

      const billing = setupBilling()
      await billing.fetchStatus()
      await billing.fetchStatus()

      expect(mockStartOperation).toHaveBeenCalledOnce()
      expect(mockStartOperation).toHaveBeenCalledWith(
        'op-recovered',
        'subscription',
        undefined,
        undefined
      )
    })

    it('does not recover an operation from a stale workspace response', async () => {
      const status = createDeferred<BillingStatusResponse>()
      mockWorkspaceApi.getBillingStatus.mockReturnValue(status.promise)
      const billing = setupBilling()

      const fetch = billing.fetchStatus()
      mockActiveWorkspaceId.value = 'workspace-2'
      status.resolve({
        ...activeStatus,
        billing_status: 'pending_payment',
        pending_billing_op_id: 'op-workspace-1',
        action_url: 'https://invoice.stripe.com/sensitive-token'
      })
      await fetch

      expect(mockStartOperation).not.toHaveBeenCalled()
      expect(billing.subscription.value).toBeNull()
    })

    it("keeps a 'scheduled' subscription on the active treatment", async () => {
      mockWorkspaceApi.getBillingStatus.mockResolvedValue({
        ...activeStatus,
        subscription_status: 'scheduled' as const
      })

      const billing = setupBilling()
      await billing.fetchStatus()

      expect(billing.subscription.value?.isCancelled).toBe(false)
      expect(billing.isActiveSubscription.value).toBe(true)
    })

    it('reports free tier when status tier is FREE', async () => {
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(freeStatus)

      const billing = setupBilling()
      await billing.fetchStatus()

      expect(billing.isFreeTier.value).toBe(true)
      expect(mockSetWorkspaceBillingRail).not.toHaveBeenCalled()
    })

    it('sets error and rethrows when fetchStatus fails', async () => {
      mockWorkspaceApi.getBillingStatus.mockRejectedValue(new Error('boom'))

      const billing = setupBilling()

      await expect(billing.fetchStatus()).rejects.toThrow('boom')
      expect(billing.error.value).toBe('boom')
    })

    it('keeps the newest status when an older request resolves last', async () => {
      const olderStatus = createDeferred<BillingStatusResponse>()
      mockWorkspaceApi.getBillingStatus
        .mockReturnValueOnce(olderStatus.promise)
        .mockResolvedValueOnce({
          ...activeStatus,
          subscription_tier: 'PRO',
          plan_slug: 'pro-monthly'
        })
      const billing = setupBilling()

      const olderRequest = billing.fetchStatus()
      await billing.fetchStatus()
      olderStatus.resolve(activeStatus)
      await olderRequest

      expect(billing.subscription.value?.planSlug).toBe('pro-monthly')
    })

    it('surfaces a team credit stop from the status response', async () => {
      const teamStop = {
        id: 'team_2500',
        credits_monthly: 527_500,
        stop_usd: 2500
      }
      mockWorkspaceApi.getBillingStatus.mockResolvedValue({
        ...activeStatus,
        team_credit_stop: teamStop
      } satisfies BillingStatusResponse)

      const billing = setupBilling()
      await billing.fetchStatus()

      expect(billing.currentTeamCreditStop.value).toEqual(teamStop)
    })

    it('yields a null team credit stop when status omits one', async () => {
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(activeStatus)

      const billing = setupBilling()
      await billing.fetchStatus()

      expect(billing.currentTeamCreditStop.value).toBeNull()
    })
  })

  describe('fetchBalance / computed balance', () => {
    it('maps balance response into balance info', async () => {
      mockWorkspaceApi.getBillingBalance.mockResolvedValue(positiveBalance)

      const billing = setupBilling()
      await billing.fetchBalance()

      expect(billing.balance.value).toEqual({
        amountMicros: 5_000_000,
        currency: 'USD',
        effectiveBalanceMicros: 5_000_000,
        prepaidBalanceMicros: 3_000_000,
        cloudCreditBalanceMicros: 2_000_000
      })
    })

    it('sets error and rethrows when fetchBalance fails', async () => {
      mockWorkspaceApi.getBillingBalance.mockRejectedValue(
        new Error('balance failed')
      )

      const billing = setupBilling()

      await expect(billing.fetchBalance()).rejects.toThrow('balance failed')
      expect(billing.error.value).toBe('balance failed')
    })

    it('keeps the newest balance when an older request resolves last', async () => {
      const olderBalance = createDeferred<typeof zeroBalance>()
      mockWorkspaceApi.getBillingBalance
        .mockReturnValueOnce(olderBalance.promise)
        .mockResolvedValueOnce(positiveBalance)
      const billing = setupBilling()

      const olderRequest = billing.fetchBalance()
      await billing.fetchBalance()
      olderBalance.resolve(zeroBalance)
      await olderRequest

      expect(billing.balance.value?.amountMicros).toBe(5_000_000)
    })
  })

  describe('subscribe', () => {
    it.for(subscribeResponses)(
      'returns $status without waiting for billing reconciliation',
      async (response) => {
        mockWorkspaceApi.subscribe.mockResolvedValue(response)
        mockWorkspaceApi.getBillingStatus.mockReturnValue(new Promise(() => {}))
        mockWorkspaceApi.getBillingBalance.mockReturnValue(
          new Promise(() => {})
        )

        const billing = setupBilling()

        await expect(
          billing.subscribe('pro', {
            returnUrl: 'return',
            cancelUrl: 'cancel'
          })
        ).resolves.toStrictEqual(response)

        expect(mockWorkspaceApi.subscribe).toHaveBeenCalledWith('pro', {
          returnUrl: 'return',
          cancelUrl: 'cancel'
        })
        expect(mockWorkspaceApi.getBillingStatus).toHaveBeenCalledOnce()
        expect(mockWorkspaceApi.getBillingBalance).toHaveBeenCalledOnce()
        expect(billing.isLoading.value).toBe(true)
      }
    )

    it.for(['status', 'balance'] as const)(
      'retries only the rejected %s reconciliation once',
      async (rejectedResource) => {
        mockWorkspaceApi.subscribe.mockResolvedValue({
          billing_op_id: 'op-1',
          status: 'subscribed'
        })
        const rejectedRequest =
          rejectedResource === 'status'
            ? mockWorkspaceApi.getBillingStatus
            : mockWorkspaceApi.getBillingBalance
        const successfulRequest =
          rejectedResource === 'status'
            ? mockWorkspaceApi.getBillingBalance
            : mockWorkspaceApi.getBillingStatus
        const retryResponse =
          rejectedResource === 'status' ? activeStatus : positiveBalance
        rejectedRequest
          .mockRejectedValueOnce(new Error(`${rejectedResource} failed`))
          .mockResolvedValueOnce(retryResponse)
        successfulRequest.mockReturnValueOnce(new Promise(() => {}))

        const billing = setupBilling()

        try {
          await expect(billing.subscribe('pro')).resolves.toStrictEqual({
            billing_op_id: 'op-1',
            status: 'subscribed'
          })

          await vi.waitFor(
            () => {
              expect(rejectedRequest).toHaveBeenCalledTimes(2)
            },
            { timeout: 250 }
          )
          expect(successfulRequest).toHaveBeenCalledOnce()
        } finally {
          rejectedRequest.mockReset()
          successfulRequest.mockReset()
        }
      }
    )

    it.for(['status', 'balance'] as const)(
      'does not retry an older failed %s request after a newer read starts',
      async (resource) => {
        const olderRead = createDeferred<unknown>()
        const request =
          resource === 'status'
            ? mockWorkspaceApi.getBillingStatus
            : mockWorkspaceApi.getBillingBalance
        const otherRequest =
          resource === 'status'
            ? mockWorkspaceApi.getBillingBalance
            : mockWorkspaceApi.getBillingStatus
        const newerResponse =
          resource === 'status'
            ? {
                ...activeStatus,
                subscription_tier: 'PRO',
                plan_slug: 'pro-monthly'
              }
            : positiveBalance
        request
          .mockReturnValueOnce(olderRead.promise)
          .mockResolvedValueOnce(newerResponse)
        otherRequest.mockResolvedValue(
          resource === 'status' ? positiveBalance : activeStatus
        )
        mockWorkspaceApi.subscribe.mockResolvedValue({
          billing_op_id: 'op-1',
          status: 'pending_payment'
        })
        const billing = setupBilling()

        await billing.subscribe('pro')
        const newerRead =
          resource === 'status' ? billing.fetchStatus() : billing.fetchBalance()
        olderRead.reject(new Error('stale request failed'))
        await newerRead
        await Promise.resolve()
        await Promise.resolve()

        expect(request).toHaveBeenCalledTimes(2)
        if (resource === 'status') {
          expect(billing.subscription.value?.planSlug).toBe('pro-monthly')
        } else {
          expect(billing.balance.value?.amountMicros).toBe(5_000_000)
        }
      }
    )

    it('preserves a final reconciliation error after the other resource recovers', async () => {
      const balanceRetry = createDeferred<typeof positiveBalance>()
      mockWorkspaceApi.subscribe.mockResolvedValue({
        billing_op_id: 'op-1',
        status: 'subscribed'
      })
      mockWorkspaceApi.getBillingStatus.mockRejectedValue(
        new Error('status unavailable')
      )
      mockWorkspaceApi.getBillingBalance
        .mockRejectedValueOnce(new Error('balance unavailable'))
        .mockReturnValueOnce(balanceRetry.promise)
      const billing = setupBilling()

      await billing.subscribe('pro')
      await vi.waitFor(() => {
        expect(mockWorkspaceApi.getBillingStatus).toHaveBeenCalledTimes(2)
        expect(mockWorkspaceApi.getBillingBalance).toHaveBeenCalledTimes(2)
      })
      balanceRetry.resolve(positiveBalance)

      await vi.waitFor(() => {
        expect(billing.error.value).toBe(
          'Subscription succeeded, but billing state refresh failed'
        )
      })
    })

    it('does not reconcile when subscribe fails', async () => {
      mockWorkspaceApi.subscribe.mockRejectedValue(new Error('denied'))

      const billing = setupBilling()

      await expect(billing.subscribe('pro')).rejects.toThrow('denied')
      expect(billing.error.value).toBe('denied')
      expect(mockWorkspaceApi.getBillingStatus).not.toHaveBeenCalled()
      expect(mockWorkspaceApi.getBillingBalance).not.toHaveBeenCalled()
    })

    it('falls back to a generic error message for non-Error rejections', async () => {
      mockWorkspaceApi.subscribe.mockRejectedValue('string failure')

      const billing = setupBilling()

      await expect(billing.subscribe('pro')).rejects.toBe('string failure')
      expect(billing.error.value).toBe('Failed to subscribe')
    })
  })

  describe('previewSubscribe', () => {
    it('returns preview response on success', async () => {
      const preview = {
        allowed: true,
        transition_type: 'new',
        effective_at: 'now',
        is_immediate: true,
        cost_today_cents: 0,
        cost_next_period_cents: 0,
        credits_today_cents: 0,
        credits_next_period_cents: 0,
        new_plan: {}
      }
      mockWorkspaceApi.previewSubscribe.mockResolvedValue(preview)

      const billing = setupBilling()
      const result = await billing.previewSubscribe('pro')

      expect(result).toBe(preview)
      expect(billing.error.value).toBeNull()
    })

    it('sets error and rethrows when preview fails', async () => {
      mockWorkspaceApi.previewSubscribe.mockRejectedValue(
        new Error('preview failed')
      )

      const billing = setupBilling()

      await expect(billing.previewSubscribe('pro')).rejects.toThrow(
        'preview failed'
      )
      expect(billing.error.value).toBe('preview failed')
    })
  })

  describe('manageSubscription', () => {
    let originalLocation: Location

    beforeEach(() => {
      originalLocation = window.location
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: { href: 'https://app.example/settings' }
      })
    })

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: originalLocation
      })
    })

    it('opens the payment portal URL returned by the API', async () => {
      const openSpy = vi.fn()
      vi.stubGlobal('open', openSpy)

      mockWorkspaceApi.getPaymentPortalUrl.mockResolvedValue({
        url: 'https://billing.example/portal'
      })

      const billing = setupBilling()
      await billing.manageSubscription()

      expect(mockWorkspaceApi.getPaymentPortalUrl).toHaveBeenCalledWith(
        'https://app.example/settings'
      )
      expect(openSpy).toHaveBeenCalledWith(
        'https://billing.example/portal',
        '_blank'
      )
    })

    it.for([
      ['empty string', ''],
      ['null', null]
    ])('does not open a window when API returns %s url', async ([, url]) => {
      const openSpy = vi.fn()
      vi.stubGlobal('open', openSpy)

      mockWorkspaceApi.getPaymentPortalUrl.mockResolvedValue({
        url: url as string
      })

      const billing = setupBilling()
      await billing.manageSubscription()

      expect(openSpy).not.toHaveBeenCalled()
    })

    it('records error when API call fails', async () => {
      mockWorkspaceApi.getPaymentPortalUrl.mockRejectedValue(
        new Error('portal down')
      )

      const billing = setupBilling()

      await expect(billing.manageSubscription()).rejects.toThrow('portal down')
      expect(billing.error.value).toBe('portal down')
    })
  })

  describe('cancelSubscription', () => {
    function operation(
      overrides: Partial<{
        status: 'pending' | 'succeeded' | 'failed' | 'timeout'
        errorMessage: string | null
      }> = {}
    ) {
      return {
        opId: 'op-cancel',
        type: 'cancel' as const,
        status: overrides.status ?? ('succeeded' as const),
        errorMessage: overrides.errorMessage ?? null,
        startedAt: 0
      }
    }

    it('drives the shared billing operation poller with a cancel op', async () => {
      mockWorkspaceApi.cancelSubscription.mockResolvedValue({
        billing_op_id: 'op-cancel',
        cancel_at: '2026-06-01T00:00:00Z'
      })
      mockStartOperation.mockResolvedValue(operation())

      const billing = setupBilling()
      await billing.cancelSubscription()

      expect(mockStartOperation).toHaveBeenCalledWith('op-cancel', 'cancel')
      expect(billing.error.value).toBeNull()
    })

    it('throws the op error message when the cancel op fails', async () => {
      mockWorkspaceApi.cancelSubscription.mockResolvedValue({
        billing_op_id: 'op-fail',
        cancel_at: '2026-06-01T00:00:00Z'
      })
      mockStartOperation.mockResolvedValue(
        operation({ status: 'failed', errorMessage: 'processor rejected' })
      )

      const billing = setupBilling()

      await expect(billing.cancelSubscription()).rejects.toThrow(
        'processor rejected'
      )
      expect(billing.error.value).toBe('processor rejected')
    })

    it('throws when the cancel op times out', async () => {
      mockWorkspaceApi.cancelSubscription.mockResolvedValue({
        billing_op_id: 'op-timeout',
        cancel_at: '2026-06-01T00:00:00Z'
      })
      mockStartOperation.mockResolvedValue(
        operation({
          status: 'timeout',
          errorMessage: 'billingOperation.cancelTimeout'
        })
      )

      const billing = setupBilling()

      await expect(billing.cancelSubscription()).rejects.toThrow(
        'billingOperation.cancelTimeout'
      )
    })

    it('falls back to a generic message when a non-success op omits errorMessage', async () => {
      mockWorkspaceApi.cancelSubscription.mockResolvedValue({
        billing_op_id: 'op-noerr',
        cancel_at: '2026-06-01T00:00:00Z'
      })
      mockStartOperation.mockResolvedValue(
        operation({ status: 'failed', errorMessage: null })
      )

      const billing = setupBilling()

      await expect(billing.cancelSubscription()).rejects.toThrow(
        'Failed to cancel subscription'
      )
    })

    it('propagates the error and skips polling when the cancel API fails', async () => {
      mockWorkspaceApi.cancelSubscription.mockRejectedValue(
        new Error('API down')
      )

      const billing = setupBilling()

      await expect(billing.cancelSubscription()).rejects.toThrow('API down')
      expect(billing.error.value).toBe('API down')
      expect(mockStartOperation).not.toHaveBeenCalled()
    })

    it('falls back to a generic error message when cancel rejects with a non-Error', async () => {
      mockWorkspaceApi.cancelSubscription.mockRejectedValue('boom')

      const billing = setupBilling()

      await expect(billing.cancelSubscription()).rejects.toBe('boom')
      expect(billing.error.value).toBe('Failed to cancel subscription')
    })

    it('treats an already-cancelled subscription as success and resyncs status', async () => {
      mockWorkspaceApi.cancelSubscription.mockRejectedValue(
        new mockWorkspaceApiError(
          'Subscription is already scheduled for cancellation',
          400,
          'ALREADY_CANCELED'
        )
      )
      mockWorkspaceApi.getBillingStatus.mockResolvedValue({
        ...activeStatus,
        subscription_status: 'canceled',
        cancel_at: '2026-06-01T00:00:00Z'
      })

      const billing = setupBilling()

      await expect(billing.cancelSubscription()).resolves.toBeUndefined()
      expect(billing.error.value).toBeNull()
      // The scheduled cancellation the server already held is now what the UI
      // shows — the point of resyncing rather than reporting a failure.
      expect(billing.subscription.value?.endDate).toBe('2026-06-01T00:00:00Z')
      expect(billing.subscription.value?.tier).toBe('CREATOR')
      expect(mockStartOperation).not.toHaveBeenCalled()
      expect(billing.isLoading.value).toBe(false)
    })

    it('stays a success when the follow-up status read also fails', async () => {
      mockWorkspaceApi.cancelSubscription.mockRejectedValue(
        new mockWorkspaceApiError('Already cancelled', 400, 'ALREADY_CANCELED')
      )
      mockWorkspaceApi.getBillingStatus.mockRejectedValue(
        new Error('status read failed')
      )

      const billing = setupBilling()

      // The flaky network that lost the original response is the same one that
      // can drop this read; it must not resurrect the false failure.
      await expect(billing.cancelSubscription()).resolves.toBeUndefined()
      expect(billing.error.value).toBeNull()
      expect(billing.isLoading.value).toBe(false)
    })

    it('does not swallow a 5xx that happens to echo the code', async () => {
      mockWorkspaceApi.cancelSubscription.mockRejectedValue(
        new mockWorkspaceApiError('Upstream failure', 500, 'ALREADY_CANCELED')
      )

      const billing = setupBilling()

      await expect(billing.cancelSubscription()).rejects.toThrow(
        'Upstream failure'
      )
      expect(billing.error.value).toBe('Upstream failure')
    })

    it('still surfaces other API errors that carry a code', async () => {
      mockWorkspaceApi.cancelSubscription.mockRejectedValue(
        new mockWorkspaceApiError(
          'No active subscription to cancel',
          400,
          'NO_ACTIVE_SUBSCRIPTION'
        )
      )

      const billing = setupBilling()

      await expect(billing.cancelSubscription()).rejects.toThrow(
        'No active subscription to cancel'
      )
      expect(billing.error.value).toBe('No active subscription to cancel')
    })
  })

  describe('resubscribe', () => {
    it('refreshes status and balance after a successful resubscribe', async () => {
      mockWorkspaceApi.resubscribe.mockResolvedValue(undefined)
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(activeStatus)
      mockWorkspaceApi.getBillingBalance.mockResolvedValue(positiveBalance)

      const billing = setupBilling()
      await billing.resubscribe()

      expect(mockWorkspaceApi.resubscribe).toHaveBeenCalledTimes(1)
      expect(mockWorkspaceApi.getBillingStatus).toHaveBeenCalledTimes(1)
      expect(mockWorkspaceApi.getBillingBalance).toHaveBeenCalledTimes(1)
      expect(billing.subscription.value?.tier).toBe('CREATOR')
      expect(billing.balance.value?.amountMicros).toBe(5_000_000)
      expect(billing.error.value).toBeNull()
      expect(billing.isLoading.value).toBe(false)
    })

    it('keeps the mutation successful when reconciliation fails', async () => {
      mockWorkspaceApi.resubscribe.mockResolvedValue(undefined)
      mockWorkspaceApi.getBillingStatus.mockRejectedValue(
        new Error('status unavailable')
      )
      mockWorkspaceApi.getBillingBalance.mockRejectedValue(
        new Error('balance unavailable')
      )

      const billing = setupBilling()

      await expect(billing.resubscribe()).resolves.toBeUndefined()
      expect(mockWorkspaceApi.resubscribe).toHaveBeenCalledOnce()
      expect(mockWorkspaceApi.getBillingStatus).toHaveBeenCalledOnce()
      expect(mockWorkspaceApi.getBillingBalance).toHaveBeenCalledOnce()
    })

    it('sets error, rethrows, and skips the refresh when the API call fails', async () => {
      mockWorkspaceApi.resubscribe.mockRejectedValue(
        new Error('reactivation failed')
      )

      const billing = setupBilling()

      await expect(billing.resubscribe()).rejects.toThrow('reactivation failed')
      expect(billing.error.value).toBe('reactivation failed')
      expect(billing.isLoading.value).toBe(false)
      expect(mockWorkspaceApi.getBillingStatus).not.toHaveBeenCalled()
      expect(mockWorkspaceApi.getBillingBalance).not.toHaveBeenCalled()
    })

    it('falls back to a generic error message for non-Error rejections', async () => {
      mockWorkspaceApi.resubscribe.mockRejectedValue('boom')

      const billing = setupBilling()

      await expect(billing.resubscribe()).rejects.toBe('boom')
      expect(billing.error.value).toBe('Failed to resubscribe')
    })
    it('treats a subscription with no scheduled cancellation as success and resyncs status', async () => {
      mockWorkspaceApi.resubscribe.mockRejectedValue(
        new mockWorkspaceApiError(
          'Subscription is not scheduled for cancellation',
          400,
          'NOT_SCHEDULED_FOR_CANCELLATION'
        )
      )
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(activeStatus)

      const billing = setupBilling()

      await expect(billing.resubscribe()).resolves.toBeUndefined()
      expect(billing.error.value).toBeNull()
      // No scheduled cancellation left on the resynced subscription.
      expect(billing.subscription.value?.endDate).toBeNull()
      expect(billing.subscription.value?.tier).toBe('CREATOR')
      expect(billing.isActiveSubscription.value).toBe(true)
      expect(billing.isLoading.value).toBe(false)
    })

    it('refreshes balance too, matching the successful resubscribe path', async () => {
      mockWorkspaceApi.resubscribe.mockRejectedValue(
        new mockWorkspaceApiError(
          'Not scheduled',
          400,
          'NOT_SCHEDULED_FOR_CANCELLATION'
        )
      )
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(activeStatus)
      mockWorkspaceApi.getBillingBalance.mockResolvedValue(positiveBalance)

      const billing = setupBilling()
      await billing.resubscribe()

      expect(billing.balance.value?.amountMicros).toBe(5_000_000)
    })

    it('waits for both reconciliation reads to settle before clearing the error', async () => {
      mockWorkspaceApi.resubscribe.mockRejectedValue(
        new mockWorkspaceApiError(
          'Not scheduled',
          400,
          'NOT_SCHEDULED_FOR_CANCELLATION'
        )
      )
      // Staggered on purpose: the status read fails immediately, the balance
      // read fails only after the branch has had every chance to finish.
      // Releasing on the first rejection lets the late one write its failure
      // into error after the branch already cleared it.
      mockWorkspaceApi.getBillingStatus.mockRejectedValue(
        new Error('status down')
      )
      const balance = createDeferred<never>()
      mockWorkspaceApi.getBillingBalance.mockReturnValue(balance.promise)

      const billing = setupBilling()
      const pending = billing.resubscribe()
      await new Promise((resolve) => setTimeout(resolve, 0))
      balance.reject(new Error('balance down'))

      await expect(pending).resolves.toBeUndefined()
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(billing.error.value).toBeNull()
    })

    it('stays a success when the follow-up reads also fail', async () => {
      mockWorkspaceApi.resubscribe.mockRejectedValue(
        new mockWorkspaceApiError(
          'Not scheduled',
          400,
          'NOT_SCHEDULED_FOR_CANCELLATION'
        )
      )
      mockWorkspaceApi.getBillingStatus.mockRejectedValue(new Error('down'))
      mockWorkspaceApi.getBillingBalance.mockRejectedValue(new Error('down'))

      const billing = setupBilling()

      await expect(billing.resubscribe()).resolves.toBeUndefined()
      expect(billing.error.value).toBeNull()
    })
  })

  describe('topup', () => {
    const topupResponse = {
      billing_op_id: 'op-topup',
      topup_id: 'topup-1',
      status: 'completed' as const,
      amount_cents: 500
    }

    it('returns the createTopup response without refreshing status or balance', async () => {
      mockWorkspaceApi.createTopup.mockResolvedValue(topupResponse)

      const billing = setupBilling()
      const result = await billing.topup(500)

      expect(mockWorkspaceApi.createTopup).toHaveBeenCalledWith(500)
      expect(result).toBe(topupResponse)
      expect(mockWorkspaceApi.getBillingStatus).not.toHaveBeenCalled()
      expect(mockWorkspaceApi.getBillingBalance).not.toHaveBeenCalled()
      expect(billing.error.value).toBeNull()
      expect(billing.isLoading.value).toBe(false)
    })

    it('sets error and rethrows when the API call fails', async () => {
      mockWorkspaceApi.createTopup.mockRejectedValue(new Error('card declined'))

      const billing = setupBilling()

      await expect(billing.topup(500)).rejects.toThrow('card declined')
      expect(billing.error.value).toBe('card declined')
      expect(billing.isLoading.value).toBe(false)
    })

    it('falls back to a generic error message for non-Error rejections', async () => {
      mockWorkspaceApi.createTopup.mockRejectedValue('boom')

      const billing = setupBilling()

      await expect(billing.topup(500)).rejects.toBe('boom')
      expect(billing.error.value).toBe('Failed to top up credits')
    })
  })

  describe('resubscribe', () => {
    it('refreshes status and balance after a successful resubscribe', async () => {
      mockWorkspaceApi.resubscribe.mockResolvedValue(undefined)
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(activeStatus)
      mockWorkspaceApi.getBillingBalance.mockResolvedValue(positiveBalance)

      const billing = setupBilling()
      await billing.resubscribe()

      expect(mockWorkspaceApi.resubscribe).toHaveBeenCalledTimes(1)
      expect(mockWorkspaceApi.getBillingStatus).toHaveBeenCalledTimes(1)
      expect(mockWorkspaceApi.getBillingBalance).toHaveBeenCalledTimes(1)
      expect(billing.subscription.value?.tier).toBe('CREATOR')
      expect(billing.balance.value?.amountMicros).toBe(5_000_000)
      expect(billing.error.value).toBeNull()
      expect(billing.isLoading.value).toBe(false)
    })

    it('sets error, rethrows, and skips the refresh when the API call fails', async () => {
      mockWorkspaceApi.resubscribe.mockRejectedValue(
        new Error('reactivation failed')
      )

      const billing = setupBilling()

      await expect(billing.resubscribe()).rejects.toThrow('reactivation failed')
      expect(billing.error.value).toBe('reactivation failed')
      expect(billing.isLoading.value).toBe(false)
      expect(mockWorkspaceApi.getBillingStatus).not.toHaveBeenCalled()
      expect(mockWorkspaceApi.getBillingBalance).not.toHaveBeenCalled()
    })

    it('falls back to a generic error message for non-Error rejections', async () => {
      mockWorkspaceApi.resubscribe.mockRejectedValue('boom')

      const billing = setupBilling()

      await expect(billing.resubscribe()).rejects.toBe('boom')
      expect(billing.error.value).toBe('Failed to resubscribe')
    })
  })

  describe('topup', () => {
    const topupResponse = {
      billing_op_id: 'op-topup',
      topup_id: 'topup-1',
      status: 'completed' as const,
      amount_cents: 500
    }

    it('returns the createTopup response without refreshing status or balance', async () => {
      mockWorkspaceApi.createTopup.mockResolvedValue(topupResponse)

      const billing = setupBilling()
      const result = await billing.topup(500)

      expect(mockWorkspaceApi.createTopup).toHaveBeenCalledWith(500)
      expect(result).toBe(topupResponse)
      expect(mockWorkspaceApi.getBillingStatus).not.toHaveBeenCalled()
      expect(mockWorkspaceApi.getBillingBalance).not.toHaveBeenCalled()
      expect(billing.error.value).toBeNull()
      expect(billing.isLoading.value).toBe(false)
    })

    it('sets error and rethrows when the API call fails', async () => {
      mockWorkspaceApi.createTopup.mockRejectedValue(new Error('card declined'))

      const billing = setupBilling()

      await expect(billing.topup(500)).rejects.toThrow('card declined')
      expect(billing.error.value).toBe('card declined')
      expect(billing.isLoading.value).toBe(false)
    })

    it('falls back to a generic error message for non-Error rejections', async () => {
      mockWorkspaceApi.createTopup.mockRejectedValue('boom')

      const billing = setupBilling()

      await expect(billing.topup(500)).rejects.toBe('boom')
      expect(billing.error.value).toBe('Failed to top up credits')
    })
  })

  describe('plans / currentPlanSlug / fetchPlans', () => {
    it('prefers the plan slug from status over the billingPlans fallback', async () => {
      mockBillingPlans.currentPlanSlug.value = 'plans-fallback'
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(activeStatus)

      const billing = setupBilling()
      await billing.fetchStatus()

      expect(billing.currentPlanSlug.value).toBe('creator-monthly')
    })

    it('falls back to billingPlans.currentPlanSlug when status has no plan slug', async () => {
      mockBillingPlans.currentPlanSlug.value = 'plans-fallback'

      const billing = setupBilling()

      expect(billing.currentPlanSlug.value).toBe('plans-fallback')
    })

    it('propagates a soft error from billingPlans into billing.error', async () => {
      mockBillingPlans.fetchPlans.mockResolvedValue(undefined)
      mockBillingPlans.error.value = 'plans lookup failed'

      const billing = setupBilling()
      await billing.fetchPlans()

      expect(billing.error.value).toBe('plans lookup failed')
    })
  })

  describe('requireActiveSubscription', () => {
    it('opens the subscription dialog when not active', async () => {
      mockWorkspaceApi.getBillingStatus.mockResolvedValue({
        ...activeStatus,
        is_active: false
      })

      const billing = setupBilling()
      await billing.requireActiveSubscription()

      expect(mockShow).toHaveBeenCalledTimes(1)
    })

    it('does nothing when subscription is active', async () => {
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(activeStatus)

      const billing = setupBilling()
      await billing.requireActiveSubscription()

      expect(mockShow).not.toHaveBeenCalled()
    })
  })

  describe('showSubscriptionDialog', () => {
    it('delegates to the subscription dialog', () => {
      const billing = setupBilling()
      billing.showSubscriptionDialog()

      expect(mockShow).toHaveBeenCalledTimes(1)
    })
  })

  describe('initialize free-tier balance refresh', () => {
    it('does not re-fetch balance when free tier already has a positive balance', async () => {
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(freeStatus)
      mockWorkspaceApi.getBillingBalance.mockResolvedValue(positiveBalance)

      const billing = setupBilling()
      await billing.initialize()

      // One initial fetch only — the free-tier zero-balance reload branch
      // must not trigger when amountMicros > 0.
      expect(mockWorkspaceApi.getBillingBalance).toHaveBeenCalledTimes(1)
      expect(billing.isFreeTier.value).toBe(true)
      expect(billing.balance.value?.amountMicros).toBe(5_000_000)
    })
  })

  describe('subscribe argument forwarding', () => {
    it('forwards undefined options when called with planSlug only', async () => {
      mockWorkspaceApi.subscribe.mockResolvedValue({
        billing_op_id: 'op-x',
        status: 'subscribed'
      })
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(activeStatus)
      mockWorkspaceApi.getBillingBalance.mockResolvedValue(positiveBalance)

      const billing = setupBilling()
      await billing.subscribe('pro')

      expect(mockWorkspaceApi.subscribe).toHaveBeenCalledWith('pro', undefined)
    })

    it('forwards team_credit_stop options to the api', async () => {
      mockWorkspaceApi.subscribe.mockResolvedValue({
        billing_op_id: 'op-y',
        status: 'needs_payment_method'
      })
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(activeStatus)
      mockWorkspaceApi.getBillingBalance.mockResolvedValue(positiveBalance)

      const billing = setupBilling()
      await billing.subscribe('team_per_credit_annual', {
        teamCreditStopId: 'team_700',
        billingCycle: 'yearly'
      })

      expect(mockWorkspaceApi.subscribe).toHaveBeenCalledWith(
        'team_per_credit_annual',
        { teamCreditStopId: 'team_700', billingCycle: 'yearly' }
      )
    })
  })

  describe('previewSubscribe does not refresh state', () => {
    it('does not call fetchStatus or fetchBalance after a successful preview', async () => {
      mockWorkspaceApi.previewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'new',
        effective_at: 'now',
        is_immediate: true,
        cost_today_cents: 0,
        cost_next_period_cents: 0,
        credits_today_cents: 0,
        credits_next_period_cents: 0,
        new_plan: {}
      })

      const billing = setupBilling()
      await billing.previewSubscribe('pro')

      expect(mockWorkspaceApi.getBillingStatus).not.toHaveBeenCalled()
      expect(mockWorkspaceApi.getBillingBalance).not.toHaveBeenCalled()
    })
  })
})
