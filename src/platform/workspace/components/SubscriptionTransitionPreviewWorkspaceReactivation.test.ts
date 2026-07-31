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
            durationChangeBodyMonthly:
              "Your {plan} was set to end on {date}. Switching to monthly billing reactivates it — you'll be charged {amount} today, and it will renew automatically on {nextDate} instead of ending.",
            confirmButton: 'Confirm & reactivate',
            confirmButtonWithCharge: 'Confirm & reactivate — {amount} today',
            checkboxLabel: "I understand I'll be charged {amount} today",
            confirmationRequired:
              'Your subscription is cancelled — please confirm the reactivation charge before continuing'
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
      expect(bodyText).toContain('$15.00')
      expect(bodyText).toContain('today, and it will renew automatically on')
      expect(bodyText).toContain('Sep 15, 2026')
      expect(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $15.00 today'
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
      expect(bodyText).toContain('$336.00')
      expect(bodyText).toContain('today')
      expect(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $336.00 today'
        })
      ).toBeInTheDocument()
    })

    it('shows the monthly-target duration-change copy and title, distinct from the annual variant', () => {
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-15T00:00:00Z'
      }
      const { container } = renderComponent(
        makePreview({
          transition_type: 'duration_change',
          cost_today_cents: 1200,
          current_plan: {
            slug: 'standard-annual',
            tier: 'STANDARD',
            duration: 'ANNUAL',
            price_cents: 24_000,
            credits_cents: 0,
            seat_summary: {
              seat_count: 1,
              total_cost_cents: 24_000,
              total_credits_cents: 0
            }
          },
          new_plan: {
            slug: 'standard-monthly',
            tier: 'STANDARD',
            duration: 'MONTHLY',
            price_cents: 2000,
            credits_cents: 0,
            period_end: '2026-09-15T00:00:00Z',
            seat_summary: {
              seat_count: 1,
              total_cost_cents: 2000,
              total_credits_cents: 0
            }
          }
        })
      )
      const bodyText = container.textContent ?? ''

      // Not the annual-only title/copy: an annual→monthly switch doesn't
      // charge a full year.
      expect(
        screen.queryByText(
          'Reactivating your subscription — full year billed today'
        )
      ).not.toBeInTheDocument()
      expect(
        screen.getByText('Reactivating your subscription')
      ).toBeInTheDocument()
      expect(bodyText).not.toContain('charges the full year')
      expect(bodyText).toContain('Switching to monthly billing reactivates it')
      expect(bodyText).toContain('$12.00')
      expect(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $12.00 today'
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
          name: 'Confirm & reactivate — $15.00 today'
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
        name: 'Confirm & reactivate — $336.00 today'
      })
      const checkbox = screen.getByRole('checkbox')
      expect(confirmButton).toBeDisabled()

      await user.click(checkbox)

      expect(confirmButton).toBeEnabled()
    })

    it('uses the whole-subscription seat total, not the per-seat price, on a multi-seat team plan', () => {
      // 3 seats at 2000/seat = 6000 total; a 5000 charge is below the
      // per-seat price (2000) x... actually below the *total* (6000) so no
      // checkbox should appear even though it exceeds the per-seat price.
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-15T00:00:00Z'
      }
      renderComponent(
        makePreview({
          transition_type: 'upgrade',
          cost_today_cents: 5000,
          current_plan: {
            slug: 'team-per-credit-monthly',
            tier: 'PRO',
            duration: 'MONTHLY',
            price_cents: 2000,
            credits_cents: 0,
            seat_summary: {
              seat_count: 3,
              total_cost_cents: 6000,
              total_credits_cents: 0
            }
          }
        })
      )

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })
  })

  describe('confirm', () => {
    it('emits confirmReactivation false when the subscription is not cancelled', async () => {
      const user = userEvent.setup()
      mockSubscription.value = { isCancelled: false, endDate: null }
      const { emitted } = renderComponent(
        makePreview({ transition_type: 'downgrade', is_immediate: false })
      )

      await user.click(screen.getByRole('button', { name: 'Confirm change' }))

      expect(emitted().confirm).toEqual([[false]])
    })

    it('emits confirmReactivation true below the charge threshold, with no checkbox to tick', async () => {
      const user = userEvent.setup()
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-15T00:00:00Z'
      }
      const { emitted } = renderComponent(
        makePreview({ transition_type: 'upgrade', cost_today_cents: 1500 })
      )

      await user.click(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $15.00 today'
        })
      )

      expect(emitted().confirm).toEqual([[true]])
    })

    it('emits confirmReactivation true above the threshold only once the checkbox is ticked', async () => {
      const user = userEvent.setup()
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-15T00:00:00Z'
      }
      const { emitted } = renderComponent(
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
        name: 'Confirm & reactivate — $336.00 today'
      })

      await user.click(screen.getByRole('checkbox'))
      await user.click(confirmButton)

      expect(emitted().confirm).toEqual([[true]])
    })

    it('emits the exact fractional charge, not rounded to whole dollars', () => {
      // 5454 cents is $54.54; the old maximumFractionDigits:0 formatting
      // would have rounded this to "$55", misstating what the user is
      // actually charged on the one control meant to secure their consent.
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-15T00:00:00Z'
      }
      renderComponent(
        makePreview({ transition_type: 'upgrade', cost_today_cents: 5454 })
      )

      expect(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $54.54 today'
        })
      ).toBeInTheDocument()
    })
  })

  describe('confirm gating on load state', () => {
    it('disables confirm while subscription status has not loaded yet, even below the charge threshold', () => {
      mockSubscription.value = null
      renderComponent(
        makePreview({ transition_type: 'downgrade', is_immediate: false })
      )

      expect(
        screen.getByRole('button', { name: 'Confirm change' })
      ).toBeDisabled()
    })

    it('re-enables confirm once subscription status has loaded', () => {
      mockSubscription.value = { isCancelled: false, endDate: null }
      renderComponent(
        makePreview({ transition_type: 'downgrade', is_immediate: false })
      )

      expect(
        screen.getByRole('button', { name: 'Confirm change' })
      ).toBeEnabled()
    })
  })

  describe('missing reactivation data', () => {
    it('hides the banner when the subscription has no end date', () => {
      mockSubscription.value = { isCancelled: true, endDate: null }
      renderComponent(makePreview({ transition_type: 'upgrade' }))

      expect(
        screen.queryByText('Reactivating your subscription')
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      // The button label must not claim reactivation when the banner (and
      // the consent it collects) never rendered.
      expect(
        screen.getByRole('button', { name: 'Confirm upgrade' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /Confirm & reactivate/ })
      ).not.toBeInTheDocument()
    })

    it('hides the banner when the preview carries no current_plan', () => {
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-15T00:00:00Z'
      }
      renderComponent(
        makePreview({ transition_type: 'upgrade', current_plan: undefined })
      )

      expect(
        screen.queryByText('Reactivating your subscription')
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Confirm upgrade' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /Confirm & reactivate/ })
      ).not.toBeInTheDocument()
    })
  })

  describe('reactivation consent lifetime', () => {
    it('resets a ticked checkbox when the charge amount changes', async () => {
      const user = userEvent.setup()
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-15T00:00:00Z'
      }
      const { rerender } = renderComponent(
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
      await user.click(screen.getByRole('checkbox'))
      expect(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $336.00 today'
        })
      ).toBeEnabled()

      // A different preview loads (e.g. user went back and re-previewed) with
      // a higher charge; the earlier tick must not carry over as consent.
      await rerender({
        previewData: makePreview({
          transition_type: 'duration_change',
          cost_today_cents: 50_000,
          new_plan: {
            slug: 'standard-annual',
            tier: 'STANDARD',
            duration: 'ANNUAL',
            price_cents: 50_000,
            credits_cents: 0,
            period_end: '2027-08-15T00:00:00Z',
            seat_summary: {
              seat_count: 1,
              total_cost_cents: 50_000,
              total_credits_cents: 0
            }
          }
        })
      })

      expect(screen.getByRole('checkbox')).not.toBeChecked()
      expect(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $500.00 today'
        })
      ).toBeDisabled()
    })
  })

  describe('downgrade variant checkbox suppression', () => {
    it('never shows a checkbox for the downgrade variant, even if cost_today_cents is unexpectedly positive', () => {
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-15T00:00:00Z'
      }
      renderComponent(
        makePreview({
          transition_type: 'downgrade',
          is_immediate: false,
          // A downgrade should never charge today; this asserts the FE
          // doesn't surface a contradictory checkbox even if it did.
          cost_today_cents: 999_999
        })
      )

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Confirm & reactivate' })
      ).toBeEnabled()
    })
  })

  describe('next payment date fallback', () => {
    it('falls back to one month after activation for a monthly plan with no period_end', () => {
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-15T00:00:00Z'
      }
      const { container } = renderComponent(
        makePreview({
          transition_type: 'upgrade',
          effective_at: '2026-08-01T00:00:00Z',
          new_plan: {
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
            // No period_end.
          }
        })
      )
      const bodyText = container.textContent ?? ''

      // Not the activation date itself (which would misreport as "renews
      // today"); one month later instead.
      expect(bodyText).not.toContain('renew automatically on Aug 1, 2026')
      expect(bodyText).toContain('renew automatically on Sep 1, 2026')
    })

    it('clamps a Jan 31 + 1 month fallback to Feb 28, not Mar 3', () => {
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-01-15T00:00:00Z'
      }
      const { container } = renderComponent(
        makePreview({
          transition_type: 'upgrade',
          effective_at: '2026-01-31T00:00:00Z',
          new_plan: {
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
            // No period_end.
          }
        })
      )
      const bodyText = container.textContent ?? ''

      expect(bodyText).not.toContain('renew automatically on Mar')
      expect(bodyText).toContain('renew automatically on Feb 28, 2026')
    })

    it('clamps a Feb 29 leap-day + 12 months fallback to Feb 28 the next year', () => {
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2028-02-15T00:00:00Z'
      }
      const { container } = renderComponent(
        makePreview({
          transition_type: 'upgrade',
          effective_at: '2028-02-29T00:00:00Z',
          new_plan: {
            slug: 'creator-annual',
            tier: 'CREATOR',
            duration: 'ANNUAL',
            price_cents: 33_600,
            credits_cents: 0,
            seat_summary: {
              seat_count: 1,
              total_cost_cents: 33_600,
              total_credits_cents: 0
            }
            // No period_end.
          }
        })
      )
      const bodyText = container.textContent ?? ''

      expect(bodyText).not.toContain('renew automatically on Mar')
      expect(bodyText).toContain('renew automatically on Feb 28, 2029')
    })

    it('clamps a Mar 31 + 1 month fallback to Apr 30, not May 1', () => {
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-03-15T00:00:00Z'
      }
      const { container } = renderComponent(
        makePreview({
          transition_type: 'upgrade',
          effective_at: '2026-03-31T00:00:00Z',
          new_plan: {
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
            // No period_end.
          }
        })
      )
      const bodyText = container.textContent ?? ''

      expect(bodyText).not.toContain('renew automatically on May')
      expect(bodyText).toContain('renew automatically on Apr 30, 2026')
    })
  })
})
