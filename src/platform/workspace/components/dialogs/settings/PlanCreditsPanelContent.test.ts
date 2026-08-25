import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { ref } from 'vue'

import { render, screen, waitFor } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json'
import type { Plan } from '@/platform/workspace/api/workspaceApi'

import PlanCreditsPanelContent from './PlanCreditsPanelContent.vue'

const mockDistribution = vi.hoisted(() => ({ cloud: true }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockDistribution.cloud
  }
}))

const refreshSpy = vi.hoisted(() => vi.fn(() => Promise.resolve()))

const billing = vi.hoisted(() => ({
  fetchPlans: vi.fn()
}))

// Refs the fetch writes and the panel reads; created after imports so `ref` is
// available (vi.hoisted runs before imports, so it can't call ref itself).
const billingState = {
  plans: ref<unknown[]>([]),
  teamCreditStops: ref<unknown>(null),
  isLoading: ref(false),
  error: ref<string | null>(null)
}

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({ fetchPlans: billing.fetchPlans })
}))

vi.mock('@/platform/cloud/subscription/composables/useBillingPlans', () => ({
  useBillingPlans: () => billingState
}))

const stubs = {
  SubscriptionPanelContentWorkspace: {
    template: '<section aria-label="Plan and credits overview" />'
  },
  CreditsPanel: {
    props: ['embedded'],
    template: '<section aria-label="Local credits overview" />'
  },
  SettingsPlansSection: {
    template: '<section aria-label="Plans section" />'
  },
  SubscriptionFooterLinks: {
    template: '<footer aria-label="Subscription links" />'
  },
  UsageLogsTable: {
    template: '<section aria-label="Usage logs" />',
    methods: {
      refresh: refreshSpy
    }
  }
}

function renderPanel({ cloud = true } = {}) {
  mockDistribution.cloud = cloud
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return render(PlanCreditsPanelContent, { global: { plugins: [i18n], stubs } })
}

describe('PlanCreditsPanelContent', () => {
  it('shows Credits and Activity tabs with Credits active by default', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'Credits' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Activity' })).toBeTruthy()
    expect(
      screen.getByRole('region', { name: 'Plan and credits overview' })
    ).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Usage logs' })).toBeNull()
  })

  it('shows the credits card first and the plans section below it on local', () => {
    renderPanel({ cloud: false })

    const creditsCard = screen.getByRole('region', {
      name: 'Local credits overview'
    })
    const plansSection = screen.getByRole('region', { name: 'Plans section' })
    expect(
      creditsCard.compareDocumentPosition(plansSection) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      screen.getByRole('contentinfo', { name: 'Subscription links' })
    ).toBeTruthy()
    expect(
      screen.queryByRole('region', { name: 'Plan and credits overview' })
    ).toBeNull()
  })

  it('never shows the plans section on cloud', () => {
    renderPanel({ cloud: true })

    expect(screen.queryByRole('region', { name: 'Plans section' })).toBeNull()
    expect(
      screen.getByRole('region', { name: 'Plan and credits overview' })
    ).toBeTruthy()
  })

  it('opens the platform usage page from the Activity tab', async () => {
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))
    await userEvent.click(screen.getByRole('button', { name: 'Full activity' }))

    expect(windowOpen).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/\/profile\/usage$/),
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('loads the usage log on the Activity tab', async () => {
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))
    expect(screen.getByRole('region', { name: 'Usage logs' })).toBeTruthy()
    expect(
      screen.queryByRole('region', { name: 'Plan and credits overview' })
    ).toBeNull()
    await waitFor(() => expect(refreshSpy).toHaveBeenCalledOnce())
  })

  it('reports usage-log refresh failures', async () => {
    const error = new Error('refresh failed')
    refreshSpy.mockRejectedValueOnce(error)
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledExactlyOnceWith(
        'Error refreshing usage logs:',
        error
      )
    )
  })
})

describe('PlanCreditsPanelContent — the fetch drives the rendered offer', () => {
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

  // Section rendered UNSTUBBED so the assertion is on real rendered values —
  // a stubbed section would pass with the wire cut (the round-1 failure).
  const wireStubs = {
    SubscriptionPanelContentWorkspace: {
      template: '<section aria-label="Plan and credits overview" />'
    },
    CreditsPanel: {
      props: ['embedded'],
      template: '<section aria-label="Local credits overview" />'
    },
    SubscriptionFooterLinks: {
      template: '<footer aria-label="Subscription links" />'
    },
    UsageLogsTable: {
      template: '<section aria-label="Usage logs" />',
      methods: { refresh: refreshSpy }
    }
  }

  function renderWired({ cloud = false } = {}) {
    mockDistribution.cloud = cloud
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })
    return render(PlanCreditsPanelContent, {
      global: { plugins: [i18n], stubs: wireStubs }
    })
  }

  beforeEach(() => {
    billingState.plans.value = []
    billingState.teamCreditStops.value = null
    billingState.isLoading.value = false
    billingState.error.value = null
    billing.fetchPlans.mockReset()
    // fetchPlans populates the singleton the section reads — the real wire.
    billing.fetchPlans.mockImplementation(async () => {
      billingState.plans.value = [makePlan('STANDARD', 'ANNUAL', 24000, 50400)]
    })
  })

  it('fetches on mount off-cloud and renders the fetched catalog', async () => {
    renderWired({ cloud: false })

    expect(billing.fetchPlans).toHaveBeenCalledTimes(1)
    // The fetched STANDARD/ANNUAL row: $20/mo, 50,400 credits — from the fetch,
    // not a constant.
    expect(await screen.findByText('$20')).toBeTruthy()
    expect(screen.getByText('50,400')).toBeTruthy()
  })

  it('renders different numbers when the fetch returns different data', async () => {
    billing.fetchPlans.mockImplementation(async () => {
      billingState.plans.value = [makePlan('STANDARD', 'ANNUAL', 30000, 60000)]
    })
    renderWired({ cloud: false })

    expect(await screen.findByText('$25')).toBeTruthy()
    expect(screen.getByText('60,000')).toBeTruthy()
    expect(screen.queryByText('$20')).toBeNull()
  })

  it('renders the empty state when the fetch yields no catalog', async () => {
    billing.fetchPlans.mockImplementation(async () => {
      billingState.plans.value = []
    })
    renderWired({ cloud: false })

    expect(
      await screen.findByText(
        'No plans are available right now. Check back soon.'
      )
    ).toBeTruthy()
    expect(screen.queryByText("We couldn't load your plan details.")).toBeNull()
    expect(screen.queryByText(/\$\d+ Billed yearly/)).toBeNull()
  })

  it('renders the error state when the fetch fails', async () => {
    billing.fetchPlans.mockImplementation(async () => {
      billingState.plans.value = []
      billingState.error.value = 'network down'
    })
    renderWired({ cloud: false })

    expect(
      await screen.findByText("We couldn't load your plan details.")
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(
      screen.queryByText('No plans are available right now. Check back soon.')
    ).toBeNull()
  })

  it('does not fetch or mount the section on cloud', () => {
    renderWired({ cloud: true })

    expect(billing.fetchPlans).not.toHaveBeenCalled()
    expect(screen.queryByText('$20')).toBeNull()
    expect(
      screen.getByRole('region', { name: 'Plan and credits overview' })
    ).toBeTruthy()
  })
})
