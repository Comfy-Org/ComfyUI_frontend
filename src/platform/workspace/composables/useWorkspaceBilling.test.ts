import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h } from 'vue'

import { useWorkspaceBilling } from '@/platform/workspace/composables/useWorkspaceBilling'
import type { BillingActions, BillingState } from '@/composables/billing/types'

const mockWorkspaceApi = vi.hoisted(() => ({
  getBillingStatus: vi.fn(),
  getBillingBalance: vi.fn(),
  getBillingOpStatus: vi.fn(),
  subscribe: vi.fn(),
  previewSubscribe: vi.fn(),
  getPaymentPortalUrl: vi.fn(),
  cancelSubscription: vi.fn()
}))

const mockBillingPlans = vi.hoisted(() => ({
  plans: { value: [] as unknown[] },
  currentPlanSlug: { value: null as string | null },
  error: { value: null as string | null },
  fetchPlans: vi.fn()
}))

const mockShow = vi.hoisted(() => vi.fn())
const mockUpdateActiveWorkspace = vi.hoisted(() => vi.fn())

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: mockWorkspaceApi
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

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    updateActiveWorkspace: mockUpdateActiveWorkspace
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

describe('useWorkspaceBilling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBillingPlans.plans.value = []
    mockBillingPlans.currentPlanSlug.value = null
    mockBillingPlans.error.value = null
    mockBillingPlans.fetchPlans.mockResolvedValue(undefined)
  })

  afterEach(() => {
    scope?.stop()
    scope = undefined
    vi.unstubAllGlobals()
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
    it('maps status response into subscription info', async () => {
      mockWorkspaceApi.getBillingStatus.mockResolvedValue({
        ...activeStatus,
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
    })

    it('reports free tier when status tier is FREE', async () => {
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(freeStatus)

      const billing = setupBilling()
      await billing.fetchStatus()

      expect(billing.isFreeTier.value).toBe(true)
    })

    it('sets error and rethrows when fetchStatus fails', async () => {
      mockWorkspaceApi.getBillingStatus.mockRejectedValue(new Error('boom'))

      const billing = setupBilling()

      await expect(billing.fetchStatus()).rejects.toThrow('boom')
      expect(billing.error.value).toBe('boom')
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
  })

  describe('subscribe', () => {
    it('refreshes status and balance after successful subscribe', async () => {
      mockWorkspaceApi.subscribe.mockResolvedValue({
        billing_op_id: 'op-1',
        status: 'subscribed'
      })
      mockWorkspaceApi.getBillingStatus.mockResolvedValue(activeStatus)
      mockWorkspaceApi.getBillingBalance.mockResolvedValue(positiveBalance)

      const billing = setupBilling()
      const response = await billing.subscribe('pro', 'return', 'cancel')

      expect(mockWorkspaceApi.subscribe).toHaveBeenCalledWith(
        'pro',
        'return',
        'cancel'
      )
      expect(response).toEqual({ billing_op_id: 'op-1', status: 'subscribed' })
      expect(mockWorkspaceApi.getBillingStatus).toHaveBeenCalledTimes(1)
      expect(mockWorkspaceApi.getBillingBalance).toHaveBeenCalledTimes(1)
    })

    it('propagates error and records message when subscribe fails', async () => {
      mockWorkspaceApi.subscribe.mockRejectedValue(new Error('denied'))

      const billing = setupBilling()

      await expect(billing.subscribe('pro')).rejects.toThrow('denied')
      expect(billing.error.value).toBe('denied')
      expect(mockWorkspaceApi.getBillingStatus).not.toHaveBeenCalled()
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
    it('opens the payment portal URL returned by the API', async () => {
      vi.stubGlobal('location', { href: 'https://app.example/settings' })
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

    it('does not open a window when API returns no url', async () => {
      const openSpy = vi.fn()
      vi.stubGlobal('open', openSpy)

      mockWorkspaceApi.getPaymentPortalUrl.mockResolvedValue({ url: '' })

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

  describe('cancelSubscription polling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('updates workspace store when op succeeds', async () => {
      mockWorkspaceApi.cancelSubscription.mockResolvedValue({
        billing_op_id: 'op-cancel',
        cancel_at: '2026-06-01T00:00:00Z'
      })
      mockWorkspaceApi.getBillingOpStatus.mockResolvedValue({
        id: 'op-cancel',
        status: 'succeeded',
        started_at: '2026-04-01T00:00:00Z'
      })
      mockWorkspaceApi.getBillingStatus.mockResolvedValue({
        ...activeStatus,
        is_active: false,
        subscription_status: 'canceled'
      })

      const billing = setupBilling()
      await billing.cancelSubscription()

      expect(mockWorkspaceApi.getBillingOpStatus).toHaveBeenCalledWith(
        'op-cancel'
      )
      expect(mockUpdateActiveWorkspace).toHaveBeenCalledWith({
        isSubscribed: false
      })
      expect(mockWorkspaceApi.getBillingStatus).toHaveBeenCalled()
    })

    it('rethrows when the op reports failure', async () => {
      mockWorkspaceApi.cancelSubscription.mockResolvedValue({
        billing_op_id: 'op-fail',
        cancel_at: '2026-06-01T00:00:00Z'
      })
      mockWorkspaceApi.getBillingOpStatus.mockResolvedValue({
        id: 'op-fail',
        status: 'failed',
        started_at: '2026-04-01T00:00:00Z',
        error_message: 'processor rejected'
      })

      const billing = setupBilling()

      await expect(billing.cancelSubscription()).rejects.toThrow(
        'processor rejected'
      )
      expect(billing.error.value).toBe('processor rejected')
      expect(mockUpdateActiveWorkspace).not.toHaveBeenCalled()
    })

    it('polls with backoff until the op resolves', async () => {
      mockWorkspaceApi.cancelSubscription.mockResolvedValue({
        billing_op_id: 'op-slow',
        cancel_at: '2026-06-01T00:00:00Z'
      })
      mockWorkspaceApi.getBillingOpStatus
        .mockResolvedValueOnce({
          id: 'op-slow',
          status: 'pending',
          started_at: '2026-04-01T00:00:00Z'
        })
        .mockResolvedValueOnce({
          id: 'op-slow',
          status: 'succeeded',
          started_at: '2026-04-01T00:00:00Z'
        })
      mockWorkspaceApi.getBillingStatus.mockResolvedValue({
        ...activeStatus,
        is_active: false
      })

      const billing = setupBilling()
      const cancelPromise = billing.cancelSubscription()

      await vi.advanceTimersByTimeAsync(2000)
      await cancelPromise

      expect(mockWorkspaceApi.getBillingOpStatus).toHaveBeenCalledTimes(2)
      expect(mockUpdateActiveWorkspace).toHaveBeenCalledWith({
        isSubscribed: false
      })
    })

    it('stops polling when the host component is unmounted', async () => {
      mockWorkspaceApi.cancelSubscription.mockResolvedValue({
        billing_op_id: 'op-dispose',
        cancel_at: '2026-06-01T00:00:00Z'
      })
      mockWorkspaceApi.getBillingOpStatus.mockResolvedValue({
        id: 'op-dispose',
        status: 'pending',
        started_at: '2026-04-01T00:00:00Z'
      })

      const { createApp } = await import('vue')
      let billing: (BillingState & BillingActions) | undefined
      const HostComponent = defineComponent({
        setup() {
          billing = useWorkspaceBilling()
          return () => h('div')
        }
      })
      const host = document.createElement('div')
      const app = createApp(HostComponent)
      app.mount(host)

      if (!billing) throw new Error('composable not initialized')
      const cancelPromise = billing.cancelSubscription().catch(() => undefined)

      await vi.advanceTimersByTimeAsync(0)
      const callsBeforeUnmount =
        mockWorkspaceApi.getBillingOpStatus.mock.calls.length

      app.unmount()

      await vi.advanceTimersByTimeAsync(10_000)
      await cancelPromise

      expect(mockWorkspaceApi.getBillingOpStatus.mock.calls.length).toBe(
        callsBeforeUnmount
      )
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
})
