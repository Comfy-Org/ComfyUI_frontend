import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { effectScope, nextTick, computed } from 'vue'
import type { Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
import { useAuthStore } from '@/stores/authStore'
import { useSubscription } from '@/platform/billing/subscription/composables/useSubscription'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAgentDockMount } from '@/workbench/extensions/agent/composables/useAgentDockMount'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

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

import { useBillingContext as useSharedBillingContext } from '@/platform/billing/composables/useBillingContext'

vi.mock(import('firebase/auth'))
vi.mock(import('@/composables/useErrorHandling'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'))

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

vi.mock(import('@/platform/billing/subscription/composables/useSubscription'))

vi.mock<unknown>(
  import('@/platform/billing/subscription/composables/useFreeTierQuota'),
  () => ({
    useFreeTierQuota: () => ({
      quotaEnabled: { value: false },
      get freeTierExecutionPermitted() {
        return mockFreeTierExecutionPermitted
      }
    })
  })
)

vi.mock(import('@/composables/auth/useAuthActions'))

vi.mock<unknown>(
  import('@/platform/billing/subscription/composables/useBillingPlans'),
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

describe('useAgentDockMount with the real billing context', () => {
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
})
