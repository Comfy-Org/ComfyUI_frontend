import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type { TeamCreditStops } from '@/platform/workspace/api/workspaceApi'

import CloudSubscriptionRedirectView from './CloudSubscriptionRedirectView.vue'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

// Router mocks
let mockQuery: Record<string, unknown> = {}
const mockRouterPush = vi.fn()

vi.mock<unknown>(import('vue-router'), () => ({
  useRoute: () => ({
    query: mockQuery
  }),
  useRouter: () => ({
    push: mockRouterPush
  })
}))

// Firebase / subscription mocks
vi.mock(import('@/composables/auth/useAuthActions'))

vi.mock(import('@/composables/useErrorHandling'))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)

const legacyCheckoutMocks = vi.hoisted(() => ({
  performSubscriptionCheckout: vi.fn(),
  performTeamSubscriptionCheckout: vi.fn()
}))

vi.mock(
  import('@/platform/cloud/subscription/utils/subscriptionCheckoutUtil'),
  () => ({
    performSubscriptionCheckout: legacyCheckoutMocks.performSubscriptionCheckout
  })
)

vi.mock(
  import('@/platform/cloud/subscription/utils/teamSubscriptionCheckoutUtil'),
  () => ({
    performTeamSubscriptionCheckout:
      legacyCheckoutMocks.performTeamSubscriptionCheckout
  })
)

const TEAM_CREDIT_STOPS = {
  default_stop_index: 0,
  stops: [
    {
      id: 'team_700',
      credits: 147700,
      monthly: { list_price_cents: 70000, price_cents: 69000 },
      yearly: { list_price_cents: 70000, price_cents: 63000 }
    }
  ]
} satisfies TeamCreditStops

function installBillingContextFixture() {
  const billing = useBillingContext()
  const canAccessSubscriptionFeatures = ref(false)
  const teamCreditStops = ref<TeamCreditStops | null>(TEAM_CREDIT_STOPS)
  billing.isInitialized = ref(true)
  billing.canAccessSubscriptionFeatures = computed(
    () => canAccessSubscriptionFeatures.value
  )
  billing.teamCreditStops = computed(() => teamCreditStops.value)
  vi.mocked(useBillingContext).mockReturnValue(billing)
}

const createI18nInstance = () =>
  createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        cloudOnboarding: {
          skipToCloudApp: 'Skip to the cloud app'
        },
        g: {
          comfyOrgLogoAlt: 'Comfy org logo'
        },
        subscription: {
          subscribeTo: 'Subscribe to {plan}',
          teamPlan: { name: 'Team Plan' },
          tiers: {
            standard: { name: 'Standard' },
            creator: { name: 'Creator' },
            pro: { name: 'Pro' },
            founder: { name: 'Founder' }
          }
        }
      }
    }
  })

const mountView = async (query: Record<string, unknown>) => {
  mockQuery = query

  const { container } = render(CloudSubscriptionRedirectView, {
    global: {
      plugins: [createI18nInstance()]
    }
  })

  await flushPromises()

  return { container }
}

describe('CloudSubscriptionRedirectView', () => {
  beforeEach(() => {
    mockQuery = {}
    installBillingContextFixture()
  })

  test('redirects to home when subscriptionType is missing', async () => {
    await mountView({})

    expect(mockRouterPush).toHaveBeenCalledWith('/')
  })

  test('redirects to home when subscriptionType is invalid', async () => {
    await mountView({ tier: 'invalid' })

    expect(mockRouterPush).toHaveBeenCalledWith('/')
  })

  test('shows subscription copy when subscriptionType is valid', async () => {
    await mountView({ tier: 'creator' })

    // Should not redirect to home
    expect(mockRouterPush).not.toHaveBeenCalledWith('/')

    // Shows copy under logo
    expect(screen.getByText('Subscribe to Creator')).toBeInTheDocument()

    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'personal',
      initialCheckout: {
        planMode: 'personal',
        tierKey: 'creator',
        billingCycle: 'monthly'
      }
    })
    expect(
      legacyCheckoutMocks.performSubscriptionCheckout
    ).not.toHaveBeenCalled()

    // Shows loading affordances
    expect(
      screen.getByRole('link', { name: /skip to the cloud app/i })
    ).toBeInTheDocument()
  })

  test('opens billing portal when subscription is already active', async () => {
    useBillingContext().canAccessSubscriptionFeatures = computed(() => true)

    await mountView({ tier: 'creator' })

    expect(mockRouterPush).not.toHaveBeenCalledWith('/')
    expect(useBillingContext().manageSubscription).toHaveBeenCalledTimes(1)
    expect(useAuthActions().accessBillingPortal).not.toHaveBeenCalled()
    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
  })

  test('uses first value when subscriptionType is an array', async () => {
    await mountView({
      tier: ['creator', 'pro']
    })

    expect(mockRouterPush).not.toHaveBeenCalledWith('/')
    expect(screen.getByText('Subscribe to Creator')).toBeInTheDocument()
    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith(
      expect.objectContaining({
        initialCheckout: expect.objectContaining({ tierKey: 'creator' })
      })
    )
  })

  test('checks out the team plan via the workspace path with the chosen stop and cycle', async () => {
    await mountView({ tier: 'team', stop: 'team_700', cycle: 'yearly' })

    expect(mockRouterPush).not.toHaveBeenCalledWith('/')
    expect(screen.getByText('Subscribe to Team Plan')).toBeInTheDocument()
    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'team',
      initialCheckout: {
        planMode: 'team',
        stop: {
          id: 'team_700',
          credits: 147700,
          usd: 700,
          discountedUsd: 630
        },
        billingCycle: 'yearly'
      }
    })
    expect(
      legacyCheckoutMocks.performTeamSubscriptionCheckout
    ).not.toHaveBeenCalled()
  })

  test('opens the generic team pricing table when plan loading fails', async () => {
    useBillingContext().teamCreditStops = computed(() => null)
    const plansError = new Error('plans down')
    vi.mocked(useBillingContext().fetchPlans).mockRejectedValue(plansError)

    await mountView({ tier: 'team', stop: 'team_700', cycle: 'yearly' })

    expect(useAuthActions().reportError).toHaveBeenCalledWith(plansError)
    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'team',
      initialCheckout: undefined
    })
    expect(mockRouterPush).not.toHaveBeenCalled()
    expect(
      legacyCheckoutMocks.performTeamSubscriptionCheckout
    ).not.toHaveBeenCalled()
  })

  test('removes the pre-Vue splash loader on mount', async () => {
    const splashLoader = document.createElement('div')
    splashLoader.id = 'splash-loader'
    document.body.append(splashLoader)

    await mountView({ tier: 'creator' })

    expect(splashLoader).not.toBeInTheDocument()
  })

  test('redirects to home for a team link with no stop', async () => {
    await mountView({ tier: 'team', cycle: 'yearly' })

    expect(mockRouterPush).toHaveBeenCalledWith('/')
    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
  })

  test('routes a personal tier in an active Team workspace to workspace subscription management', async () => {
    useBillingContext().canAccessSubscriptionFeatures = computed(() => true)

    await mountView({ tier: 'creator', cycle: 'yearly' })

    expect(useBillingContext().manageSubscription).toHaveBeenCalledTimes(1)
    expect(useAuthActions().accessBillingPortal).not.toHaveBeenCalled()
    expect(
      legacyCheckoutMocks.performSubscriptionCheckout
    ).not.toHaveBeenCalled()
    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
  })

  test('routes an active founder subscription to facade management', async () => {
    useBillingContext().canAccessSubscriptionFeatures = computed(() => true)

    await mountView({ tier: 'founder' })

    expect(useBillingContext().manageSubscription).toHaveBeenCalledTimes(1)
    expect(mockRouterPush).not.toHaveBeenCalled()
    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
  })

  test('opens personal pricing without unsupported direct checkout for an inactive founder link', async () => {
    await mountView({ tier: 'founder' })

    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'personal'
    })
    expect(
      legacyCheckoutMocks.performSubscriptionCheckout
    ).not.toHaveBeenCalled()
  })
})
