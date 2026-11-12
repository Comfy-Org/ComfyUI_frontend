import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import type { PreviewSubscribeResponse } from '@comfyorg/billing-core'

import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'

const { mockSubscription } = vi.hoisted(() => ({
  mockSubscription: {
    value: null as { isCancelled: boolean; endDate: string | null } | null
  }
}))

vi.mock(import('@/platform/billing/composables/useBillingContext'))

beforeEach(() => {
  mockSubscription.value = { isCancelled: false, endDate: null }
  const billingContext = useBillingContext()
  billingContext.subscription = computed(() =>
    mockSubscription.value
      ? {
          isActive: true,
          tier: null,
          duration: null,
          planSlug: null,
          scheduledChange: null,
          renewalDate: null,
          hasFunds: true,
          agentHasFunds: true,
          ...mockSubscription.value
        }
      : null
  )
  vi.mocked(useBillingContext).mockReturnValue(billingContext)
})

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
        teamPlan: { name: 'Team Plan' },
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
            withoutRenewalDate: {
              upgradeBody:
                "Your {plan} was set to end on {date}. Upgrading now reactivates it — you'll be charged {amount} today, and it will renew automatically instead of ending."
            },
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
  const result: PreviewSubscribeResponse = {
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
  return {
    ...result,
    quote_id: 'quote_123',
    quote_version: 1,
    amount_due_cents: result.cost_today_cents,
    currency: 'usd',
    renewal_amount_cents: result.new_plan.price_cents,
    renewal_at: result.new_plan.period_end ?? '2026-09-01T00:00:00Z',
    ...overrides
  }
}

function cancelled(
  overrides: Partial<PreviewSubscribeResponse> = {}
): PreviewSubscribeResponse {
  return makePreview({
    requires_reactivation_confirmation: true,
    cancel_at: '2026-08-15T00:00:00Z',
    ...overrides
  })
}

function renderComponent(previewData: PreviewSubscribeResponse) {
  return render(SubscriptionTransitionPreviewWorkspace, {
    props: { previewData },
    global: { plugins: [i18n] }
  })
}

describe('SubscriptionTransitionPreviewWorkspace reactivation disclosure', () => {
  describe('banner visibility', () => {
    it.for([
      { served: true, banner: true },
      { served: false, banner: false },
      { served: undefined, banner: false }
    ])(
      'follows the served requires_reactivation_confirmation (served $served)',
      ({ served, banner }) => {
        renderComponent(
          cancelled({ requires_reactivation_confirmation: served })
        )

        expect(
          screen.queryByText('Reactivating your subscription') !== null
        ).toBe(banner)
        expect(
          screen.queryByRole('button', { name: /Confirm & reactivate/ }) !==
            null
        ).toBe(banner)
      }
    )

    it('ignores a cancelled subscription status the preview does not serve as reactivating', () => {
      mockSubscription.value = {
        isCancelled: true,
        endDate: '2026-08-15T00:00:00Z'
      }
      renderComponent(
        makePreview({ requires_reactivation_confirmation: false })
      )

      expect(
        screen.queryByText('Reactivating your subscription')
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Confirm upgrade' })
      ).toBeInTheDocument()
    })

    it('names the team plan and the served cancel_at for a team reactivation', () => {
      const preview = cancelled({
        cost_today_cents: 2500,
        cancel_at: '2026-08-29T00:00:00Z',
        requires_reactivation_charge_confirmation: true
      })
      preview.current_plan!.tier = 'TEAM'

      const { container } = renderComponent(preview)

      expect(container.textContent).toContain(
        i18n.global.t('subscription.teamPlan.name')
      )
      expect(container.textContent).toContain('Aug 29, 2026')
      expect(container.textContent).not.toContain(
        'subscription.tiers.team.name'
      )
      expect(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $25.00 today'
        })
      ).toBeDisabled()
    })
  })

  describe('banner copy', () => {
    it('names the served cancel_at, not the current period end', () => {
      const preview = cancelled({ cancel_at: '2026-08-10T00:00:00Z' })
      preview.current_plan!.period_end = '2026-08-31T00:00:00Z'

      const { container } = renderComponent(preview)

      expect(container.textContent).toContain(
        'Your Standard was set to end on Aug 10, 2026'
      )
      expect(container.textContent).not.toContain('Aug 31, 2026')
    })

    it('shows the upgrade variant copy and charge-inclusive button label', () => {
      const { container } = renderComponent(
        cancelled({ transition_type: 'upgrade', cost_today_cents: 1500 })
      )
      const bodyText = container.textContent

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
      const { container } = renderComponent(
        cancelled({
          transition_type: 'downgrade',
          is_immediate: false,
          cost_today_cents: 0,
          cancel_at: '2026-08-20T00:00:00Z',
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
      const bodyText = container.textContent

      expect(bodyText).toContain('Your Creator was set to end on Aug 20, 2026')
      expect(bodyText).toContain('Switching to Standard reactivates it')
      expect(bodyText).toContain("you won't be charged today")
      expect(bodyText).toContain('Sep 20, 2026')
      expect(
        screen.getByRole('button', { name: 'Confirm & reactivate' })
      ).toBeInTheDocument()
    })

    it('shows the duration-change variant title and full-year charge copy', () => {
      const { container } = renderComponent(
        cancelled({
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
      const bodyText = container.textContent

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
      const { container } = renderComponent(
        cancelled({
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
      const bodyText = container.textContent

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

  describe('charge consent', () => {
    it.for([
      { served: true, checkbox: true },
      { served: false, checkbox: false },
      { served: undefined, checkbox: false }
    ])(
      'follows the served requires_reactivation_charge_confirmation on a large charge (served $served)',
      ({ served, checkbox }) => {
        renderComponent(
          cancelled({
            cost_today_cents: 99_900,
            requires_reactivation_charge_confirmation: served
          })
        )

        expect(screen.queryAllByRole('checkbox')).toHaveLength(checkbox ? 1 : 0)
        expect(
          screen.getByRole('button', {
            name: 'Confirm & reactivate — $999.00 today'
          })
        ).toHaveProperty('disabled', checkbox)
      }
    )

    it('requires the checkbox before enabling confirm when the preview demands consent, even for a small charge', async () => {
      const user = userEvent.setup()
      renderComponent(
        cancelled({
          cost_today_cents: 500,
          requires_reactivation_charge_confirmation: true
        })
      )

      const confirmButton = screen.getByRole('button', {
        name: 'Confirm & reactivate — $5.00 today'
      })
      expect(confirmButton).toBeDisabled()

      await user.click(
        screen.getByRole('checkbox', {
          name: "I understand I'll be charged $5.00 today"
        })
      )

      expect(confirmButton).toBeEnabled()
    })
  })

  describe('confirm', () => {
    it('emits confirmReactivation false when the preview is not reactivating', async () => {
      const user = userEvent.setup()
      const { emitted } = renderComponent(
        makePreview({ transition_type: 'downgrade', is_immediate: false })
      )

      await user.click(screen.getByRole('button', { name: 'Confirm change' }))

      expect(emitted().confirm).toEqual([[false]])
    })

    it('emits confirmReactivation true with no checkbox to tick when the preview demands no consent', async () => {
      const user = userEvent.setup()
      const { emitted } = renderComponent(
        cancelled({
          cost_today_cents: 1500,
          requires_reactivation_charge_confirmation: false
        })
      )

      await user.click(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $15.00 today'
        })
      )

      expect(emitted().confirm).toEqual([[true]])
    })

    it('emits confirmReactivation true on a consent-demanding preview only once the checkbox is ticked', async () => {
      const user = userEvent.setup()
      const { emitted } = renderComponent(
        cancelled({
          cost_today_cents: 4500,
          requires_reactivation_charge_confirmation: true
        })
      )
      const confirmButton = screen.getByRole('button', {
        name: 'Confirm & reactivate — $45.00 today'
      })

      await user.click(confirmButton)
      expect(emitted().confirm).toBeUndefined()

      await user.click(screen.getByRole('checkbox'))
      await user.click(confirmButton)

      expect(emitted().confirm).toEqual([[true]])
    })

    it('emits the exact fractional charge, not rounded to whole dollars', () => {
      renderComponent(cancelled({ cost_today_cents: 5454 }))

      expect(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $54.54 today'
        })
      ).toBeInTheDocument()
    })
  })

  describe('confirm gating on load state', () => {
    it('prices a preview that carries no exact quote from the legacy costs', () => {
      renderComponent(
        makePreview({
          quote_id: undefined,
          quote_version: undefined,
          amount_due_cents: undefined,
          currency: undefined,
          renewal_amount_cents: undefined,
          renewal_at: undefined
        })
      )

      expect(screen.getByText('$15.00')).toBeInTheDocument()
      expect(
        screen.queryByText('subscription.preview.quoteUnavailable')
      ).toBeNull()
    })

    it('disables confirm while subscription status has not loaded yet', () => {
      mockSubscription.value = null
      renderComponent(
        makePreview({ transition_type: 'downgrade', is_immediate: false })
      )

      expect(
        screen.getByRole('button', { name: 'Confirm change' })
      ).toBeDisabled()
    })

    it('re-enables confirm once subscription status has loaded', () => {
      renderComponent(
        makePreview({ transition_type: 'downgrade', is_immediate: false })
      )

      expect(
        screen.getByRole('button', { name: 'Confirm change' })
      ).toBeEnabled()
    })
  })

  describe('missing reactivation data', () => {
    it('hides the banner and its label when the preview serves no cancel_at', () => {
      renderComponent(cancelled({ cancel_at: undefined }))

      expect(
        screen.queryByText('Reactivating your subscription')
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Confirm upgrade' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /Confirm & reactivate/ })
      ).not.toBeInTheDocument()
    })
  })

  describe('reactivation consent lifetime', () => {
    it('resets a ticked checkbox when a replacement preview keeps the same charge', async () => {
      const user = userEvent.setup()
      const { rerender } = renderComponent(
        cancelled({
          cost_today_cents: 4500,
          requires_reactivation_charge_confirmation: true
        })
      )
      await user.click(screen.getByRole('checkbox'))
      expect(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $45.00 today'
        })
      ).toBeEnabled()

      await rerender({
        previewData: cancelled({
          cost_today_cents: 4500,
          credits_next_period_cents: 1_000,
          proration_at: '2026-08-01T00:01:00Z',
          requires_reactivation_charge_confirmation: true
        })
      })

      expect(screen.getByRole('checkbox')).not.toBeChecked()
      expect(
        screen.getByRole('button', {
          name: 'Confirm & reactivate — $45.00 today'
        })
      ).toBeDisabled()
    })
  })

  describe('a quote with no renewal date', () => {
    it('leaves the renewal clause out instead of computing a date', () => {
      const { container } = renderComponent(
        cancelled({
          effective_at: '2026-08-01T00:00:00Z',
          renewal_at: undefined,
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
          }
        })
      )
      const bodyText = container.textContent

      expect(bodyText).toContain(
        'it will renew automatically instead of ending.'
      )
      expect(bodyText).not.toContain('renew automatically on')
    })
  })
})
