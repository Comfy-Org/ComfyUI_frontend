import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { effectScope, nextTick, computed, ref } from 'vue'
import type { Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useAuthStore } from '@/stores/authStore'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAgentDockMount } from '@/workbench/extensions/agent/composables/useAgentDockMount'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type {
  BillingRail,
  BillingStatusResponse,
  Plan
} from '@/platform/workspace/api/workspaceApi'
import {
  authenticatedRemoteConfigState,
  remoteConfig,
  remoteConfigState
} from '@/platform/remoteConfig/remoteConfig'

import { useBillingContext as useSharedBillingContext } from './useBillingContext'

vi.mock(import('firebase/auth'))
vi.mock(import('@/composables/useErrorHandling'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'))

function useBillingContext() {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  return scope.run(useSharedBillingContext)!
}

const DEFAULT_BILLING_STATUS: BillingStatusResponse = {
  is_active: true,
  max_seats: 73,
  occupied_seats: 72,
  has_funds: true,
  team_credit_stop: null,
  scheduled_change: null,
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY'
}

const {
  mockPlans,
  mockFetchPlans,
  mockBillingStatus,
  mockIsCloud,
  mockFreeTierExecutionPermitted
} = vi.hoisted(() => {
  const mockBillingStatus: { value: Partial<BillingStatusResponse> } = {
    value: {
      is_active: true,
      has_funds: true,
      subscription_tier: 'PRO',
      subscription_duration: 'MONTHLY'
    }
  }
  return {
    mockPlans: { value: [] as Plan[] },
    mockFetchPlans: vi.fn(async () => undefined),
    mockBillingStatus,
    mockIsCloud: { value: true },
    mockFreeTierExecutionPermitted: { value: true }
  }
})

let mockIsPersonal: Ref<boolean>
let mockBillingRail: Ref<BillingRail | null | undefined>

vi.mock(import('@/platform/distribution/types'), () => {
  return {
    get isCloud() {
      return mockIsCloud.value
    }
  }
})

vi.mock(import('@/platform/cloud/subscription/composables/useSubscription'))

vi.mock<unknown>(
  import('@/platform/cloud/subscription/composables/useFreeTierQuota'),
  () => ({
    useFreeTierQuota: () => ({
      quotaEnabled: { value: false },
      get freeTierExecutionPermitted() {
        return mockFreeTierExecutionPermitted
      }
    })
  })
)

vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)

vi.mock(import('@/composables/auth/useAuthActions'))

vi.mock<unknown>(
  import('@/platform/cloud/subscription/composables/useBillingPlans'),
  () => ({
    useBillingPlans: () => ({
      get plans() {
        return mockPlans
      },
      currentPlanSlug: { value: null },
      isLoading: { value: false },
      error: { value: null },
      fetchPlans: mockFetchPlans,
      getPlanBySlug: vi.fn(() => null)
    })
  })
)

vi.mock<unknown>(import('@/platform/workspace/api/workspaceApi'), () => ({
  workspaceApi: {
    getBillingStatus: vi.fn(() =>
      Promise.resolve({ ...DEFAULT_BILLING_STATUS, ...mockBillingStatus.value })
    ),
    getBillingBalance: vi.fn(async () => ({
      amount_micros: 10000000,
      currency: 'usd'
    })),
    subscribe: vi.fn(async () => ({ status: 'subscribed' })),
    previewSubscribe: vi.fn(async () => ({ allowed: true })),
    createTopup: vi.fn(async () => undefined)
  }
}))

describe('useBillingContext', () => {
  beforeEach(() => {
    mockIsCloud.value = true
    mockFreeTierExecutionPermitted.value = true

    const workspaceStore = useTeamWorkspaceStore()
    const refs = storeToRefs(workspaceStore)
    mockIsPersonal = refs.isInPersonalWorkspace
    mockBillingRail = refs.activeWorkspaceBillingRail
    Object.assign(workspaceStore, {
      activeWorkspace: computed(() =>
        fromPartial<NonNullable<typeof workspaceStore.activeWorkspace>>({
          id: mockIsPersonal.value ? 'personal-123' : 'team-456',
          type: mockIsPersonal.value ? 'personal' : 'team'
        })
      )
    })
    const authStore = useAuthStore()
    authStore.balance = { currency: 'usd', amount_micros: 5000000 }
    vi.mocked(authStore.fetchBalance).mockResolvedValue(authStore.balance)
    vi.mocked(workspaceStore.updateActiveWorkspace).mockImplementation(() => {})
    remoteConfig.value = {}
    remoteConfigState.value = 'unloaded'
    authenticatedRemoteConfigState.value = 'unloaded'
    mockIsPersonal.value = true
    mockBillingRail.value = undefined
    vi.mocked(
      useTeamWorkspaceStore().setWorkspaceBillingRail
    ).mockImplementation((_workspaceId: string, billingRail: BillingRail) => {
      mockBillingRail.value = billingRail
    })
    mockPlans.value = []
    const subscription = useSubscription()
    subscription.subscriptionStatus.value = {
      is_active: true,
      has_funds: true,
      max_seats: 0,
      occupied_seats: 0,
      team_credit_stop: null,
      scheduled_change: null,
      renewal_date: '2025-01-01T00:00:00Z'
    }
    subscription.subscriptionTier = computed(() => 'PRO')
    subscription.subscriptionDuration = computed(() => 'MONTHLY')
    subscription.isCancelled = computed(() =>
      Boolean(subscription.subscriptionStatus.value?.cancel_at)
    )
    mockBillingStatus.value = { ...DEFAULT_BILLING_STATUS }
  })

  it('selects workspace type for a Cloud personal workspace', () => {
    mockIsPersonal.value = true

    const { type } = useBillingContext()
    expect(type.value).toBe('workspace')
  })

  it('selects workspace type for a Cloud team workspace', () => {
    mockIsPersonal.value = false

    const { type } = useBillingContext()
    expect(type.value).toBe('workspace')
  })

  it('provides subscription info from legacy billing', () => {
    mockBillingRail.value = 'legacy_stripe'
    const { subscription } = useBillingContext()

    expect(subscription.value).toEqual({
      isActive: true,
      tier: 'PRO',
      duration: 'MONTHLY',
      planSlug: null,
      scheduledChange: null,
      renewalDate: '2025-01-01T00:00:00Z',
      endDate: null,
      isCancelled: false,
      hasFunds: true,
      agentHasFunds: true
    })
  })

  it('re-arms the exhaustion impression after workspace-scoped Agent funds recover while the dock is closed', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    mockBillingRail.value = 'stripe'
    mockBillingStatus.value = {
      ...DEFAULT_BILLING_STATUS,
      has_funds: false,
      scoped_effective_has_funds: { agent: false }
    }
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const billing = scope.run(useSharedBillingContext)
    assert.exists(billing)
    const dock = scope.run(useAgentDockMount)
    assert.exists(dock)
    const agentPanelStore = useAgentPanelStore()
    agentPanelStore.isOpen = false
    agentPanelStore.reportedExhaustionIdentity = 'account-a:workspace-a'

    await billing.fetchStatus()
    expect(dock.docked.value).toBe(false)

    mockBillingStatus.value.scoped_effective_has_funds = { agent: true }
    await billing.fetchStatus()
    await nextTick()

    expect(agentPanelStore.reportedExhaustionIdentity).toBeNull()
  })

  describe('canRunWorkflows', () => {
    it('is true when not on free tier', async () => {
      remoteConfigState.value = 'authenticated'
      authenticatedRemoteConfigState.value = 'authenticated'
      useSubscription().subscriptionTier = computed(() => 'PRO')
      mockIsCloud.value = true
      mockFreeTierExecutionPermitted.value = false
      const context = useBillingContext()
      await context.initialize()
      expect(context.canRunWorkflows.value).toBe(true)
    })

    it('is true when on free tier and freeTierExecutionPermitted is true', async () => {
      remoteConfigState.value = 'authenticated'
      authenticatedRemoteConfigState.value = 'authenticated'
      useSubscription().subscriptionTier = computed(() => 'FREE')
      mockBillingStatus.value.subscription_tier = 'FREE'
      useSubscription().subscriptionStatus.value = {
        ...useSubscription().subscriptionStatus.value!,
        subscription_tier: 'FREE'
      }
      mockIsCloud.value = true
      mockFreeTierExecutionPermitted.value = true
      const context = useBillingContext()
      await context.initialize()
      expect(context.canRunWorkflows.value).toBe(true)
    })

    it('is false when on free tier on cloud and freeTierExecutionPermitted is false', async () => {
      remoteConfigState.value = 'authenticated'
      authenticatedRemoteConfigState.value = 'authenticated'
      useSubscription().subscriptionTier = computed(() => 'FREE')
      mockBillingStatus.value.subscription_tier = 'FREE'
      useSubscription().subscriptionStatus.value = {
        ...useSubscription().subscriptionStatus.value!,
        subscription_tier: 'FREE'
      }
      mockIsCloud.value = true
      mockFreeTierExecutionPermitted.value = false
      const context = useBillingContext()
      await context.initialize()
      expect(context.canRunWorkflows.value).toBe(false)
    })

    it('is true when on free tier off cloud even if freeTierExecutionPermitted is false', async () => {
      remoteConfigState.value = 'authenticated'
      authenticatedRemoteConfigState.value = 'authenticated'
      useSubscription().subscriptionTier = computed(() => 'FREE')
      mockBillingStatus.value.subscription_tier = 'FREE'
      useSubscription().subscriptionStatus.value = {
        ...useSubscription().subscriptionStatus.value!,
        subscription_tier: 'FREE'
      }
      mockIsCloud.value = false
      mockFreeTierExecutionPermitted.value = false
      const context = useBillingContext()
      await context.initialize()
      expect(context.canRunWorkflows.value).toBe(true)
    })

    it('is true when config is not loaded, even if freeTierExecutionPermitted is false', async () => {
      remoteConfigState.value = 'unloaded'
      authenticatedRemoteConfigState.value = 'unloaded'
      useSubscription().subscriptionTier = computed(() => 'FREE')
      mockBillingStatus.value.subscription_tier = 'FREE'
      useSubscription().subscriptionStatus.value = {
        ...useSubscription().subscriptionStatus.value!,
        subscription_tier: 'FREE'
      }
      mockIsCloud.value = true
      mockFreeTierExecutionPermitted.value = false
      const context = useBillingContext()
      await context.initialize()
      expect(context.canRunWorkflows.value).toBe(true)
    })
  })

  it('forwards the renewal invoice from workspace billing', async () => {
    const invoice = {
      hosted_invoice_url: 'https://invoice.stripe.com/i/test',
      amount_due: 5000,
      currency: 'usd'
    }
    mockBillingRail.value = 'stripe'
    mockBillingStatus.value.renewal_invoice = invoice

    const context = useBillingContext()
    await context.initialize()

    expect(context.renewalInvoice.value).toStrictEqual(invoice)
  })

  it('provides balance info from legacy billing', () => {
    mockBillingRail.value = 'legacy_stripe'
    const { balance } = useBillingContext()

    expect(balance.value).toEqual({
      amountMicros: 5000000,
      currency: 'usd',
      effectiveBalanceMicros: 5000000,
      prepaidBalanceMicros: 0,
      cloudCreditBalanceMicros: 0
    })
  })

  it('passes canonical status fields through legacy billing', () => {
    mockBillingRail.value = 'legacy_stripe'
    useSubscription().subscriptionStatus.value = {
      ...DEFAULT_BILLING_STATUS,
      billing_status: 'payment_failed',
      subscription_status: 'ended',
      team_credit_stop: {
        id: 'stop-1',
        credits_monthly: 1000,
        stop_usd: 10
      }
    }

    const { billingStatus, subscriptionStatus, currentTeamCreditStop } =
      useBillingContext()

    expect(billingStatus.value).toBe('payment_failed')
    expect(subscriptionStatus.value).toBe('ended')
    expect(currentTeamCreditStop.value).toEqual({
      id: 'stop-1',
      credits_monthly: 1000,
      stop_usd: 10
    })
  })

  it('exposes initialize action', async () => {
    const { initialize } = useBillingContext()
    await expect(initialize()).resolves.toBeUndefined()
  })

  it('exposes fetchStatus action', async () => {
    const { fetchStatus } = useBillingContext()
    await expect(fetchStatus()).resolves.toBeUndefined()
  })

  it('exposes fetchBalance action', async () => {
    const { fetchBalance } = useBillingContext()
    await expect(fetchBalance()).resolves.toBeUndefined()
  })

  it('exposes subscribe action', async () => {
    const { subscribe } = useBillingContext()
    await expect(subscribe('pro-monthly')).resolves.toEqual({
      status: 'subscribed'
    })
  })

  it('exposes manageSubscription action', async () => {
    mockBillingRail.value = 'legacy_stripe'
    const { manageSubscription } = useBillingContext()
    await expect(manageSubscription()).resolves.toBeUndefined()
  })

  it('converts topup cents to whole dollars for the legacy credit endpoint', async () => {
    mockBillingRail.value = 'legacy_stripe'
    const { topup } = useBillingContext()
    await topup(500)

    expect(useAuthActions().purchaseCreditsDirect).toHaveBeenCalledWith(5)
  })

  it('uses workspace checkout while keeping legacy topups on legacy Stripe', async () => {
    mockBillingRail.value = 'legacy_stripe'
    mockPlans.value = [
      {
        slug: 'creator-annual',
        tier: 'CREATOR',
        duration: 'ANNUAL',
        price_cents: 33600,
        credits_cents: 42086,
        max_seats: 1,
        availability: { available: true },
        seat_summary: {
          seat_count: 1,
          total_cost_cents: 33600,
          total_credits_cents: 42086
        }
      }
    ]

    const context = useBillingContext()
    vi.clearAllMocks()

    expect(context.type.value).toBe('legacy')
    expect(context.plans.value).toEqual(mockPlans.value)

    await context.fetchPlans()
    await context.fetchStatus()

    expect(mockFetchPlans).toHaveBeenCalledOnce()
    expect(useSubscription().fetchStatus).toHaveBeenCalled()
    expect(workspaceApi.getBillingStatus).not.toHaveBeenCalled()

    await context.previewSubscribe('creator-annual')
    await context.subscribe('creator-annual')
    await context.topup(500)

    expect(workspaceApi.previewSubscribe).toHaveBeenCalledWith(
      'creator-annual',
      undefined
    )
    expect(workspaceApi.subscribe).toHaveBeenCalledWith(
      'creator-annual',
      undefined
    )
    expect(useSubscription().subscribeDirect).not.toHaveBeenCalled()
    expect(useAuthActions().purchaseCreditsDirect).toHaveBeenCalledWith(5)
  })

  it('routes migrated legacy Stripe topups through workspace billing', async () => {
    remoteConfig.value = { legacy_billing_migration_enabled: true }
    remoteConfigState.value = 'authenticated'
    authenticatedRemoteConfigState.value = 'authenticated'
    mockBillingRail.value = 'legacy_stripe'

    const context = useBillingContext()
    await nextTick()
    vi.clearAllMocks()

    expect(context.type.value).toBe('workspace')
    await context.topup(500)

    expect(workspaceApi.createTopup).toHaveBeenCalledWith(500)
    expect(useAuthActions().purchaseCreditsDirect).not.toHaveBeenCalled()
  })

  it('switches billing adapters before refreshing a migrated balance', async () => {
    mockBillingRail.value = 'legacy_stripe'
    mockBillingStatus.value = {
      ...DEFAULT_BILLING_STATUS,
      billing_rail: 'stripe'
    }

    const context = useBillingContext()
    await vi.waitFor(() => {
      expect(useSubscription().fetchStatus).toHaveBeenCalled()
      expect(useAuthStore().fetchBalance).toHaveBeenCalled()
    })
    vi.clearAllMocks()

    await context.reconcileSubscriptionSuccess()

    expect(
      useTeamWorkspaceStore().setWorkspaceBillingRail
    ).toHaveBeenCalledWith('personal-123', 'stripe')
    expect(context.type.value).toBe('workspace')
    expect(workspaceApi.getBillingStatus).toHaveBeenCalled()
    expect(workspaceApi.getBillingBalance).toHaveBeenCalled()
    expect(useSubscription().fetchStatus).not.toHaveBeenCalled()
    expect(useAuthStore().fetchBalance).not.toHaveBeenCalled()
  })

  it('does not refresh a balance through a stale rail after discovery fails', async () => {
    mockBillingRail.value = 'legacy_stripe'

    const context = useBillingContext()
    await vi.waitFor(() => {
      expect(useSubscription().fetchStatus).toHaveBeenCalled()
      expect(useAuthStore().fetchBalance).toHaveBeenCalled()
    })
    vi.clearAllMocks()
    vi.mocked(workspaceApi.getBillingStatus).mockRejectedValueOnce(
      new Error('status unavailable')
    )

    await expect(context.reconcileSubscriptionSuccess()).rejects.toThrow(
      'status unavailable'
    )

    expect(workspaceApi.getBillingBalance).not.toHaveBeenCalled()
    expect(useAuthStore().fetchBalance).not.toHaveBeenCalled()
  })

  it.for([
    { pending: 'op-1', found: true },
    { pending: undefined, found: false }
  ])(
    'finds an operation the server reports after the first read (pending: $pending)',
    async ({ pending, found }) => {
      const context = useBillingContext()
      await vi.waitFor(() =>
        expect(workspaceApi.getBillingStatus).toHaveBeenCalled()
      )
      vi.clearAllMocks()
      mockBillingStatus.value = {
        ...DEFAULT_BILLING_STATUS,
        pending_billing_op_id: pending
      }

      await expect(context.readCheckoutOperation()).resolves.toBe(found)

      expect(workspaceApi.getBillingStatus).toHaveBeenCalledOnce()
      expect(workspaceApi.getBillingBalance).not.toHaveBeenCalled()
    }
  )

  it('rejects topup amounts that are not positive whole-dollar cents', async () => {
    const { topup } = useBillingContext()
    await expect(topup(550)).rejects.toThrow()
    await expect(topup(0)).rejects.toThrow()
    await expect(topup(-100)).rejects.toThrow()
    await expect(topup(99.5)).rejects.toThrow()
  })

  it('provides canAccessSubscriptionFeatures convenience computed', () => {
    mockBillingRail.value = 'legacy_stripe'
    const { canAccessSubscriptionFeatures } = useBillingContext()
    expect(canAccessSubscriptionFeatures.value).toBe(true)
  })

  it('exposes requireActiveSubscription action', async () => {
    const { requireActiveSubscription } = useBillingContext()
    await expect(requireActiveSubscription()).resolves.toBeUndefined()
  })

  it('exposes showSubscriptionDialog action', () => {
    const { showSubscriptionDialog } = useBillingContext()
    expect(() => showSubscriptionDialog()).not.toThrow()
  })

  it('reports the rail in effect when cancelSubscription was dispatched, not the one after it resolves', async () => {
    mockBillingRail.value = 'legacy_stripe'
    let finishPortal!: () => void
    vi.mocked(useSubscription().manageSubscription).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishPortal = resolve
      })
    )
    const context = useBillingContext()
    expect(context.type.value).toBe('legacy')

    const cancelling = context.cancelSubscription()
    await vi.waitFor(() =>
      expect(useSubscription().manageSubscription).toHaveBeenCalled()
    )
    mockIsPersonal.value = false
    expect(context.type.value).toBe('workspace')
    finishPortal()

    expect(await cancelling).toBe('legacy')
  })

  describe('workspace not loaded yet', () => {
    function holdWorkspaceUnloaded(type: 'personal' | 'team') {
      const loaded = ref(false)
      const workspaceStore = useTeamWorkspaceStore()
      Object.assign(workspaceStore, {
        activeWorkspace: computed(() =>
          loaded.value
            ? fromPartial<NonNullable<typeof workspaceStore.activeWorkspace>>({
                id: `${type}-1`,
                type
              })
            : null
        )
      })
      return loaded
    }

    it('makes no billing call while unknown, then routes to legacy for a personal legacy_stripe workspace', async () => {
      const loaded = holdWorkspaceUnloaded('personal')
      mockBillingRail.value = 'legacy_stripe'
      const context = useBillingContext()
      vi.clearAllMocks()

      const initializing = context.initialize()
      await context.fetchStatus()
      await context.fetchBalance()

      expect(context.type.value).toBe('unknown')
      expect(useSubscription().fetchStatus).not.toHaveBeenCalled()
      expect(useAuthStore().fetchBalance).not.toHaveBeenCalled()
      expect(workspaceApi.getBillingStatus).not.toHaveBeenCalled()

      loaded.value = true
      await initializing

      expect(context.isInitialized.value).toBe(true)
      expect(useSubscription().fetchStatus).toHaveBeenCalled()
      expect(context.type.value).toBe('legacy')
      expect(workspaceApi.getBillingStatus).not.toHaveBeenCalled()
    })

    it('makes no billing call while unknown, then routes to workspace billing for a team', async () => {
      const loaded = holdWorkspaceUnloaded('team')
      const context = useBillingContext()
      vi.clearAllMocks()

      const initializing = context.initialize()
      await context.fetchStatus()

      expect(context.type.value).toBe('unknown')
      expect(workspaceApi.getBillingStatus).not.toHaveBeenCalled()
      expect(useSubscription().fetchStatus).not.toHaveBeenCalled()

      loaded.value = true
      await initializing

      expect(workspaceApi.getBillingStatus).toHaveBeenCalled()
      expect(context.type.value).toBe('workspace')
      expect(useSubscription().fetchStatus).not.toHaveBeenCalled()
    })

    it('reports a presentable error once if the workspace never loads', async () => {
      vi.useFakeTimers()
      onTestFinished(() => {
        vi.useRealTimers()
      })
      holdWorkspaceUnloaded('team')
      const context = useBillingContext()
      vi.clearAllMocks()

      const outcome = context.topup(500)
      await vi.advanceTimersByTimeAsync(10_000)
      await outcome

      expect(
        useErrorHandling().toastErrorHandler
      ).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          message: "We couldn't reach your account. Try again in a moment."
        })
      )
      expect(workspaceApi.createTopup).not.toHaveBeenCalled()
    })

    it.for([
      {
        name: 'cancelSubscription',
        run: (context: ReturnType<typeof useBillingContext>) =>
          context.cancelSubscription()
      },
      {
        name: 'resubscribe',
        run: (context: ReturnType<typeof useBillingContext>) =>
          context.resubscribe()
      }
    ])(
      'rejects $name for its caller to show if the workspace never loads',
      async ({ run }) => {
        vi.useFakeTimers()
        onTestFinished(() => {
          vi.useRealTimers()
        })
        holdWorkspaceUnloaded('team')
        const context = useBillingContext()
        vi.clearAllMocks()

        const outcome = run(context).then(
          () => 'resolved',
          (error: unknown) => error
        )
        await vi.advanceTimersByTimeAsync(10_000)

        expect(await outcome).toMatchObject({
          message: "We couldn't reach your account. Try again in a moment."
        })
        expect(useErrorHandling().toastErrorHandler).not.toHaveBeenCalled()
      }
    )

    it('drops an action silently when the workspace changed during the wait', async () => {
      const current = ref<{ id: string; type?: 'team' }>({ id: 'ws-a' })
      const workspaceStore = useTeamWorkspaceStore()
      Object.assign(workspaceStore, {
        activeWorkspace: computed(() =>
          fromPartial<NonNullable<typeof workspaceStore.activeWorkspace>>(
            current.value
          )
        )
      })
      const context = useBillingContext()
      vi.clearAllMocks()

      const pending = context.topup(500)
      await nextTick()
      current.value = { id: 'ws-b', type: 'team' }
      await pending

      expect(workspaceApi.createTopup).not.toHaveBeenCalled()
      expect(useErrorHandling().toastErrorHandler).not.toHaveBeenCalled()
    })

    it.for([
      {
        name: 'cancelSubscription',
        run: (context: ReturnType<typeof useBillingContext>) =>
          context.cancelSubscription()
      },
      {
        name: 'resubscribe',
        run: (context: ReturnType<typeof useBillingContext>) =>
          context.resubscribe()
      }
    ])(
      'rejects $name for its caller to show if the workspace changed during the wait',
      async ({ run }) => {
        const current = ref<{ id: string; type?: 'team' }>({ id: 'ws-a' })
        const workspaceStore = useTeamWorkspaceStore()
        Object.assign(workspaceStore, {
          activeWorkspace: computed(() =>
            fromPartial<NonNullable<typeof workspaceStore.activeWorkspace>>(
              current.value
            )
          )
        })
        const context = useBillingContext()
        vi.clearAllMocks()

        const outcome = run(context).then(
          () => 'resolved',
          (error: unknown) => error
        )
        await nextTick()
        current.value = { id: 'ws-b', type: 'team' }

        expect(await outcome).toMatchObject({
          message: 'Your active workspace changed. Switch back and try again.'
        })
        expect(useErrorHandling().toastErrorHandler).not.toHaveBeenCalled()
      }
    )

    it('holds previewSubscribe and requireActiveSubscription until the workspace loads', async () => {
      const loaded = holdWorkspaceUnloaded('team')
      const context = useBillingContext()
      vi.clearAllMocks()

      const preview = context.previewSubscribe('creator-annual')
      const require = context.requireActiveSubscription()
      await nextTick()
      expect(workspaceApi.previewSubscribe).not.toHaveBeenCalled()

      loaded.value = true
      await Promise.all([preview, require])

      expect(workspaceApi.previewSubscribe).toHaveBeenCalledOnce()
    })

    it('holds reconcile, checkout-operation reads, plans and the subscription dialog until the workspace loads', async () => {
      const loaded = holdWorkspaceUnloaded('team')
      const context = useBillingContext()
      vi.clearAllMocks()

      const reconcile = context.reconcileSubscriptionSuccess()
      const operation = context.readCheckoutOperation()
      const plans = context.fetchPlans()
      context.showSubscriptionDialog({ reason: 'subscription_required' })
      await nextTick()
      expect(workspaceApi.getBillingStatus).not.toHaveBeenCalled()
      expect(mockFetchPlans).not.toHaveBeenCalled()
      expect(useSubscriptionDialog().show).not.toHaveBeenCalled()

      loaded.value = true
      await Promise.all([reconcile, operation, plans])

      expect(workspaceApi.getBillingStatus).toHaveBeenCalled()
      expect(mockFetchPlans).toHaveBeenCalled()
      expect(useSubscriptionDialog().show).toHaveBeenCalled()
    })

    it('holds a user-initiated action until the workspace loads', async () => {
      const loaded = holdWorkspaceUnloaded('team')
      const context = useBillingContext()
      vi.clearAllMocks()

      const pending = context.topup(500)
      await nextTick()
      expect(workspaceApi.createTopup).not.toHaveBeenCalled()

      loaded.value = true
      await pending

      expect(workspaceApi.createTopup).toHaveBeenCalledWith(500)
      expect(useAuthActions().purchaseCreditsDirect).not.toHaveBeenCalled()
    })
  })

  describe('subscription mirror to workspace store', () => {
    it('mirrors subscription for personal workspaces', async () => {
      mockIsPersonal.value = true

      const { initialize } = useBillingContext()
      await initialize()
      await nextTick()

      expect(
        useTeamWorkspaceStore().updateActiveWorkspace
      ).toHaveBeenCalledWith({
        isSubscribed: true,
        subscriptionPlan: null
      })
    })

    it('never clobbers the list-derived store when a subscription is absent', async () => {
      mockIsPersonal.value = false

      const { initialize } = useBillingContext()
      await initialize()
      await nextTick()

      expect(
        useTeamWorkspaceStore().updateActiveWorkspace
      ).not.toHaveBeenCalledWith({
        isSubscribed: false,
        subscriptionPlan: null
      })
    })
  })

  describe('getMaxSeats', () => {
    it('uses plan seat limits for Cloud personal workspaces', () => {
      const { getMaxSeats } = useBillingContext()
      expect(getMaxSeats('standard')).toBe(1)
      expect(getMaxSeats('creator')).toBe(5)
      expect(getMaxSeats('pro')).toBe(20)
      expect(getMaxSeats('founder')).toBe(1)
    })

    it('falls back to hardcoded values when no API plans available', () => {
      mockIsPersonal.value = false

      const { getMaxSeats } = useBillingContext()
      expect(getMaxSeats('standard')).toBe(1)
      expect(getMaxSeats('creator')).toBe(5)
      expect(getMaxSeats('pro')).toBe(20)
      expect(getMaxSeats('founder')).toBe(1)
    })

    it('prefers API max_seats when plans are loaded', () => {
      mockIsPersonal.value = false
      mockPlans.value = [
        {
          slug: 'pro-monthly',
          tier: 'PRO',
          duration: 'MONTHLY',
          price_cents: 10000,
          credits_cents: 2110000,
          max_seats: 50,
          availability: { available: true },
          seat_summary: {
            seat_count: 1,
            total_cost_cents: 10000,
            total_credits_cents: 2110000
          }
        }
      ]

      const { getMaxSeats } = useBillingContext()
      expect(getMaxSeats('pro')).toBe(50)
      // Tiers without API plans still fall back to hardcoded values
      expect(getMaxSeats('creator')).toBe(5)
    })
  })

  describe('isLegacyTeamPlan', () => {
    it('is false for a personal workspace', () => {
      const { isLegacyTeamPlan } = useBillingContext()
      expect(isLegacyTeamPlan.value).toBe(false)
    })

    it('is true for an active team plan: team- slug and no credit stop', async () => {
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'STANDARD',
        subscription_duration: 'ANNUAL',
        plan_slug: 'team-standard-annual'
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(true)
    })

    it('is true for any legacy team tier, not just standard', async () => {
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'PRO',
        subscription_duration: 'ANNUAL',
        plan_slug: 'team-pro-annual'
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(true)
    })

    it('is false for a new credit-slider team subscriber', async () => {
      mockIsPersonal.value = false
      // Real BE shape: underscore slug, populated credit stop, tier 'TEAM'.
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'TEAM',
        subscription_status: 'active',
        subscription_duration: 'ANNUAL',
        plan_slug: 'team_per_credit_annual',
        team_credit_stop: {
          id: 'team_700',
          credits_monthly: 147700,
          stop_usd: 700
        }
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(false)
    })

    it('is false for a new team sub even before its credit stop is populated', async () => {
      mockIsPersonal.value = false
      // Provisioning lag: credit stop not yet attached. The underscore slug
      // (team_per_credit, not team-) must still exclude it from the legacy table.
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_status: 'active',
        subscription_duration: 'ANNUAL',
        plan_slug: 'team_per_credit_annual'
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(false)
    })

    it('is false for a team workspace on a personal-tier plan', async () => {
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'STANDARD',
        subscription_duration: 'ANNUAL',
        plan_slug: 'standard-annual'
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(false)
    })

    it('stays true for a cancelled-but-still-active legacy team sub', async () => {
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_status: 'canceled',
        subscription_tier: 'STANDARD',
        subscription_duration: 'ANNUAL',
        plan_slug: 'team-standard-annual',
        cancel_at: '2099-01-01T00:00:00Z'
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(true)
    })

    it('is false for a FREE-tier team even on a team- prefixed slug', async () => {
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'FREE',
        plan_slug: 'team-free'
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(false)
    })

    it('matches the legacy slug case-insensitively', async () => {
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'STANDARD',
        subscription_duration: 'ANNUAL',
        plan_slug: 'Team-Standard-Annual'
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(true)
    })
  })

  describe('isTeamPlan', () => {
    it('is false for a personal workspace', () => {
      const { isTeamPlan } = useBillingContext()
      expect(isTeamPlan.value).toBe(false)
    })

    it('is true for a credit-slider team sub, which carries a credit stop', async () => {
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'TEAM',
        plan_slug: 'team_per_credit_monthly',
        team_credit_stop: {
          id: 'team_700',
          credits_monthly: 700,
          stop_usd: 332
        }
      }

      const { initialize, isTeamPlan } = useBillingContext()
      await initialize()

      expect(isTeamPlan.value).toBe(true)
    })

    it('is true for a per-credit Team plan in a personal workspace before its credit stop is populated', async () => {
      mockIsPersonal.value = true
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_status: 'active',
        subscription_duration: 'ANNUAL',
        plan_slug: 'team_per_credit_annual'
      }

      const { initialize, isTeamPlan } = useBillingContext()
      await initialize()

      expect(isTeamPlan.value).toBe(true)
    })

    it('is true for a legacy team sub, identified by slug rather than credit stop', async () => {
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'STANDARD',
        plan_slug: 'team-standard-annual'
      }

      const { initialize, isTeamPlan } = useBillingContext()
      await initialize()

      expect(isTeamPlan.value).toBe(true)
    })

    // The banner states that need isTeamPlan most — paused and payment_failed —
    // are exactly the ones the backend reports with is_active=false, because the
    // spend gate folds billing_status into it. Coupling isTeamPlan to an active
    // subscription would blank the banner precisely when it is needed.
    it('stays true for a paused team plan, which the backend reports inactive', async () => {
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: false,
        has_funds: true,
        billing_status: 'paused',
        plan_slug: 'team_per_credit_monthly',
        team_credit_stop: {
          id: 'team_700',
          credits_monthly: 700,
          stop_usd: 332
        }
      }

      const { initialize, isTeamPlan } = useBillingContext()
      await initialize()

      expect(isTeamPlan.value).toBe(true)
    })

    it('stays true for a legacy team plan whose payment failed', async () => {
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: false,
        has_funds: true,
        billing_status: 'payment_failed',
        subscription_tier: 'STANDARD',
        plan_slug: 'team-standard-annual'
      }

      const { initialize, isTeamPlan } = useBillingContext()
      await initialize()

      expect(isTeamPlan.value).toBe(true)
    })

    it('is false for a team workspace on a personal-tier plan', async () => {
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'PRO',
        plan_slug: 'pro-monthly'
      }

      const { initialize, isTeamPlan } = useBillingContext()
      await initialize()

      expect(isTeamPlan.value).toBe(false)
    })
  })
})
