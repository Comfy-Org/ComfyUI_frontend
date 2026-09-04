import type { SubscriptionTier } from '@comfyorg/ingest-types'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import enMessages from '@/locales/en/main.json'
import type { BillingSubscriptionStatus } from '@/platform/workspace/api/workspaceApi'
import UnifiedPricingTable from '@/platform/workspace/components/UnifiedPricingTable.vue'

interface MockSubscription {
  tier: SubscriptionTier | null
  isCancelled?: boolean
  duration?: string
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
const mockCanReactivatePlan = ref(true)
// the raw server capability, kept separate so a test can prove the component
// follows the derived policy rather than this value
const mockRawCanReactivate = ref(true)
const mockCapabilityReadFailed = ref(false)
const mockIsReady = ref(true)
const mockSnapshotResolved = ref(true)
// null mirrors mockCanManageSubscription, so most tests keep one knob while
// the pill tests can split subscribe from change-seats.
const mockCanChangeSeats = ref<boolean | null>(null)
const mockRetryCapabilityRead = vi.fn()
const mockPermissions = ref({
  canManageSubscription: true,
  canManageSubscriptionLifecycle: true,
  canDowngradeToPersonal: true
})
const mockShouldUseWorkspaceBilling = ref(true)
const mockDistributionTypes = vi.hoisted(() => ({ isCloud: true }))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    plans: ref([]),
    currentPlanSlug: computed(() => mockCurrentPlanSlug.value),
    fetchPlans: vi.fn(),
    isTeamPlan: computed(() => mockIsTeamPlan.value),
    subscription: computed(() => mockSubscription.value),
    subscriptionStatus: computed(() => mockSubscriptionStatus.value),
    currentTeamCreditStop: computed(() => mockCurrentTeamCreditStop.value)
  })
}))

vi.mock('@/platform/distribution/types', () => mockDistributionTypes)

vi.mock('@/composables/billing/useBillingRouting', () => ({
  useBillingRouting: () => ({
    shouldUseWorkspaceBilling: computed(
      () => mockShouldUseWorkspaceBilling.value
    )
  })
}))

vi.mock('@/platform/workspace/composables/useBillingCapabilities', () => ({
  useBillingCapabilities: () => ({
    canSubscribeSelfServe: computed(() => mockCanManageSubscription.value),
    canReactivate: computed(() => mockRawCanReactivate.value),
    canChangeSeats: computed(
      () => mockCanChangeSeats.value ?? mockCanManageSubscription.value
    ),
    canDowngradeToPersonal: computed(() => mockCanDowngradeToPersonal.value),
    snapshotResolved: computed(() => mockSnapshotResolved.value),
    capabilityReadFailed: computed(() => mockCapabilityReadFailed.value),
    isReady: computed(() => mockIsReady.value),
    retryCapabilityRead: mockRetryCapabilityRead
  })
}))

const mockBuildSupportUrl = vi.hoisted(() =>
  vi.fn(() => 'https://support.comfy.test/hc')
)

vi.mock('@/platform/support/config', () => ({
  buildSupportUrl: mockBuildSupportUrl
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    userEmail: computed(() => 'alex@comfy.test'),
    resolvedUserInfo: computed(() => ({ id: 'user-123' }))
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: computed(() => mockPermissions.value),
    canReactivatePlan: computed(() => mockCanReactivatePlan.value)
  })
}))

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

describe('UnifiedPricingTable plan CTA labels', () => {
  beforeEach(() => {
    mockCanReactivatePlan.value = true
    mockRawCanReactivate.value = true
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
    mockCanReactivatePlan.value = true
    mockRawCanReactivate.value = true
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

  it('disables Resubscribe when the workspace may not reactivate', () => {
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: true
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP
    mockCanReactivatePlan.value = false

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
    mockCanReactivatePlan.value = true
    mockRawCanReactivate.value = true
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

describe('UnifiedPricingTable footer notice pill', () => {
  const SETTLING_TEXT =
    'Finishing up your last payment attempt \u2014 you can try again in a moment.'
  const UNREADABLE_TEXT = "We couldn't check your billing status."
  const DENIED_TEXT =
    "A subscription change is already in progress \u2014 you'll be able to subscribe again shortly."

  beforeEach(() => {
    mockCanReactivatePlan.value = true
    mockRawCanReactivate.value = true
    mockSubscription.value = null
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockIsTeamPlan.value = false
    mockCanManageSubscription.value = true
    mockCanDowngradeToPersonal.value = true
    mockCapabilityReadFailed.value = false
    mockIsReady.value = true
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
    mockCanManageSubscription.value = false

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
    // these capabilities false permanently, so the change-in-progress copy
    // would promise 20k paying customers a change that never completes. They
    // keep the pre-pill rendering (disabled CTAs, fine-print blurb).
    mockShouldUseWorkspaceBilling.value = false
    mockCanManageSubscription.value = false

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

  it('keeps personal CTAs enabled with the blurb while the first read is pending', () => {
    // Pending is no answer, not a denial (IR-128): every capability still
    // reads false, but nothing is resolved yet, so the table must not lock.
    mockIsReady.value = false
    mockSnapshotResolved.value = false
    mockCanManageSubscription.value = false
    mockCanDowngradeToPersonal.value = false

    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Subscribe to Standard Yearly' })
    ).toBeEnabled()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(/Based on this template/)).toBeTruthy()
  })

  it('keeps the team CTA enabled while the first read is pending', () => {
    mockIsReady.value = false
    mockSnapshotResolved.value = false
    mockCanManageSubscription.value = false

    renderComponent({ initialPlanMode: 'team' })

    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    ).toBeEnabled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('locks the CTAs once the read settles into failure or resolved denial', async () => {
    // The same session walking pending -> failed -> resolved-false: the CTAs
    // fail open only in the pending window and lock as soon as the read has
    // an answer, with the matching pill each time.
    mockIsReady.value = false
    mockSnapshotResolved.value = false
    mockCanManageSubscription.value = false

    renderComponent()
    const cta = screen.getByRole('button', {
      name: 'Subscribe to Standard Yearly'
    })
    expect(cta).toBeEnabled()

    mockIsReady.value = true
    mockCapabilityReadFailed.value = true
    await nextTick()
    expect(cta).toBeDisabled()
    expect(screen.getByRole('status').textContent).toContain(UNREADABLE_TEXT)

    mockCapabilityReadFailed.value = false
    mockSnapshotResolved.value = true
    await nextTick()
    expect(cta).toBeDisabled()
    expect(screen.getByRole('status').textContent).toContain(DENIED_TEXT)
  })
})
