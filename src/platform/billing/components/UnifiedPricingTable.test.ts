import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import type { SubscriptionInfo } from '@/platform/billing/composables/types'
import enMessages from '@/locales/en/main.json'
import type {
  BillingSubscriptionStatus,
  Plan
} from '@/platform/workspace/api/workspaceApi'
import UnifiedPricingTable from '@/platform/billing/components/UnifiedPricingTable.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

type PlanDecision = Pick<
  Plan,
  'action' | 'denied_reason' | 'denied_reason_params'
>

function apiPlan(
  tier: Plan['tier'],
  duration: Plan['duration'],
  creditsCents: number,
  priceCents = 2000,
  decision: PlanDecision = { action: 'subscribe' }
): Plan {
  return {
    ...decision,
    availability: { available: true },
    credits_cents: creditsCents,
    duration,
    max_seats: 5,
    price_cents: priceCents,
    seat_summary: {
      seat_count: 1,
      total_cost_cents: priceCents,
      total_credits_cents: creditsCents
    },
    slug: `${tier.toLowerCase()}-${duration.toLowerCase()}`,
    tier
  }
}

interface MockSubscription
  extends
    Pick<SubscriptionInfo, 'tier'>,
    Partial<
      Pick<SubscriptionInfo, 'isCancelled' | 'duration' | 'scheduledChange'>
    > {}

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

const mockPermissions = ref({
  canManageSubscription: true,
  canManageSubscriptionLifecycle: true,
  canDowngradeToPersonal: true
})
const mockDistributionTypes = vi.hoisted(() => ({ isCloud: true }))
const mockApiPlans = vi.hoisted(() => ({ value: [] as Plan[] }))

vi.mock(import('@/platform/billing/composables/useBillingContext'))

vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

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
  const billingContext = useBillingContext()
  billingContext.plans = computed(() => mockApiPlans.value)
  billingContext.currentPlanSlug = computed(() => mockCurrentPlanSlug.value)
  billingContext.isTeamPlan = computed(() => mockIsTeamPlan.value)
  billingContext.subscription = computed(() =>
    mockSubscription.value
      ? {
          isActive: true,
          duration: null,
          planSlug: null,
          scheduledChange: null,
          renewalDate: null,
          endDate: null,
          isCancelled: false,
          hasFunds: true,
          agentHasFunds: true,
          ...mockSubscription.value
        }
      : null
  )
  billingContext.subscriptionStatus = computed(
    () => mockSubscriptionStatus.value
  )
  billingContext.currentTeamCreditStop = computed(
    () => mockCurrentTeamCreditStop.value
  )
  vi.mocked(useBillingContext).mockReturnValue(billingContext)
  const workspaceUI = vi.mocked(useWorkspaceUI())
  const defaultPermissions = workspaceUI.permissions.value
  workspaceUI.permissions = computed(() => ({
    ...defaultPermissions,
    ...mockPermissions.value
  }))
})

function standardYearlyCatalog(decision: PlanDecision): Plan[] {
  return [
    apiPlan('STANDARD', 'ANNUAL', 504_000, 19_200, decision),
    apiPlan('CREATOR', 'ANNUAL', 888_000, 33_600, { action: 'subscribe' }),
    apiPlan('PRO', 'ANNUAL', 2_400_000, 96_000, { action: 'subscribe' })
  ]
}

const PLAN_UNAVAILABLE_COPY = Object.values(
  enMessages.subscription.planUnavailable
)

function queryPlanUnavailableCopy(): HTMLElement[] {
  return PLAN_UNAVAILABLE_COPY.flatMap((copy) => screen.queryAllByText(copy))
}

describe('UnifiedPricingTable personal plan action', () => {
  beforeEach(() => {
    useBillingCapabilities().canChangeSeats = computed(() => true)
    useBillingCapabilities().canReactivate = computed(() => true)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)
    useBillingCapabilities().canDowngradeToPersonal = computed(() => true)

    mockSubscription.value = null
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockIsTeamPlan.value = false

    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    mockDistributionTypes.isCloud = true
  })

  it.for([
    {
      action: 'subscribe',
      label: 'Subscribe to Standard Yearly',
      event: 'subscribe'
    },
    {
      action: 'change',
      label: 'Change to Standard Yearly',
      event: 'subscribe'
    },
    {
      action: 'downgrade',
      label: 'Change to Standard Yearly',
      event: 'subscribe'
    },
    {
      action: 'reactivate',
      label: 'Resume Standard Yearly',
      event: 'resubscribe'
    }
  ] as const)(
    'renders $action as received and emits $event',
    async ({ action, label, event }) => {
      const user = userEvent.setup()
      mockApiPlans.value = standardYearlyCatalog({ action })

      const { emitted } = renderComponent()

      const cta = screen.getByRole('button', { name: label })
      expect(cta).toBeEnabled()
      await user.click(cta)
      expect(Object.keys(emitted())).toContain(event)
      expect(queryPlanUnavailableCopy()).toEqual([])
    }
  )

  it('emits the selected tier and cycle for a subscribe action', async () => {
    const user = userEvent.setup()
    mockApiPlans.value = standardYearlyCatalog({ action: 'subscribe' })

    const { emitted } = renderComponent()

    await user.click(
      screen.getByRole('button', { name: 'Subscribe to Standard Yearly' })
    )
    expect(emitted().subscribe).toEqual([
      [{ tierKey: 'standard', billingCycle: 'yearly' }]
    ])
    expect(emitted().resubscribe).toBeFalsy()
  })

  it.for([
    {
      denied_reason: 'not_a_member',
      copy: "You're no longer a member of this workspace, so you can't change its plan."
    },
    {
      denied_reason: 'not_workspace_owner',
      copy: 'Only the workspace owner can change the plan.'
    },
    {
      denied_reason: 'not_original_owner',
      copy: 'Only the person who created this workspace can make this plan change.'
    },
    {
      denied_reason: 'sales_managed',
      copy: 'Your plan is managed by our sales team. Contact sales to change it.'
    },
    {
      denied_reason: 'billing_operation_parked',
      copy: 'A recent billing change needs a fix from our team. Contact support to change your plan.'
    },
    {
      denied_reason: 'billing_operation_in_progress',
      copy: 'A billing change is in progress. This plan will be available again shortly.'
    },
    {
      denied_reason: 'subscription_change_in_progress',
      denied_reason_params: { effective_at: '2026-10-01T00:00:00Z' },
      copy: 'Your scheduled plan change takes effect on Oct 1, 2026. You can choose another plan after that.'
    },
    {
      denied_reason: 'subscription_change_in_progress',
      copy: 'You already have a plan change scheduled. You can choose another plan after it takes effect.'
    },
    {
      denied_reason: 'annual_to_monthly_unsupported',
      copy: "You can't move to a higher monthly plan until your annual plan ends."
    },
    {
      denied_reason: 'incompatible_transition',
      copy: "This plan can't be selected from your current plan."
    },
    {
      denied_reason: 'exceeds_max_seats',
      copy: 'Your workspace has more members than this plan allows.'
    },
    {
      denied_reason: 'billing_state_unknown',
      copy: "We couldn't confirm your billing details. Try again in a moment."
    },
    {
      denied_reason: undefined,
      copy: "This plan isn't available for your workspace."
    }
  ] as const)(
    'disables the CTA and explains none for $denied_reason',
    async ({ copy, ...decision }) => {
      const user = userEvent.setup()
      mockApiPlans.value = standardYearlyCatalog({
        action: 'none',
        ...decision
      })

      const { emitted } = renderComponent()

      const cta = screen.getByRole('button', { name: 'Standard Yearly' })
      expect(cta).toBeDisabled()
      await user.click(cta)
      expect(emitted().subscribe).toBeFalsy()
      expect(emitted().resubscribe).toBeFalsy()
      expect(screen.getByText(copy)).toBeVisible()
    }
  )

  it('reads same_plan as the current plan without an unavailable line', () => {
    mockApiPlans.value = standardYearlyCatalog({
      action: 'none',
      denied_reason: 'same_plan'
    })

    renderComponent()

    expect(screen.getByRole('button', { name: 'Current Plan' })).toBeDisabled()
    expect(queryPlanUnavailableCopy()).toEqual([])
  })

  it('lets a cancelled current plan resubscribe when the server says reactivate', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'STANDARD',
      duration: 'ANNUAL',
      isCancelled: true
    }
    mockCurrentPlanSlug.value = 'standard-annual'
    mockApiPlans.value = standardYearlyCatalog({ action: 'reactivate' })

    const { emitted } = renderComponent()

    const cta = screen.getByRole('button', { name: 'Resume Standard Yearly' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    expect(emitted().resubscribe).toHaveLength(1)
    expect(emitted().subscribe).toBeFalsy()
  })

  it('fails closed without explanation when the catalog has no matching plan', async () => {
    const user = userEvent.setup()
    mockApiPlans.value = []

    const { emitted } = renderComponent()

    for (const name of ['Standard Yearly', 'Creator Yearly', 'Pro Yearly']) {
      const cta = screen.getByRole('button', { name })
      expect(cta).toBeDisabled()
      await user.click(cta)
    }
    expect(emitted().subscribe).toBeFalsy()
    expect(queryPlanUnavailableCopy()).toEqual([])
  })

  it('disables an actionable CTA while a checkout is loading', () => {
    mockApiPlans.value = standardYearlyCatalog({ action: 'subscribe' })

    renderComponent({ isLoading: true })

    expect(
      screen.getByRole('button', { name: 'Subscribe to Standard Yearly' })
    ).toBeDisabled()
  })

  it.for([
    {
      capabilities: false,
      action: 'subscribe',
      name: 'Subscribe to Standard Yearly',
      disabled: false
    },
    {
      capabilities: true,
      action: 'none',
      name: 'Standard Yearly',
      disabled: true
    }
  ] as const)(
    'ignores billing capabilities ($capabilities) when the plan action is $action',
    ({ capabilities, action, name, disabled }) => {
      useBillingCapabilities().snapshotAuthoritative = computed(() => true)
      useBillingCapabilities().canSubscribeSelfServe = computed(
        () => capabilities
      )
      useBillingCapabilities().canChangeSeats = computed(() => capabilities)
      useBillingCapabilities().canReactivate = computed(() => capabilities)
      mockPermissions.value = {
        canManageSubscription: capabilities,
        canManageSubscriptionLifecycle: capabilities,
        canDowngradeToPersonal: true
      }
      mockApiPlans.value = standardYearlyCatalog({ action })

      renderComponent()

      expect(screen.getByRole('button', { name })).toHaveProperty(
        'disabled',
        disabled
      )
    }
  )
})

describe('UnifiedPricingTable scheduled plan change', () => {
  beforeEach(() => {
    mockSubscription.value = {
      tier: 'CREATOR',
      duration: 'ANNUAL',
      scheduledChange: {
        plan_slug: 'standard-monthly',
        effective_at: '2026-10-01T00:00:00Z',
        team_credit_stop: null
      }
    }
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockIsTeamPlan.value = false

    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    mockDistributionTypes.isCloud = true
    mockApiPlans.value = [
      apiPlan('STANDARD', 'MONTHLY', 42_000),
      apiPlan('STANDARD', 'ANNUAL', 504_000),
      apiPlan('CREATOR', 'MONTHLY', 74_000),
      apiPlan('CREATOR', 'ANNUAL', 888_000)
    ]
  })

  it('replaces the footnote with a link-less status notice', () => {
    renderComponent()

    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent(
      'Your plan changes to Standard on Oct 1, 2026.'
    )
    expect(within(notice).queryByRole('button')).toBeNull()
    expect(screen.queryByText(/Based on this template/)).toBeNull()
  })

  it('shows the notice and disables the team action on the team tab', () => {
    renderComponent({ initialPlanMode: 'team' })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your plan changes to Standard on Oct 1, 2026.'
    )
    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    ).toBeDisabled()
  })

  it('suppresses an incomplete scheduled change', () => {
    mockApiPlans.value = []

    renderComponent()

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(/Based on this template/)).toBeTruthy()
  })

  it('suppresses a scheduled change on a cancelled subscription', () => {
    mockSubscription.value = {
      tier: 'CREATOR',
      duration: 'ANNUAL',
      scheduledChange: {
        plan_slug: 'standard-monthly',
        effective_at: '2026-10-01T00:00:00Z',
        team_credit_stop: null
      },
      isCancelled: true
    }

    renderComponent()

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(/Based on this template/)).toBeTruthy()
  })
})

describe('UnifiedPricingTable team plan CTA', () => {
  const TEAM_STOP = {
    id: 'team_2500',
    credits_monthly: 527_500,
    stop_usd: 2_500
  }

  beforeEach(() => {
    useBillingCapabilities().canChangeSeats = computed(() => true)
    useBillingCapabilities().canReactivate = computed(() => true)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)
    useBillingCapabilities().canDowngradeToPersonal = computed(() => true)

    mockSubscription.value = null
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockIsTeamPlan.value = false

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
    useBillingCapabilities().canSubscribeSelfServe = computed(() => false)
    useBillingCapabilities().canChangeSeats = computed(() => false)
    useBillingCapabilities().canReactivate = computed(() => false)
    useBillingCapabilities().canDowngradeToPersonal = computed(() => false)

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

  it('uses the billing catalog default team stop for display and checkout', async () => {
    const user = userEvent.setup()
    useBillingContext().teamCreditStops = computed(() => ({
      default_stop_index: 1,
      stops: [
        {
          id: 'stop-320',
          credits: 67_520,
          monthly: {
            action: 'subscribe',
            list_price_cents: 32_000,
            price_cents: 30_400,
            period_charge_cents: 30_400
          },
          yearly: {
            action: 'subscribe',
            list_price_cents: 32_000,
            price_cents: 28_800,
            period_charge_cents: 345_600
          }
        },
        {
          id: 'stop-640',
          credits: 135_040,
          monthly: {
            action: 'subscribe',
            list_price_cents: 64_000,
            price_cents: 60_800,
            period_charge_cents: 60_800
          },
          yearly: {
            action: 'subscribe',
            list_price_cents: 64_000,
            price_cents: 57_600,
            period_charge_cents: 691_200
          }
        }
      ]
    }))

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    expect(screen.getByText('1,620,480')).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    )
    expect(emitted('subscribeTeam')).toEqual([
      [
        {
          stop: {
            id: 'stop-640',
            usd: 640,
            credits: 135_040,
            discountedUsd: 576,
            periodChargeUsd: { monthly: 608, yearly: 6912 }
          },
          billingCycle: 'yearly',
          isChange: false
        }
      ]
    ])
  })
  it('checks out a monthly team stop at its served price', async () => {
    const user = userEvent.setup()
    useBillingContext().teamCreditStops = computed(() => ({
      default_stop_index: 0,
      stops: [
        {
          id: 'team_400',
          credits: 84_400,
          monthly: {
            action: 'subscribe',
            list_price_cents: 40_000,
            price_cents: 39_000,
            period_charge_cents: 39_000
          },
          yearly: {
            action: 'subscribe',
            list_price_cents: 40_000,
            price_cents: 37_800,
            period_charge_cents: 453_600
          }
        }
      ]
    }))

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    await user.click(screen.getByRole('button', { name: 'Monthly' }))
    await user.click(
      screen.getByRole('button', { name: 'Subscribe to Team Monthly' })
    )
    expect(emitted('subscribeTeam')).toEqual([
      [
        {
          stop: {
            id: 'team_400',
            usd: 400,
            credits: 84_400,
            discountedUsd: 390,
            periodChargeUsd: { monthly: 390, yearly: 4536 }
          },
          billingCycle: 'monthly',
          isChange: false
        }
      ]
    ])
  })
})

describe('UnifiedPricingTable outside Cloud', () => {
  const TEAM_STOP = {
    id: 'team_2500',
    credits_monthly: 527_500,
    stop_usd: 2_500
  }

  beforeEach(() => {
    useBillingCapabilities().canChangeSeats = computed(() => true)
    useBillingCapabilities().canReactivate = computed(() => true)

    mockSubscription.value = null
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockIsTeamPlan.value = false

    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    mockDistributionTypes.isCloud = false
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

// GET /api/billing/plans on testcloud, 2026-09-25. credits_cents is the grant in
// USD cents, not a credit count.
const TESTCLOUD_CATALOG: Plan[] = [
  apiPlan('STANDARD', 'MONTHLY', 1_991, 2_000),
  apiPlan('STANDARD', 'ANNUAL', 23_887, 19_200),
  apiPlan('CREATOR', 'MONTHLY', 3_508, 3_500),
  apiPlan('CREATOR', 'ANNUAL', 42_086, 33_600),
  apiPlan('PRO', 'MONTHLY', 10_000, 10_000),
  apiPlan('PRO', 'ANNUAL', 120_000, 96_000)
]

const CATALOG_GRANTS: Record<string, number> = {
  'standard-annual': 60_000,
  'creator-annual': 96_000,
  'pro-annual': 240_000,
  'standard-monthly': 5_000,
  'creator-monthly': 8_000,
  'pro-monthly': 20_000
}

const TESTCLOUD_CATALOG_WITH_GRANTS: Plan[] = TESTCLOUD_CATALOG.map((plan) => ({
  ...plan,
  credits: CATALOG_GRANTS[plan.slug]
}))

const CATALOG_CARDS = [
  {
    source: 'the tier fallback',
    plans: TESTCLOUD_CATALOG,
    cycle: 'yearly',
    credits: ['50,400', '88,800', '253,200'],
    videos: ['4,560', '8,040', '22,980'],
    billed: ['$192 Billed yearly', '$336 Billed yearly', '$960 Billed yearly'],
    neverShown: ['23,887', '42,086', '120,000', '50,402', '88,801']
  },
  {
    source: 'the tier fallback',
    plans: TESTCLOUD_CATALOG,
    cycle: 'monthly',
    credits: ['4,200', '7,400', '21,100'],
    videos: ['380', '670', '1,915'],
    billed: ['Billed monthly', 'Billed monthly', 'Billed monthly'],
    neverShown: ['1,991', '3,508', '10,000', '4,201', '7,402']
  },
  {
    source: 'the catalog grant',
    plans: TESTCLOUD_CATALOG_WITH_GRANTS,
    cycle: 'yearly',
    credits: ['60,000', '96,000', '240,000'],
    videos: ['5,429', '8,692', '21,782'],
    billed: ['$192 Billed yearly', '$336 Billed yearly', '$960 Billed yearly'],
    neverShown: ['50,400', '88,800', '253,200', '23,887', '42,086', '120,000']
  },
  {
    source: 'the catalog grant',
    plans: TESTCLOUD_CATALOG_WITH_GRANTS,
    cycle: 'monthly',
    credits: ['5,000', '8,000', '20,000'],
    videos: ['452', '724', '1,815'],
    billed: ['Billed monthly', 'Billed monthly', 'Billed monthly'],
    neverShown: ['4,200', '7,400', '21,100', '1,991', '3,508', '10,000']
  }
] as const

function renderWithCycleToggle(
  props: Partial<ComponentProps<typeof UnifiedPricingTable>> = {}
) {
  return render(UnifiedPricingTable, {
    props,
    global: {
      plugins: [i18n],
      components: { Button },
      stubs: {
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
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)
    useBillingCapabilities().canDowngradeToPersonal = computed(() => true)
    mockDistributionTypes.isCloud = true
  })

  it.for(CATALOG_CARDS)(
    'shows the $cycle credit grant from $source',
    async ({ plans, cycle, credits, videos, billed, neverShown }) => {
      mockApiPlans.value = plans
      const user = userEvent.setup()
      renderWithCycleToggle()

      if (cycle === 'monthly') {
        await user.click(screen.getByRole('button', { name: 'Monthly' }))
        await nextTick()
      }

      for (const amount of credits)
        expect(screen.getByText(amount)).toBeTruthy()
      for (const count of videos)
        expect(screen.getByText(`Generates ~${count} 5s videos*`)).toBeTruthy()
      expect(
        screen
          .getAllByText(/Billed (yearly|monthly)/)
          .map((el) => el.textContent.trim())
      ).toEqual([...billed])
      for (const amount of neverShown)
        expect(screen.queryByText(amount)).toBeNull()
    }
  )

  it('states the whole-year allotment for personal tiers on the yearly cycle', () => {
    renderWithCycleToggle()

    expect(screen.getAllByText('credits per year')).toHaveLength(3)
    expect(screen.queryAllByText('monthly credits')).toHaveLength(0)
    expect(screen.getByText('50,400')).toBeTruthy()
    expect(screen.getByText('253,200')).toBeTruthy()
    expect(screen.queryByText('4,200')).toBeNull()
    expect(screen.getByText('Generates ~4,560 5s videos*')).toBeTruthy()
  })

  it('keeps the monthly personal-tier allotment when Monthly is selected again', async () => {
    const user = userEvent.setup()
    renderWithCycleToggle()

    const monthly = screen.getByRole('button', { name: 'Monthly' })
    await user.click(monthly)
    await user.click(monthly)
    await nextTick()

    expect(monthly).toHaveAttribute('aria-pressed', 'true')
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

    await user.click(screen.getByRole('button', { name: 'Monthly' }))
    await nextTick()

    expect(screen.getByText('monthly credits')).toBeTruthy()
    expect(screen.getByText('147,700')).toBeTruthy()
    expect(screen.getByText('Generates ~13,405 5s videos*')).toBeTruthy()
  })
})

describe('UnifiedPricingTable capability gating', () => {
  beforeEach(() => {
    useBillingCapabilities().canChangeSeats = computed(() => true)
    useBillingCapabilities().canReactivate = computed(() => true)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)
    useBillingCapabilities().canDowngradeToPersonal = computed(() => true)

    mockSubscription.value = null
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockIsTeamPlan.value = false

    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    mockDistributionTypes.isCloud = true
  })

  it('keeps the team CTA live while the capability snapshot is unresolved', () => {
    useBillingCapabilities().snapshotAuthoritative = computed(() => false)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => false)
    useBillingCapabilities().canChangeSeats = computed(() => false)
    useBillingCapabilities().canReactivate = computed(() => false)
    useBillingCapabilities().canDowngradeToPersonal = computed(() => false)

    renderComponent({ initialPlanMode: 'team' })

    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    ).toBeEnabled()
  })

  it('does not let the downgrade capability alone enable the team CTA', () => {
    useBillingCapabilities().canSubscribeSelfServe = computed(() => false)
    useBillingCapabilities().canChangeSeats = computed(() => false)
    useBillingCapabilities().canReactivate = computed(() => false)
    useBillingCapabilities().canDowngradeToPersonal = computed(() => true)

    renderComponent({ initialPlanMode: 'team' })

    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    ).toBeDisabled()
  })
})

describe('UnifiedPricingTable plan-scope availability', () => {
  beforeEach(() => {
    useBillingCapabilities().canChangeSeats = computed(() => true)
    useBillingCapabilities().canReactivate = computed(() => true)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)
    useBillingCapabilities().canDowngradeToPersonal = computed(() => true)

    mockSubscription.value = { tier: 'TEAM', duration: 'ANNUAL' }
    mockSubscriptionStatus.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = {
      id: 'team_700',
      credits_monthly: 147_700,
      stop_usd: 700
    }
    mockIsTeamPlan.value = true

    mockPermissions.value = {
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }
    mockDistributionTypes.isCloud = true
  })

  it('keeps personal plans reachable on a team plan while the snapshot is unresolved', () => {
    useBillingCapabilities().snapshotAuthoritative = computed(() => false)
    useBillingCapabilities().canDowngradeToPersonal = computed(() => false)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => false)
    useBillingCapabilities().canChangeSeats = computed(() => false)
    useBillingCapabilities().canReactivate = computed(() => false)
    mockApiPlans.value = standardYearlyCatalog({ action: 'downgrade' })

    renderComponent({ initialPlanMode: 'personal' })

    expect(
      screen.getByRole('button', { name: 'Change to Standard Yearly' })
    ).toBeEnabled()
  })

  it('withholds personal plans when a resolved snapshot denies the downgrade', () => {
    useBillingCapabilities().canDowngradeToPersonal = computed(() => false)

    renderComponent({ initialPlanMode: 'personal' })

    expect(
      screen.queryByRole('button', { name: 'Change to Standard Yearly' })
    ).toBeNull()
  })
})
