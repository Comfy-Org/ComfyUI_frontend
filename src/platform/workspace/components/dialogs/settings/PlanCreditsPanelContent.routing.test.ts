import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { ref } from 'vue'

import { render, screen, waitFor } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json'
import { useBillingPlans } from '@/platform/cloud/subscription/composables/useBillingPlans'
import type {
  BillingPlansResponse,
  Plan
} from '@/platform/workspace/api/workspaceApi'

import PlanCreditsPanelContent from './PlanCreditsPanelContent.vue'

// The panel's real defect was a routing one: it fetched through
// useBillingContext (which lands on the legacy no-op before the workspace
// hydrates) while reading state from the useBillingPlans singleton that only
// the workspace adapter writes. These tests therefore run the REAL
// useBillingContext / useBillingRouting / useBillingPlans and mock only what
// this repo owns at its edges: the HTTP client and the workspace store's state.

type InitState = 'uninitialized' | 'loading' | 'ready' | 'error'

const workspace = vi.hoisted(() => ({
  initialize: vi.fn(async () => {})
}))

// Reactive so a bootstrap that resolves mid-test re-drives the panel exactly as
// the real store would.
const state = {
  initState: ref<InitState>('ready'),
  error: ref<Error | null>(null),
  active: ref<{ id: string; type: string } | null>({
    id: 'ws-1',
    type: 'personal'
  })
}

const api = vi.hoisted(() => ({
  getBillingPlans: vi.fn(),
  getBillingStatus: vi.fn(async () => ({
    is_active: false,
    has_funds: true,
    team_credit_stop: null
  })),
  getBillingBalance: vi.fn(async () => ({ amount_micros: 0 }))
}))

vi.mock('@/platform/distribution/types', () => ({ isCloud: false }))

// Siblings of the plans section; irrelevant here and each drags in the app graph.
vi.mock('@/components/dialog/content/setting/CreditsPanel.vue', () => ({
  default: { template: '<section />' }
}))
vi.mock('@/components/dialog/content/setting/UsageLogsTable.vue', () => ({
  default: { template: '<section />', methods: { refresh: () => {} } }
}))
vi.mock(
  '@/platform/cloud/subscription/components/SubscriptionFooterLinks.vue',
  () => ({ default: { template: '<footer />' } })
)
vi.mock(
  '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue',
  () => ({ default: { template: '<section />' } })
)

// The legacy adapter itself stays REAL — its no-op fetchPlans is the mechanism
// under test — but its Firebase-backed collaborators are stubbed out.
vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    canAccessSubscriptionFeatures: ref(false),
    subscriptionTier: ref(null),
    subscriptionDuration: ref(null),
    subscriptionStatus: ref(null),
    isCancelled: ref(false),
    fetchStatus: vi.fn(async () => {}),
    manageSubscription: vi.fn(),
    subscribe: vi.fn(),
    subscribeDirect: vi.fn(),
    showSubscriptionDialog: vi.fn()
  })
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ isLoggedIn: ref(true), balance: ref(null) })
}))
vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({ purchaseCredits: vi.fn(), fetchBalance: vi.fn() })
}))

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: api,
  WorkspaceApiError: class extends Error {}
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get initState() {
      return state.initState.value
    },
    get error() {
      return state.error.value
    },
    get activeWorkspace() {
      return state.active.value
    },
    get activeWorkspaceBillingRail() {
      return undefined
    },
    get isPersonalWorkspace() {
      return true
    },
    initialize: workspace.initialize,
    updateActiveWorkspace: vi.fn(),
    setWorkspaceBillingRail: vi.fn()
  })
}))

function makePlan(
  tier: Plan['tier'],
  duration: Plan['duration'],
  price_cents: number,
  credits_cents: number
): Plan {
  return {
    slug: `${tier.toLowerCase()}-${duration.toLowerCase()}`,
    tier,
    duration,
    price_cents,
    credits_cents,
    max_seats: 1,
    availability: { available: true },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: price_cents,
      total_credits_cents: credits_cents
    }
  }
}

const CATALOG: BillingPlansResponse = {
  plans: [makePlan('STANDARD', 'ANNUAL', 24000, 50400)]
}

function renderPanel() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return render(PlanCreditsPanelContent, { global: { plugins: [i18n] } })
}

const EMPTY_COPY = 'No plans are available right now. Check back soon.'
const ERROR_COPY = "We couldn't load your plan details."

// useBillingPlans is a module singleton; reset the state each test rather than
// resetting the module graph (a fresh graph deadlocks on the workspace).
beforeEach(() => {
  const billingPlans = useBillingPlans()
  billingPlans.plans.value = []
  billingPlans.teamCreditStops.value = null
  billingPlans.currentPlanSlug.value = null
  billingPlans.isLoading.value = false
  billingPlans.error.value = null

  state.initState.value = 'ready'
  state.error.value = null
  state.active.value = { id: 'ws-1', type: 'personal' }
  workspace.initialize.mockReset()
  workspace.initialize.mockImplementation(async () => {})
  api.getBillingPlans.mockReset()
  api.getBillingPlans.mockResolvedValue(CATALOG)
})

describe('PlanCreditsPanelContent — workspace bootstrap drives the plans state', () => {
  it('shows the loading state until the workspace hydrates, then the catalog', async () => {
    state.initState.value = 'loading'
    state.active.value = null

    renderPanel()

    expect(await screen.findByText('Loading')).toBeTruthy()
    expect(screen.queryAllByText(EMPTY_COPY)).toHaveLength(0)
    expect(api.getBillingPlans).not.toHaveBeenCalled()

    state.initState.value = 'ready'
    state.active.value = { id: 'ws-1', type: 'personal' }

    expect(await screen.findByText('$20')).toBeTruthy()
    expect(screen.getByText('50,400')).toBeTruthy()
    expect(screen.queryByText('Loading')).toBeNull()
    expect(api.getBillingPlans).toHaveBeenCalledOnce()
  })

  it('shows a retryable error when the workspace bootstrap failed, and recovers', async () => {
    state.initState.value = 'error'
    state.error.value = new Error('workspaces unavailable')
    state.active.value = null

    renderPanel()

    expect((await screen.findAllByText(ERROR_COPY)).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(EMPTY_COPY)).toHaveLength(0)

    // Retry re-runs the workspace bootstrap; the billing context's workspace
    // watch is what then fetches the catalog.
    workspace.initialize.mockImplementation(async () => {
      state.initState.value = 'ready'
      state.active.value = { id: 'ws-1', type: 'personal' }
    })

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Try again' })[0]
    )

    expect(workspace.initialize).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(screen.getAllByText('$20').length).toBeGreaterThan(0)
    )
  })

  it('retries the bootstrap when the wallet resolved to no workspace at all', async () => {
    // initState says 'ready' but no workspace landed, so routing is still
    // 'legacy' and a plain refetch would hit the no-op forever.
    state.initState.value = 'ready'
    state.active.value = null

    renderPanel()

    expect((await screen.findAllByText(ERROR_COPY)).length).toBeGreaterThan(0)

    workspace.initialize.mockImplementation(async () => {
      state.active.value = { id: 'ws-1', type: 'personal' }
    })
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Try again' })[0]
    )

    expect(workspace.initialize).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(screen.getAllByText('$20').length).toBeGreaterThan(0)
    )
  })

  it('shows the empty state without a retry for a successful but empty catalog', async () => {
    api.getBillingPlans.mockResolvedValue({ plans: [] })

    renderPanel()

    expect((await screen.findAllByText(EMPTY_COPY)).length).toBeGreaterThan(0)
    expect(screen.queryByText(ERROR_COPY)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('shows a retryable error when the catalog fetch fails, and recovers', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    api.getBillingPlans.mockRejectedValueOnce(new Error('plans exploded'))

    renderPanel()

    expect((await screen.findAllByText(ERROR_COPY)).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(EMPTY_COPY)).toHaveLength(0)

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Try again' })[0]
    )

    await waitFor(() =>
      expect(screen.getAllByText('$20').length).toBeGreaterThan(0)
    )
    // Retry re-fetches the catalog rather than re-running the bootstrap.
    expect(workspace.initialize).not.toHaveBeenCalled()
  })
})
