import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type {
  PreviewSubscribeResponse,
  SubscriptionDuration,
  SubscriptionTier
} from '@/platform/workspace/api/workspaceApi'

import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    n: (value: number) => value.toLocaleString('en-US')
  })
}))

const globalOptions = {
  mocks: { $t: (key: string) => key },
  stubs: {
    SubscriptionTermsNote: { template: '<div />' },
    Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' }
  }
}

function plan(
  tier: SubscriptionTier,
  duration: SubscriptionDuration,
  priceCents: number
) {
  return {
    slug: `${tier.toLowerCase()}-${duration.toLowerCase()}`,
    tier,
    duration,
    price_cents: priceCents,
    credits_cents: 0,
    seat_summary: {
      seat_count: 1,
      total_cost_cents: priceCents,
      total_credits_cents: 0
    },
    period_end: '2027-06-28T00:00:00Z'
  }
}

function preview(
  overrides: Partial<PreviewSubscribeResponse>
): PreviewSubscribeResponse {
  return {
    allowed: true,
    transition_type: 'upgrade',
    effective_at: '2026-06-19T00:00:00Z',
    is_immediate: true,
    cost_today_cents: 0,
    cost_next_period_cents: 0,
    credits_today_cents: 0,
    credits_next_period_cents: 0,
    new_plan: plan('CREATOR', 'MONTHLY', 3500),
    ...overrides
  }
}

describe('SubscriptionTransitionPreviewWorkspace', () => {
  it('renders an immediate yearly upgrade with proration and upfront credits', () => {
    render(SubscriptionTransitionPreviewWorkspace, {
      props: {
        previewData: preview({
          transition_type: 'duration_change',
          is_immediate: true,
          cost_today_cents: 31_850,
          current_plan: plan('CREATOR', 'MONTHLY', 3500),
          new_plan: plan('CREATOR', 'ANNUAL', 33_600)
        })
      },
      global: globalOptions
    })
    expect(
      screen.getByText('subscription.preview.confirmUpgradeTitle')
    ).toBeTruthy()
    expect(screen.getByText('$28')).toBeTruthy()
    expect(screen.getByText('subscription.billedYearly')).toBeTruthy()
    expect(screen.getByText('subscription.preview.switchesToday')).toBeTruthy()
    expect(
      screen.getByText('subscription.preview.yearlySubscription')
    ).toBeTruthy()
    expect(screen.getByText('$336.00')).toBeTruthy()
    expect(screen.getByText('− $17.50')).toBeTruthy()
    expect(
      screen.getByText('subscription.preview.creditsYoullGetToday')
    ).toBeTruthy()
    expect(screen.getByText('88,800')).toBeTruthy()
    expect(screen.getByText('$318.50')).toBeTruthy()
    expect(
      screen.getByText('subscription.preview.confirmUpgradeCta')
    ).toBeTruthy()
    expect(screen.queryByText('subscription.preview.startsOn')).toBeNull()
  })

  it('renders an immediate monthly tier upgrade with monthly refill', () => {
    render(SubscriptionTransitionPreviewWorkspace, {
      props: {
        previewData: preview({
          transition_type: 'upgrade',
          is_immediate: true,
          cost_today_cents: 8250,
          current_plan: plan('CREATOR', 'MONTHLY', 3500),
          new_plan: plan('PRO', 'MONTHLY', 10_000)
        })
      },
      global: globalOptions
    })
    expect(screen.getByText('$100')).toBeTruthy()
    expect(screen.getByText('subscription.billedMonthly')).toBeTruthy()
    expect(
      screen.getByText('subscription.preview.newMonthlySubscription')
    ).toBeTruthy()
    expect(
      screen.getByText('subscription.preview.eachMonthCreditsRefill')
    ).toBeTruthy()
    expect(screen.getByText('21,100')).toBeTruthy()
    expect(screen.getByText('$82.50')).toBeTruthy()
  })

  it('renders a scheduled downgrade with the after-that block and no charge', () => {
    render(SubscriptionTransitionPreviewWorkspace, {
      props: {
        previewData: preview({
          transition_type: 'downgrade',
          is_immediate: false,
          cost_today_cents: 0,
          effective_at: '2027-06-28T00:00:00Z',
          current_plan: plan('PRO', 'MONTHLY', 10_000),
          new_plan: plan('CREATOR', 'MONTHLY', 3500)
        })
      },
      global: globalOptions
    })
    expect(
      screen.getAllByText('subscription.preview.confirmChange').length
    ).toBeGreaterThan(0)
    expect(screen.getByText('$35')).toBeTruthy()
    expect(screen.getByText('subscription.preview.startsOn')).toBeTruthy()
    expect(screen.getByText('$0.00')).toBeTruthy()
    expect(screen.getByText('subscription.preview.afterThat')).toBeTruthy()
    expect(
      screen.getByText('subscription.preview.creditsRefillMonthlyTo')
    ).toBeTruthy()
    expect(screen.getByText('7,400')).toBeTruthy()
    expect(screen.getByText('subscription.preview.stayOnUntil')).toBeTruthy()
    expect(screen.queryByText('subscription.preview.switchesToday')).toBeNull()
    expect(
      screen.queryByText('subscription.preview.yearlySubscription')
    ).toBeNull()
  })

  it('renders a team credit-commit change using the slider stop for name and credits', () => {
    render(SubscriptionTransitionPreviewWorkspace, {
      props: {
        previewData: preview({
          transition_type: 'upgrade',
          is_immediate: true,
          cost_today_cents: 105_000,
          current_plan: plan('PRO', 'MONTHLY', 70_000),
          new_plan: plan('PRO', 'MONTHLY', 140_000)
        }),
        teamPlan: {
          id: 'team_1400',
          usd: 1400,
          credits: 295_400,
          discountedUsd: 1295
        }
      },
      global: globalOptions
    })
    // Plan name and refill credits come from the team stop, not the personal
    // tier table (which would yield 0 credits for a team plan).
    expect(screen.getByText('subscription.teamPlan.name')).toBeTruthy()
    expect(screen.getByText('295,400')).toBeTruthy()
    // Proration money stays driven by previewData.
    expect(
      screen.getByText('subscription.preview.newMonthlySubscription')
    ).toBeTruthy()
    expect(screen.getByText('$1,400.00')).toBeTruthy()
    expect(screen.getByText('− $350.00')).toBeTruthy()
    expect(screen.getByText('$1,050.00')).toBeTruthy()
    expect(
      screen.getByText('subscription.preview.confirmUpgradeCta')
    ).toBeTruthy()
  })

  it('renders a yearly team credit-commit change with annual refill and yearly labels', () => {
    render(SubscriptionTransitionPreviewWorkspace, {
      props: {
        previewData: preview({
          transition_type: 'upgrade',
          is_immediate: true,
          cost_today_cents: 1_260_000,
          current_plan: plan('PRO', 'MONTHLY', 70_000),
          new_plan: plan('PRO', 'ANNUAL', 1_680_000)
        }),
        teamPlan: {
          id: 'team_1400',
          usd: 1400,
          credits: 295_400,
          discountedUsd: 1295
        }
      },
      global: globalOptions
    })
    // Yearly grants 12 months of the stop's monthly credits up front.
    expect(screen.getByText('subscription.teamPlan.name')).toBeTruthy()
    expect(screen.getByText('3,544,800')).toBeTruthy()
    expect(
      screen.getByText('subscription.preview.creditsYoullGetToday')
    ).toBeTruthy()
    expect(
      screen.getByText('subscription.preview.refillReplacesNote')
    ).toBeTruthy()
    // Yearly line label; proration money stays driven by previewData.
    expect(
      screen.getByText('subscription.preview.yearlySubscription')
    ).toBeTruthy()
    expect(screen.getByText('$16,800.00')).toBeTruthy()
    expect(screen.getByText('− $4,200.00')).toBeTruthy()
    expect(screen.getByText('$12,600.00')).toBeTruthy()
  })
})
