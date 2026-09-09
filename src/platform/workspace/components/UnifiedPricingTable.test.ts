import type { SubscriptionTier } from '@comfyorg/ingest-types'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import enMessages from '@/locales/en/main.json'
import type {
  BillingSubscriptionStatus,
  Plan
} from '@/platform/workspace/api/workspaceApi'
import UnifiedPricingTable from '@/platform/workspace/components/UnifiedPricingTable.vue'

function apiPlan(
  tier: Plan['tier'],
  duration: Plan['duration'],
  credits: number
): Plan {
  return {
    availability: { available: true },
    credits_cents: credits,
    duration,
    max_seats: 5,
    price_cents: 2000,
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 2000,
      total_credits_cents: credits
    },
    slug: `${tier.toLowerCase()}-${duration.toLowerCase()}`,
    tier
  }
}

interface MockSubscription {
  tier: SubscriptionTier | null
  isCancelled?: boolean
  duration?: string
  scheduledChange?: { plan_slug: string; effective_at: string }
}

interface MockTeamStop {
  id: string
  credits_monthly: number
  stop_usd: number
}

const mockSubscription = ref<MockSubscription | null>(null)
const mockSubscriptionStatus = ref<BillingSubscriptionStatus | null>(null)
const mockCurrentPlanSlug = ref<string | null>(null)
const mockCurrentTeamCreditStop = ref<MockTeamStop | null>(null)
const mockIsTeamPlan = ref(false)
const mockCanManageSubscription = ref(true)
const mockCanDowngradeToPersonal = ref(true)
const mockCanChangeSeats = ref<boolean | null>(null)
const mockCapabilityReadFailed = ref(false)
const mockSnapshotResolved = ref(true)
const mockRetryCapabilityRead = vi.fn()
const mockShouldUseWorkspaceBilling = ref(true)
const mockRawCanReactivate = ref(true)
const mockSnapshotAuthoritative = ref(true)
const mockPermissions = ref({
  canManageSubscription: true,
  canManageSubscriptionLifecycle: true,
  canDowngradeToPersonal: true
})
const mockDistributionTypes = vi.hoisted(() => ({ isCloud: true }))
const mockApiPlans = vi.hoisted(() => ({ value: [] as Plan[] }))

vi.mock<unknown>(import('@/composables/billing/useBillingContext'), () => ({
  useBillingContext: () => ({
    plans: computed(() => mockApiPlans.value),
    currentPlanSlug: computed(() => mockCurrentPlanSlug.value),
    fetchPlans: vi.fn(),
    isTeamPlan: computed(() => mockIsTeamPlan.value),
    subscription: computed(() => mockSubscription.value),
    subscriptionStatus: computed(() => mockSubscriptionStatus.value),
    currentTeamCreditStop: computed(() => mockCurrentTeamCreditStop.value)
  })
}))

vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

vi.mock<unknown>(import('@/composables/billing/useBillingRouting'), () => ({
  useBillingRouting: () => ({
    shouldUseWorkspaceBilling: computed(
      () => mockShouldUseWorkspaceBilling.value
    )
  })
}))

vi.mock<unknown>(
  import('@/platform/workspace/composables/useBillingCapabilities'),
  () => ({
    useBillingCapabilities: () => ({
      canSubscribeSelfServe: computed(() => mockCanManageSubscription.value),
      canReactivate: computed(() => mockRawCanReactivate.value),
      canChangeSeats: computed(
        () => mockCanChangeSeats.value ?? mockCanManageSubscription.value
      ),
      canDowngradeToPersonal: computed(() => mockCanDowngradeToPersonal.value),
      snapshotAuthoritative: computed(() => mockSnapshotAuthoritative.value),
      snapshotResolved: computed(() => mockSnapshotResolved.value),
      capabilityReadFailed: computed(() => mockCapabilityReadFailed.value),
      retryCapabilityRead: mockRetryCapabilityRead
    })
  })
)

const mockBuildSupportUrl = vi.hoisted(() =>
  vi.fn(() => 'https://support.comfy.test/hc')
)

vi.mock<unknown>(import('@/platform/support/config'), () => ({
  buildSupportUrl: mockBuildSupportUrl
}))

vi.mock<unknown>(import('@/composables/auth/useCurrentUser'), () => ({
  useCurrentUser: () => ({
    userEmail: computed(() => 'alex@comfy.test'),
    resolvedUserInfo: computed(() => ({ id: 'user-123' }))
  })
}))

vi.mock<unknown>(
  import('@/platform/workspace/composables/useWorkspaceUI'),
  () => ({
    useWorkspaceUI: () => ({
      permissions: computed(() => mockPermissions.value)
    })
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderComponent(props: Record<string, unknown> = {}) {
  return render(UnifiedPricingTable, {
    props,
    global: {
      plugins: [i18n],
      components: { Button },
      stubs: {
        SelectButton: { template: '<div />' },
        // Clicking moves the v-model selection to a different stop ($200) so
        // tests can move off the current stop.
        CreditSlider: {
          template:
            '<button data-testid="team-slider" @click="$emit(\'update:modelValue\', 200)" />',
          emits: ['update:modelValue']
        }
      }
    }
  })
}

beforeEach(() => {
  mockApiPlans.value = []
})

describe('UnifiedPricingTable plan CTA labels', () => {
  beforeEach(() => {
    mockCanChangeSeats.value = true
    mockRawCanReactivate.value = true
    mockSnapshotAuthoritative.value = true
    mockSubscription.value = null
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockIsTeamPlan.value = false
    mockCanManageSubscription.value = true
    mockCanDowngradeToPersonal.value = true
    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    mockDistributionTypes.isCloud = true
  })

  it('prompts free-tier users to subscribe, never to "change"', () => {
    mockSubscription.value = { tier: 'FREE', duration: 'ANNUAL' }

    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Subscribe to Standard Yearly' })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Subscribe to Creator Yearly' })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Subscribe to Pro Yearly' })
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Change to/ })).toBeNull()
  })

  it('prompts users with an unresolved tier to subscribe', () => {
    mockSubscription.value = { tier: null, duration: 'ANNUAL' }

    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Subscribe to Standard Yearly' })
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Change to/ })).toBeNull()
  })

  it('offers a plan change to users already on a paid plan', () => {
    mockSubscription.value = { tier: 'STANDARD', duration: 'ANNUAL' }

    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Change to Creator Yearly' })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Change to Pro Yearly' })
    ).toBeTruthy()
  })

  it('offers a fresh subscribe on the plan an ended subscription used to hold', async () => {
    const user = userEvent.setup()
    // An ended subscription still reports its tier and plan slug.
    mockSubscription.value = {
      tier: 'CREATOR',
      duration: 'ANNUAL',
      isCancelled: false
    }
    mockSubscriptionStatus.value = 'ended'

    const { emitted } = renderComponent()

    expect(screen.queryByRole('button', { name: 'Current Plan' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Change to/ })).toBeNull()

    const cta = screen.getByRole('button', {
      name: 'Subscribe to Creator Yearly'
    })
    expect(cta).toBeEnabled()
    await user.click(cta)
    const [payload] = emitted().subscribe[0] as [
      { tierKey: string; billingCycle: string }
    ]
    expect(payload).toMatchObject({
      tierKey: 'creator',
      billingCycle: 'yearly'
    })
    expect(emitted().resubscribe).toBeFalsy()
  })

  it('keeps personal tier cards actionable for the original owner of a team plan', () => {
    mockSubscription.value = { tier: 'TEAM', duration: 'ANNUAL' }
    mockCurrentTeamCreditStop.value = {
      id: 'team_700',
      credits_monthly: 147_700,
      stop_usd: 700
    }
    mockIsTeamPlan.value = true

    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Change to Standard Yearly' })
    ).toBeEnabled()
  })

  it('normalizes a promoted owner on a team plan away from personal plans', () => {
    mockSubscription.value = { tier: 'TEAM', duration: 'ANNUAL' }
    mockCurrentTeamCreditStop.value = {
      id: 'team_700',
      credits_monthly: 147_700,
      stop_usd: 700
    }
    mockIsTeamPlan.value = true
    mockCanDowngradeToPersonal.value = false

    renderComponent({ initialPlanMode: 'personal' })

    expect(
      screen.queryByRole('button', { name: 'Change to Standard Yearly' })
    ).toBeNull()
    expect(screen.getByRole('button', { name: 'Current plan' })).toBeDisabled()
  })
})

describe('UnifiedPricingTable team plan CTA', () => {
  const TEAM_STOP = {
    id: 'team_2500',
    credits_monthly: 527_500,
    stop_usd: 2_500
  }

  beforeEach(() => {
    mockCanChangeSeats.value = true
    mockRawCanReactivate.value = true
    mockSnapshotAuthoritative.value = true
    mockSubscription.value = null
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockIsTeamPlan.value = false
    mockCanManageSubscription.value = true
    mockCanDowngradeToPersonal.value = true
    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    mockDistributionTypes.isCloud = true
  })

  it('disables the CTA while sitting on the active current plan', () => {
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: false
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP

    renderComponent({ initialPlanMode: 'team' })

    const cta = screen.getByRole('button', { name: 'Current plan' })
    expect(cta).toBeDisabled()
  })

  it('lets an active sub change to a different stop', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: false
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    await user.click(screen.getByTestId('team-slider'))

    const cta = screen.getByRole('button', { name: 'Change plan' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    const [teamPayload] = emitted().subscribeTeam[0] as [{ isChange: boolean }]
    expect(teamPayload).toMatchObject({ isChange: true })
  })

  it('lets an active sub change billing cycle at the current stop', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'MONTHLY',
      isCancelled: false
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    // The subscription is monthly; the default view is yearly, so the same stop
    // on the other cycle is a change, not the current plan.
    const cta = screen.getByRole('button', { name: 'Change plan' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    const [teamPayload] = emitted().subscribeTeam[0] as [{ isChange: boolean }]
    expect(teamPayload).toMatchObject({ isChange: true })
    expect(emitted().resubscribe).toBeFalsy()
  })

  it('re-subscribes (not change) for a cancelled team subscription', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: true
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    const cta = screen.getByRole('button', { name: 'Resubscribe' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    expect(emitted().resubscribe).toBeTruthy()
  })

  it('disables Resubscribe when the server permits no lifecycle write', () => {
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: true
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP
    mockCanManageSubscription.value = false
    mockCanChangeSeats.value = false
    mockRawCanReactivate.value = false
    mockCanDowngradeToPersonal.value = false

    renderComponent({ initialPlanMode: 'team' })

    expect(screen.getByRole('button', { name: 'Resubscribe' })).toBeDisabled()
  })

  it('lets a cancelled sub change to a different stop (not re-subscribe)', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: true
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    await user.click(screen.getByTestId('team-slider'))

    const cta = screen.getByRole('button', { name: 'Change plan' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    expect(emitted().subscribeTeam).toBeTruthy()
    expect(emitted().resubscribe).toBeFalsy()
  })

  it('prompts a fresh subscribe for an ended team subscription', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: false
    }
    mockSubscriptionStatus.value = 'ended'
    mockCurrentTeamCreditStop.value = TEAM_STOP

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    const cta = screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    const [teamPayload] = emitted().subscribeTeam[0] as [{ isChange: boolean }]
    expect(teamPayload).toMatchObject({ isChange: false })
    expect(emitted().resubscribe).toBeFalsy()
  })

  it('prompts a fresh subscribe when on no team plan', () => {
    renderComponent({ initialPlanMode: 'team' })

    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    ).toBeTruthy()
  })
})

// Server billing capabilities only resolve on Cloud, so Local/Desktop keeps
// authorizing from the client-side workspace permissions.
describe('UnifiedPricingTable outside Cloud', () => {
  const TEAM_STOP = {
    id: 'team_2500',
    credits_monthly: 527_500,
    stop_usd: 2_500
  }

  beforeEach(() => {
    mockCanChangeSeats.value = true
    mockRawCanReactivate.value = true
    mockSnapshotAuthoritative.value = true
    mockSubscription.value = null
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockIsTeamPlan.value = false
    mockCanManageSubscription.value = false
    mockCanDowngradeToPersonal.value = false
    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    mockDistributionTypes.isCloud = false
  })

  it('keeps the personal subscribe CTA usable', async () => {
    const user = userEvent.setup()

    const { emitted } = renderComponent()

    const cta = screen.getByRole('button', {
      name: 'Subscribe to Standard Yearly'
    })
    expect(cta).toBeEnabled()
    await user.click(cta)
    expect(emitted().subscribe).toBeTruthy()
  })

  it('keeps the personal change-plan CTA usable', async () => {
    const user = userEvent.setup()
    mockSubscription.value = { tier: 'STANDARD', duration: 'ANNUAL' }

    const { emitted } = renderComponent()

    const cta = screen.getByRole('button', { name: 'Change to Creator Yearly' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    expect(emitted().subscribe).toBeTruthy()
  })

  it('keeps the personal reactivate CTA usable', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'CREATOR',
      duration: 'ANNUAL',
      isCancelled: true
    }

    const { emitted } = renderComponent()

    const cta = screen.getByRole('button', {
      name: 'Resubscribe to Creator Yearly'
    })
    expect(cta).toBeEnabled()
    await user.click(cta)
    expect(emitted().resubscribe).toBeTruthy()
  })

  it('keeps team-to-personal selection available to the original owner', () => {
    mockSubscription.value = { tier: 'TEAM', duration: 'ANNUAL' }
    mockCurrentTeamCreditStop.value = TEAM_STOP
    mockIsTeamPlan.value = true

    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Change to Standard Yearly' })
    ).toBeEnabled()
  })

  it('keeps the team subscribe CTA usable', async () => {
    const user = userEvent.setup()

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    const cta = screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    expect(emitted().subscribeTeam).toBeTruthy()
  })

  it('keeps the team change-plan CTA usable', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: false
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    await user.click(screen.getByTestId('team-slider'))

    const cta = screen.getByRole('button', { name: 'Change plan' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    expect(emitted().subscribeTeam).toBeTruthy()
  })

  it('keeps the team reactivate CTA usable', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: true
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    const cta = screen.getByRole('button', { name: 'Resubscribe' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    expect(emitted().resubscribe).toBeTruthy()
  })

  it('still blocks the CTAs when the workspace permission is missing', () => {
    mockPermissions.value = {
      canManageSubscription: false,
      canManageSubscriptionLifecycle: false,
      canDowngradeToPersonal: false
    }

    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Subscribe to Standard Yearly' })
    ).toBeDisabled()
  })

  it('normalizes a member without the downgrade permission away from personal plans', () => {
    mockSubscription.value = { tier: 'TEAM', duration: 'ANNUAL' }
    mockCurrentTeamCreditStop.value = TEAM_STOP
    mockIsTeamPlan.value = true
    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: false
    }

    renderComponent({ initialPlanMode: 'personal' })

    expect(
      screen.queryByRole('button', { name: 'Change to Standard Yearly' })
    ).toBeNull()
  })
})

const cycleToggleStub = {
  props: ['options'],
  emits: ['update:modelValue'],
  template: `<div><button
      v-for="option in options"
      :key="option.value"
      :data-testid="'cycle-' + option.value"
      @click="$emit('update:modelValue', option.value)"
    >{{ option.label }}</button></div>`
}

function renderWithCycleToggle(
  props: Partial<ComponentProps<typeof UnifiedPricingTable>> = {}
) {
  return render(UnifiedPricingTable, {
    props,
    global: {
      plugins: [i18n],
      components: { Button },
      stubs: {
        SelectButton: cycleToggleStub,
        CreditSlider: { template: '<div />' }
      }
    }
  })
}

describe('UnifiedPricingTable credit allotment copy', () => {
  beforeEach(() => {
    mockSubscription.value = null
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockIsTeamPlan.value = false
    mockCanManageSubscription.value = true
    mockCanDowngradeToPersonal.value = true
    mockDistributionTypes.isCloud = true
  })

  it('shows the catalog grant in preference to twelve static months', () => {
    mockApiPlans.value = [apiPlan('STANDARD', 'ANNUAL', 60_000)]

    renderComponent()

    expect(screen.getByText('60,000')).toBeTruthy()
    expect(screen.queryByText('50,400')).toBeNull()
    expect(screen.getByText(/~5,429/)).toBeTruthy()
    expect(screen.getByText('88,800')).toBeTruthy()
  })

  it('states the whole-year allotment for personal tiers on the yearly cycle', () => {
    renderWithCycleToggle()

    expect(screen.getAllByText('credits per year')).toHaveLength(3)
    expect(screen.queryAllByText('monthly credits')).toHaveLength(0)
    expect(screen.getByText('50,400')).toBeTruthy()
    expect(screen.getByText('253,200')).toBeTruthy()
    expect(screen.queryByText('4,200')).toBeNull()
    expect(screen.getByText('Generates ~4,560 5s videos*')).toBeTruthy()
  })

  it('states the monthly allotment for personal tiers on the monthly cycle', async () => {
    const user = userEvent.setup()
    renderWithCycleToggle()

    await user.click(screen.getByTestId('cycle-monthly'))
    await nextTick()

    expect(screen.getAllByText('monthly credits')).toHaveLength(3)
    expect(screen.queryAllByText('credits per year')).toHaveLength(0)
    expect(screen.getByText('4,200')).toBeTruthy()
    expect(screen.getByText('21,100')).toBeTruthy()
    expect(screen.getByText('Generates ~380 5s videos*')).toBeTruthy()
  })

  it('scales the team allotment with the billing cycle', async () => {
    const user = userEvent.setup()
    renderWithCycleToggle({ initialPlanMode: 'team' })

    expect(screen.getByText('credits per year')).toBeTruthy()
    expect(screen.getByText('1,772,400')).toBeTruthy()
    expect(screen.getByText('Generates ~160,860 5s videos*')).toBeTruthy()

    await user.click(screen.getByTestId('cycle-monthly'))
    await nextTick()

    expect(screen.getByText('monthly credits')).toBeTruthy()
    expect(screen.getByText('147,700')).toBeTruthy()
    expect(screen.getByText('Generates ~13,405 5s videos*')).toBeTruthy()
  })
})

// INC-128. The server answers per workspace, not per plan card, so the table
// must not decide which capability governs a card: a legacy-rail customer holds
// a paid tier with no local subscription row, which reads as "change" here while
// the server is in fact permitting a subscribe.
describe('UnifiedPricingTable capability gating', () => {
  beforeEach(() => {
    mockCanChangeSeats.value = true
    mockRawCanReactivate.value = true
    mockSnapshotAuthoritative.value = true
    mockSubscription.value = null
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockIsTeamPlan.value = false
    mockCanManageSubscription.value = true
    mockCanDowngradeToPersonal.value = true
    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    mockDistributionTypes.isCloud = true
  })

  it('keeps a paid plan actionable when only change-seats is withheld', async () => {
    const user = userEvent.setup()
    mockSubscription.value = { tier: 'PRO', duration: 'ANNUAL' }
    mockCanChangeSeats.value = false
    mockRawCanReactivate.value = false

    const { emitted } = renderComponent()

    const cta = screen.getByRole('button', { name: 'Change to Creator Yearly' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    expect(emitted().subscribe).toBeTruthy()
  })

  it('keeps the CTA live while the capability snapshot is unresolved', () => {
    mockSubscription.value = { tier: 'FREE', duration: 'ANNUAL' }
    mockSnapshotAuthoritative.value = false
    mockCanManageSubscription.value = false
    mockCanChangeSeats.value = false
    mockRawCanReactivate.value = false

    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Subscribe to Standard Yearly' })
    ).toBeEnabled()
  })

  it('keeps the team CTA live while the capability snapshot is unresolved', () => {
    mockSnapshotAuthoritative.value = false
    mockCanManageSubscription.value = false
    mockCanChangeSeats.value = false
    mockRawCanReactivate.value = false
    mockCanDowngradeToPersonal.value = false

    renderComponent({ initialPlanMode: 'team' })

    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    ).toBeEnabled()
  })

  // can_downgrade_to_personal governs leaving a team plan for a personal one, so
  // it must not stand in for permission to buy the team plan.
  it('does not let the downgrade capability alone enable the team CTA', () => {
    mockCanManageSubscription.value = false
    mockCanChangeSeats.value = false
    mockRawCanReactivate.value = false
    mockCanDowngradeToPersonal.value = true

    renderComponent({ initialPlanMode: 'team' })

    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    ).toBeDisabled()
  })

  it('blocks the CTA when a resolved snapshot permits no lifecycle write', () => {
    mockSubscription.value = { tier: 'FREE', duration: 'ANNUAL' }
    mockCanManageSubscription.value = false
    mockCanChangeSeats.value = false
    mockRawCanReactivate.value = false
    mockCanDowngradeToPersonal.value = false

    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Subscribe to Standard Yearly' })
    ).toBeDisabled()
  })
})

describe('UnifiedPricingTable plan-scope availability', () => {
  beforeEach(() => {
    mockCanChangeSeats.value = true
    mockRawCanReactivate.value = true
    mockSnapshotAuthoritative.value = true
    mockSubscription.value = { tier: 'TEAM', duration: 'ANNUAL' }
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = {
      id: 'team_700',
      credits_monthly: 147_700,
      stop_usd: 700
    }
    mockIsTeamPlan.value = true
    mockCanManageSubscription.value = true
    mockCanDowngradeToPersonal.value = true
    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    mockDistributionTypes.isCloud = true
  })

  it('keeps personal plans reachable on a team plan while the snapshot is unresolved', () => {
    mockSnapshotAuthoritative.value = false
    mockCanDowngradeToPersonal.value = false
    mockCanManageSubscription.value = false
    mockCanChangeSeats.value = false
    mockRawCanReactivate.value = false

    renderComponent({ initialPlanMode: 'personal' })

    expect(
      screen.getByRole('button', { name: 'Change to Standard Yearly' })
    ).toBeEnabled()
  })

  it('keeps personal cards actionable when only the downgrade is permitted', () => {
    mockCanManageSubscription.value = false
    mockCanChangeSeats.value = false
    mockRawCanReactivate.value = false

    renderComponent({ initialPlanMode: 'personal' })

    expect(
      screen.getByRole('button', { name: 'Change to Standard Yearly' })
    ).toBeEnabled()
  })

  it('withholds personal plans when a resolved snapshot denies the downgrade', () => {
    mockCanDowngradeToPersonal.value = false

    renderComponent({ initialPlanMode: 'personal' })

    expect(
      screen.queryByRole('button', { name: 'Change to Standard Yearly' })
    ).toBeNull()
  })
})

describe('UnifiedPricingTable footer notice pill', () => {
  const SETTLING_TEXT =
    'Finishing up your last payment attempt \u2014 you can try again in a moment.'
  const UNREADABLE_TEXT = "We couldn't check your billing status."
  const DENIED_TEXT =
    "A subscription change is already in progress \u2014 you'll be able to subscribe again shortly."

  beforeEach(() => {
    mockRawCanReactivate.value = true
    mockSubscription.value = null
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockIsTeamPlan.value = false
    mockCanManageSubscription.value = true
    mockCanDowngradeToPersonal.value = true
    mockCapabilityReadFailed.value = false
    mockShouldUseWorkspaceBilling.value = true
    mockSnapshotResolved.value = true
    mockCanChangeSeats.value = null
    mockRetryCapabilityRead.mockClear()
    mockBuildSupportUrl.mockClear()
    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    mockDistributionTypes.isCloud = true
  })

  it('carries the settling notice in the footer slot, as a status region', () => {
    renderComponent({ isPaymentSettling: true })

    const pill = screen.getByRole('status')
    expect(pill.textContent).toContain(SETTLING_TEXT)
    expect(pill.textContent).toContain('Contact support')
    expect(screen.queryByText(/Based on this template/)).toBeNull()
  })

  it('keeps the subtitle row rendering the normal personal header', () => {
    renderComponent({ isPaymentSettling: true })

    expect(
      screen.getByText(/Personal plans are for individual use only/)
    ).toBeTruthy()
  })

  it('keeps the team subtitle up too while the notice is showing', () => {
    renderComponent({ isPaymentSettling: true, initialPlanMode: 'team' })

    expect(screen.getByRole('status').textContent).toContain(SETTLING_TEXT)
    expect(screen.getByText(/For teams wanting to collaborate/)).toBeTruthy()
  })

  it('keeps the plan CTAs enabled \u2014 the retry is the probe', async () => {
    const user = userEvent.setup()
    mockSubscription.value = { tier: 'FREE', duration: 'ANNUAL' }

    const { emitted } = renderComponent({ isPaymentSettling: true })

    const cta = screen.getByRole('button', {
      name: 'Subscribe to Creator Yearly'
    })
    expect(cta).toBeEnabled()
    await user.click(cta)
    expect(emitted().subscribe).toBeTruthy()
  })

  it('shows the fine-print blurb while nothing is blocked', () => {
    renderComponent()

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(/Based on this template/)).toBeTruthy()
    expect(
      screen.queryByText(new RegExp(SETTLING_TEXT.slice(0, 20)))
    ).toBeNull()
  })

  it('shows the unreadable-snapshot notice when the capability read failed', () => {
    mockCapabilityReadFailed.value = true
    mockSnapshotResolved.value = false

    renderComponent()

    const pill = screen.getByRole('status')
    expect(pill.textContent).toContain(UNREADABLE_TEXT)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Contact support' })).toBeTruthy()
  })

  it('shows the change-in-progress notice when subscribing is denied', () => {
    // A resolved snapshot that denies every lifecycle write: under the union
    // gating (#16967) any single permitted write keeps the CTAs live, and the
    // pill only renders once they are all disabled.
    mockCanManageSubscription.value = false
    mockRawCanReactivate.value = false
    mockCanDowngradeToPersonal.value = false

    renderComponent()

    expect(screen.getByRole('status').textContent).toContain(DENIED_TEXT)
  })

  it('ranks an unreadable snapshot above a denied capability above settling', async () => {
    // A failed read leaves no resolved snapshot, and every capability reads
    // false — the composable cannot produce readFailed alongside a resolved
    // snapshot, so the stages below walk through reachable states only.
    mockCapabilityReadFailed.value = true
    mockSnapshotResolved.value = false
    mockCanManageSubscription.value = false
    mockRawCanReactivate.value = false
    mockCanDowngradeToPersonal.value = false

    renderComponent({ isPaymentSettling: true })

    expect(screen.getByRole('status').textContent).toContain(UNREADABLE_TEXT)
    expect(screen.queryByText(new RegExp(DENIED_TEXT.slice(0, 20)))).toBeNull()

    // The read recovers into a snapshot that resolves subscribing to false.
    mockCapabilityReadFailed.value = false
    mockSnapshotResolved.value = true
    await nextTick()
    expect(screen.getByRole('status').textContent).toContain(DENIED_TEXT)

    mockCanManageSubscription.value = true
    await nextTick()
    expect(screen.getByRole('status').textContent).toContain(SETTLING_TEXT)
  })

  it('never shows the change-in-progress pill on the legacy billing rail', () => {
    // legacy_stripe has no capability projection row: the server resolves
    // every capability false permanently, so the change-in-progress copy
    // would promise 20k paying customers a change that never completes. They
    // keep the pre-pill rendering (disabled CTAs, fine-print blurb).
    mockShouldUseWorkspaceBilling.value = false
    mockCanManageSubscription.value = false
    mockRawCanReactivate.value = false
    mockCanDowngradeToPersonal.value = false

    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Subscribe to Standard Yearly' })
    ).toBeDisabled()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(/Based on this template/)).toBeTruthy()
  })

  it('keeps the fine print when the read is denied outright (401/403)', () => {
    // A denial is authoritative but resolves no capability values, so every
    // capability reads false without a resolved snapshot behind it. The
    // change-in-progress pill would be a fabricated explanation here.
    mockSnapshotResolved.value = false
    mockCanManageSubscription.value = false

    renderComponent()

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(/Based on this template/)).toBeTruthy()
  })

  it('suppresses the denied pill while a change CTA is still enabled', () => {
    // can_subscribe_self_serve false with can_change_seats true: the pill
    // saying subscribing is blocked must not sit beside an enabled Change CTA.
    mockSubscription.value = { tier: 'STANDARD', duration: 'ANNUAL' }
    mockCanManageSubscription.value = false
    mockCanChangeSeats.value = true

    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Change to Creator Yearly' })
    ).toBeEnabled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows the denied pill on the team plan only when its CTA is disabled', async () => {
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: false
    }
    mockCurrentTeamCreditStop.value = {
      id: 'team_2500',
      credits_monthly: 527_500,
      stop_usd: 2_500
    }
    mockIsTeamPlan.value = true
    mockCanManageSubscription.value = false
    mockCanChangeSeats.value = true

    renderComponent({ initialPlanMode: 'team' })

    // Sitting on the current stop the CTA is disabled anyway; moving off it
    // enables Change plan, and the pill must yield to it.
    expect(screen.getByRole('status').textContent).toContain(DENIED_TEXT)

    await userEvent.setup().click(screen.getByTestId('team-slider'))

    expect(screen.getByRole('button', { name: 'Change plan' })).toBeEnabled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('retries the capability read immediately from the Try again link', async () => {
    const user = userEvent.setup()
    mockCapabilityReadFailed.value = true

    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(mockRetryCapabilityRead).toHaveBeenCalledOnce()
  })

  it('opens the support destination from the Contact support link', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderComponent({ isPaymentSettling: true })

    await user.click(screen.getByRole('button', { name: 'Contact support' }))

    // Same identifying context as the Comfy.ContactSupport command, so the
    // ticket arrives attached to the account it is about.
    expect(mockBuildSupportUrl).toHaveBeenCalledWith({
      userEmail: 'alex@comfy.test',
      userId: 'user-123'
    })
    expect(open).toHaveBeenCalledWith(
      'https://support.comfy.test/hc',
      '_blank',
      'noopener,noreferrer'
    )
    open.mockRestore()
  })

  it('hands focus to the footer region when the pill clears while focused', async () => {
    const user = userEvent.setup()
    mockCapabilityReadFailed.value = true
    mockSnapshotResolved.value = false

    renderComponent()

    const tryAgain = screen.getByRole('button', { name: 'Try again' })
    await user.click(tryAgain)
    expect(tryAgain).toHaveFocus()

    // The retry succeeds: the failed state clears and the pill unmounts while
    // it still holds keyboard focus.
    mockCapabilityReadFailed.value = false
    mockSnapshotResolved.value = true
    await nextTick()
    await nextTick()

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByTestId('pricing-table-footer')).toHaveFocus()
  })

  it('never shows the capability notices outside Cloud', () => {
    mockDistributionTypes.isCloud = false
    mockCapabilityReadFailed.value = true
    mockCanManageSubscription.value = false

    renderComponent()

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(/Based on this template/)).toBeTruthy()
  })
})

describe('UnifiedPricingTable scheduled plan change', () => {
  beforeEach(() => {
    mockRawCanReactivate.value = true
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockIsTeamPlan.value = false
    mockCanManageSubscription.value = true
    mockCanDowngradeToPersonal.value = true
    mockCapabilityReadFailed.value = false
    mockShouldUseWorkspaceBilling.value = true
    mockSnapshotResolved.value = true
    mockCanChangeSeats.value = null
    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    mockDistributionTypes.isCloud = true
    mockApiPlans.value = [
      apiPlan('STANDARD', 'MONTHLY', 42_000),
      apiPlan('CREATOR', 'MONTHLY', 74_000)
    ]
    mockSubscription.value = {
      tier: 'CREATOR',
      duration: 'MONTHLY',
      scheduledChange: {
        plan_slug: 'standard-monthly',
        effective_at: '2026-08-03T00:00:00Z'
      }
    }
  })

  it('carries the scheduled-change notice in the footer slot, link-less', () => {
    renderComponent()

    const pill = screen.getByRole('status')
    expect(pill.textContent).toContain('Your plan changes to Standard on')
    expect(pill.textContent).toContain('2026')
    expect(within(pill).queryByRole('button')).toBeNull()
    expect(screen.queryByText(/Based on this template/)).toBeNull()
  })

  it('labels the destination card Scheduled for the change date', () => {
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Scheduled for Aug 3, 2026' })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Change to Creator Yearly' })
    ).toBeTruthy()
  })

  it('yields the footer slot to the settling notice', () => {
    renderComponent({ isPaymentSettling: true })

    expect(screen.getByRole('status').textContent).toContain(
      'Finishing up your last payment attempt'
    )
  })

  it('renders the normal fine print without a scheduled change', () => {
    mockSubscription.value = { tier: 'CREATOR', duration: 'MONTHLY' }

    renderComponent()

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(/Based on this template/)).toBeTruthy()
  })
})
