import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'

import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'

// Real i18n plugin (not the mocked `vue-i18n` module used by the sibling
// SubscriptionTransitionPreviewWorkspace.test.ts) so <i18n-t> resolves and
// renders its named slots for these reactivation-banner assertions.
const { mockSubscription } = vi.hoisted(() => ({
  mockSubscription: {
    value: null as { isCancelled: boolean; endDate: string | null } | null
  }
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscription: computed(() => mockSubscription.value)
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      subscription: {
        usdPerMonth: 'USD / mo',
        billedMonthly: 'Billed monthly',
        billedYearly: '{total} Billed yearly',
        tierNameYearly: '{name} Yearly',
        tiers: {
          standard: { name: 'Standard' },
          creator: { name: 'Creator' }
        },
        preview: {
          switchesToday: 'Switches today',
          startsOn: 'Starts {date}',
          yearlySubscription: 'Yearly subscription',
          newMonthlySubscription: 'New monthly subscription',
          creditFromCurrent: 'Credit from current {plan}',
          currentMonthly: 'monthly plan',
          commitment: 'commitment',
          creditsYoullGetToday: "Credits you'll get today",
          eachMonthCreditsRefill: 'Each month credits refill to',
          refillReplacesNote: 'Replaces your monthly refill.',
          afterThat: 'After that',
          creditsRefillMonthlyTo: 'Credits refill monthly to',
          billedEachMonth: '{amount} billed each month.',
          totalDueToday: 'Total due today',
          nextPaymentDue: 'Next payment due {date}.',
          confirmUpgradeTitle: 'Confirm your upgrade',
          confirmUpgradeCta: 'Confirm upgrade',
          confirmChange: 'Confirm change',
          confirmChangeTitle: 'Review your scheduled change',
          stayOnUntil: "You'll stay on {plan} until {date}.",
          backToAllPlans: 'Back to all plans',
          reactivation: {
            title: 'Reactivating your subscription',
            titleAnnual:
              'Reactivating your subscription — full year billed today',
            upgradeBody:
              "Your {plan} was set to end on {date}. Upgrading now reactivates it — you'll be charged {amount} today, and it will renew automatically on {nextDate} instead of ending.",
            downgradeBody:
              "Your {plan} was set to end on {date}. Switching to {newPlan} reactivates it — you won't be charged today, but it will now renew automatically on {nextDate} at the new price instead of ending.",
            durationChangeBody:
              'Your {plan} was set to end on {date}. Switching to annual billing reactivates it and charges the full year, {amount}, today. It will then renew annually on {nextDate} instead of ending.',
            confirmButton: 'Confirm & reactivate',
            confirmButtonWithCharge: 'Confirm & reactivate — {amount} today',
            checkboxLabel: "I understand I'll be charged {amount} today"
          }
        }
      }
    }
  }
})

function makePreview(
  overrides: Partial<PreviewSubscribeResponse>
): PreviewSubscribeResponse {
  return {
    allowed: true,
    transition_type: 'upgrade',
    effective_at: '2026-08-01T00:00:00Z',
    is_immediate: true,
    cost_today_cents: 1500,
    cost_next_period_cents: 3500,
    credits_today_cents: 0,
    credits_next_period_cents: 0,
    current_plan: {
      slug: 'standard-monthly',
      tier: 'STANDARD',
      duration: 'MONTHLY',
      price_cents: 2000,
      credits_cents: 0,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: 2000,
        total_credits_cents: 0
      }
    },
    new_plan: {
      slug: 'creator-monthly',
      tier: 'CREATOR',
      duration: 'MONTHLY',
      price_cents: 3500,
      credits_cents: 0,
      period_end: '2026-09-15T00:00:00Z',
      seat_summary: {
        seat_count: 1,
        total_cost_cents: 3500,
        total_credits_cents: 0
      }
    },
    ...overrides
  }
}

function renderComponent(previewData: PreviewSubscribeResponse) {
  return render(SubscriptionTransitionPreviewWorkspace, {
    props: { previewData },
    global: { plugins: [i18n] }
  })
}

describe('SubscriptionTransitionPreviewWorkspace reactivation disclosure', () => {
  describe('banner visibility', () => {
    it('does not render when the subscription is not cancelled', () => {
      mockSubscription.value = { isCancelled: false, endDate: null }
      renderComponent(makePreview({ transition_type: 'upgrade' }))

      expect(
        screen.queryByText('Reactivating your subscription')
      ).not.toBeInTheDocument()
    })

    it('does not render for a downgrade when not cancelled', () => {
      mockSubscription.value = { isCancelled: false, endDate: null }
      renderComponent(makePreview({ transition_type: 'downgrade' }))

      expect(
        screen.queryByText('Reactivating your subscription')
      ).not.toBeInTheDocument()
    })
  })

  describe('banner copy', () => {
    it('shows the upgrade variant copy and charge-inclusive button label', () => {
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-15T00:00:00Z'
      }
      const { container } = renderComponent(
        makePreview({ transition_type: 'upgrade', cost_today_cents: 1500 })
      )
      const bodyText = container.textContent ?? ''

      expect(
        screen.getByText('Reactivating your subscription')
      ).toBeInTheDocument()
      expect(bodyText).toContain('Your Standard was set to end on Aug 15, 2026')
      expect(bodyText).toContain(
        "Upgrading now reactivates it — you'll be charged"
      )
      expect(bodyText).toContain('$15')
      expect(bodyText).toContain('today, and it will renew automatically on')
      expect(bodyText).toContain('Sep 15, 2026')
      expect(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $15 today'
        })
      ).toBeInTheDocument()
    })

    it('shows the downgrade variant copy with no charge mentioned and a plain button label', () => {
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-20T00:00:00Z'
      }
      const { container } = renderComponent(
        makePreview({
          transition_type: 'downgrade',
          is_immediate: false,
          cost_today_cents: 0,
          current_plan: {
            slug: 'creator-monthly',
            tier: 'CREATOR',
            duration: 'MONTHLY',
            price_cents: 3500,
            credits_cents: 0,
            seat_summary: {
              seat_count: 1,
              total_cost_cents: 3500,
              total_credits_cents: 0
            }
          },
          new_plan: {
            slug: 'standard-monthly',
            tier: 'STANDARD',
            duration: 'MONTHLY',
            price_cents: 1000,
            credits_cents: 0,
            period_end: '2026-09-20T00:00:00Z',
            seat_summary: {
              seat_count: 1,
              total_cost_cents: 1000,
              total_credits_cents: 0
            }
          }
        })
      )
      const bodyText = container.textContent ?? ''

      expect(bodyText).toContain('Your Creator was set to end on Aug 20, 2026')
      expect(bodyText).toContain('Switching to Standard reactivates it')
      expect(bodyText).toContain("you won't be charged today")
      expect(bodyText).toContain('Sep 20, 2026')
      expect(
        screen.getByRole('button', { name: 'Confirm & reactivate' })
      ).toBeInTheDocument()
    })

    it('shows the duration-change variant title and full-year charge copy', () => {
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-15T00:00:00Z'
      }
      const { container } = renderComponent(
        makePreview({
          transition_type: 'duration_change',
          cost_today_cents: 33_600,
          new_plan: {
            slug: 'standard-annual',
            tier: 'STANDARD',
            duration: 'ANNUAL',
            price_cents: 33_600,
            credits_cents: 0,
            period_end: '2027-08-15T00:00:00Z',
            seat_summary: {
              seat_count: 1,
              total_cost_cents: 33_600,
              total_credits_cents: 0
            }
          }
        })
      )
      const bodyText = container.textContent ?? ''

      expect(
        screen.getByText(
          'Reactivating your subscription — full year billed today'
        )
      ).toBeInTheDocument()
      expect(bodyText).toContain('charges the full year')
      expect(bodyText).toContain('$336')
      expect(bodyText).toContain('today')
      expect(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $336 today'
        })
      ).toBeInTheDocument()
    })
  })

  describe('charge threshold', () => {
    it('shows no checkbox and an enabled confirm when the charge is at or below the current monthly price', () => {
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-15T00:00:00Z'
      }
      renderComponent(
        makePreview({ transition_type: 'upgrade', cost_today_cents: 1500 })
      )

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $15 today'
        })
      ).toBeEnabled()
    })

    it('requires the checkbox before enabling confirm when the charge exceeds the current monthly price', async () => {
      const user = userEvent.setup()
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-15T00:00:00Z'
      }
      renderComponent(
        makePreview({
          transition_type: 'duration_change',
          cost_today_cents: 33_600,
          new_plan: {
            slug: 'standard-annual',
            tier: 'STANDARD',
            duration: 'ANNUAL',
            price_cents: 33_600,
            credits_cents: 0,
            period_end: '2027-08-15T00:00:00Z',
            seat_summary: {
              seat_count: 1,
              total_cost_cents: 33_600,
              total_credits_cents: 0
            }
          }
        })
      )

      const confirmButton = screen.getByRole('button', {
        name: 'Confirm & reactivate — $336 today'
      })
      const checkbox = screen.getByRole('checkbox')
      expect(confirmButton).toBeDisabled()

      await user.click(checkbox)

      expect(confirmButton).toBeEnabled()
    })
  })

  describe('confirm', () => {
    it('emits confirm when clicked', async () => {
      const user = userEvent.setup()
      mockSubscription.value = { isCancelled: false, endDate: null }
      const { emitted } = renderComponent(
        makePreview({ transition_type: 'downgrade', is_immediate: false })
      )

      await user.click(screen.getByRole('button', { name: 'Confirm change' }))

      expect(emitted().confirm).toBeTruthy()
    })
  })
})
