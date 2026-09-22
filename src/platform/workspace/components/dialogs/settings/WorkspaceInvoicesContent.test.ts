import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SubscriptionInfo } from '@/composables/billing/types'
import enMessages from '@/locales/en/main.json'
import type {
  BillingStatus,
  Plan,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'

import WorkspaceInvoicesContent from './WorkspaceInvoicesContent.vue'

// `useNextInvoice` is deliberately left unmocked: the point of this panel is
// that it derives a real amount from billing state, so the test drives the
// derivation through the billing context it actually reads.
const state = vi.hoisted(() => ({
  isLoading: false,
  error: null as string | null,
  billingStatus: 'paid' as BillingStatus | null,
  subscription: null as SubscriptionInfo | null,
  plans: [] as Plan[],
  currentPlanSlug: null as string | null,
  teamCreditStops: null as TeamCreditStops | null,
  currentTeamCreditStop: null as { id: string } | null,
  initialize: vi.fn(async () => {}),
  manageSubscription: vi.fn(async () => {})
}))

const toastErrorHandler = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/composables/useErrorHandling'), () => ({
  useErrorHandling: () => ({ toastErrorHandler })
}))

vi.mock<unknown>(import('@/composables/billing/useBillingContext'), () => ({
  useBillingContext: () => ({
    isLoading: computed(() => state.isLoading),
    error: computed(() => state.error),
    billingStatus: computed(() => state.billingStatus),
    subscription: computed(() => state.subscription),
    plans: computed(() => state.plans),
    currentPlanSlug: computed(() => state.currentPlanSlug),
    teamCreditStops: computed(() => state.teamCreditStops),
    currentTeamCreditStop: computed(() => state.currentTeamCreditStop),
    initialize: state.initialize,
    manageSubscription: state.manageSubscription
  })
}))

function makeSubscription(
  overrides: Partial<SubscriptionInfo> = {}
): SubscriptionInfo {
  return {
    isActive: true,
    tier: 'STANDARD',
    duration: 'MONTHLY',
    planSlug: 'standard-monthly',
    scheduledChange: null,
    renewalDate: '2026-10-01T00:00:00Z',
    endDate: null,
    isCancelled: false,
    hasFunds: true,
    ...overrides
  }
}

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    slug: 'standard-monthly',
    tier: 'STANDARD',
    duration: 'MONTHLY',
    price_cents: 2000,
    credits_cents: 2000,
    max_seats: 1,
    availability: { available: true },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 2000,
      total_credits_cents: 2000
    },
    ...overrides
  }
}

function renderPanel() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return render(WorkspaceInvoicesContent, { global: { plugins: [i18n] } })
}

const historyButton = () =>
  screen.getByRole('button', { name: /Full invoice history/ })

beforeEach(() => {
  state.isLoading = false
  state.error = null
  state.billingStatus = 'paid'
  state.subscription = makeSubscription()
  state.plans = [makePlan()]
  state.currentPlanSlug = 'standard-monthly'
  state.teamCreditStops = null
  state.currentTeamCreditStop = null
  state.initialize.mockClear()
  state.manageSubscription.mockClear()
  toastErrorHandler.mockClear()
})

describe('WorkspaceInvoicesContent', () => {
  it('shows the upcoming charge derived from the active plan', () => {
    renderPanel()

    expect(screen.getByText('Next invoice')).toBeTruthy()
    expect(screen.getByText(/\$20\b/)).toBeTruthy()
    expect(historyButton()).toBeTruthy()
  })

  it('bills an annual plan as the yearly total, not the monthly rate', () => {
    state.subscription = makeSubscription({
      duration: 'ANNUAL',
      planSlug: 'team-annual'
    })
    state.currentPlanSlug = 'team-annual'
    state.teamCreditStops = {
      default_stop_index: 0,
      stops: [
        {
          id: 'stop-320',
          credits: 67520,
          monthly: { list_price_cents: 32000, price_cents: 30400 },
          yearly: { list_price_cents: 32000, price_cents: 28800 }
        }
      ]
    }
    state.currentTeamCreditStop = { id: 'stop-320' }

    renderPanel()

    // 28800 cents/month x 12 — the yearly stop price is a per-month figure.
    expect(screen.getByText(/\$3,456\b/)).toBeTruthy()
  })

  it('drops the amount while paused but keeps history reachable', () => {
    state.billingStatus = 'paused'

    renderPanel()

    expect(screen.queryByText('Next invoice')).toBeNull()
    expect(historyButton()).toBeTruthy()
  })

  it('drops the amount for a cancelled subscription', () => {
    state.subscription = makeSubscription({ isCancelled: true })

    renderPanel()

    expect(screen.queryByText('Next invoice')).toBeNull()
    expect(historyButton()).toBeTruthy()
  })

  it('opens the Stripe portal from the history action', async () => {
    renderPanel()

    await userEvent.click(historyButton())

    expect(state.manageSubscription).toHaveBeenCalledOnce()
  })

  it('waits for billing data instead of rendering a $0 charge', () => {
    state.isLoading = true
    state.subscription = null

    renderPanel()

    expect(screen.getByText('Loading')).toBeTruthy()
    expect(screen.queryByText('Next invoice')).toBeNull()
  })

  it('offers a retry when billing data fails to load', async () => {
    state.error = 'boom'
    state.subscription = null

    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(state.initialize).toHaveBeenCalledOnce()
  })

  it('surfaces the error state rather than an unhandled rejection on retry', async () => {
    state.error = 'boom'
    state.subscription = null
    state.initialize.mockRejectedValueOnce(new Error('still down'))
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    try {
      renderPanel()
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      await new Promise<void>((resolve) => setImmediate(resolve))
    } finally {
      process.off('unhandledRejection', unhandled)
    }

    expect(unhandled).not.toHaveBeenCalled()
  })

  it('toasts when the billing portal fails to open', async () => {
    state.manageSubscription.mockRejectedValueOnce(new Error('portal down'))

    renderPanel()
    await userEvent.click(historyButton())
    await new Promise<void>((resolve) => setImmediate(resolve))

    expect(toastErrorHandler).toHaveBeenCalledWith(expect.any(Error))
  })
})
