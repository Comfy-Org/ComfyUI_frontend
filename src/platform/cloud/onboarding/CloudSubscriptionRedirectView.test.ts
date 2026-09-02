import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { TeamCreditStops } from '@/platform/workspace/api/workspaceApi'

import CloudSubscriptionRedirectView from './CloudSubscriptionRedirectView.vue'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

// Router mocks
let mockQuery: Record<string, unknown> = {}
const mockRouterPush = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: mockQuery
  }),
  useRouter: () => ({
    push: mockRouterPush
  })
}))

// Firebase / subscription mocks
const authActionMocks = vi.hoisted(() => ({
  reportError: vi.fn(),
  accessBillingPortal: vi.fn()
}))

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => authActionMocks
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandlingAsync:
      <T extends (...args: never[]) => unknown>(fn: T) =>
      (...args: Parameters<T>) =>
        fn(...args)
  })
}))

const subscriptionMocks = vi.hoisted(() => ({
  canAccessSubscriptionFeatures: { value: false },
  isInitialized: { value: true },
  teamCreditStops: { value: null as TeamCreditStops | null },
  initialize: vi.fn(),
  fetchPlans: vi.fn(),
  manageSubscription: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => subscriptionMocks
}))

const mockShowPricingTable = vi.hoisted(() => vi.fn())
vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({ showPricingTable: mockShowPricingTable })
  })
)

const legacyCheckoutMocks = vi.hoisted(() => ({
  performSubscriptionCheckout: vi.fn(),
  performTeamSubscriptionCheckout: vi.fn()
}))

vi.mock('@/platform/cloud/subscription/utils/subscriptionCheckoutUtil', () => ({
  performSubscriptionCheckout: legacyCheckoutMocks.performSubscriptionCheckout
}))

vi.mock(
  '@/platform/cloud/subscription/utils/teamSubscriptionCheckoutUtil',
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
    subscriptionMocks.canAccessSubscriptionFeatures.value = false
    subscriptionMocks.isInitialized.value = true
    subscriptionMocks.teamCreditStops.value = TEAM_CREDIT_STOPS
    subscriptionMocks.initialize.mockResolvedValue(undefined)
    subscriptionMocks.fetchPlans.mockResolvedValue(undefined)
    subscriptionMocks.manageSubscription.mockResolvedValue(undefined)
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

    expect(mockShowPricingTable).toHaveBeenCalledWith({
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
    subscriptionMocks.canAccessSubscriptionFeatures.value = true

    await mountView({ tier: 'creator' })

    expect(mockRouterPush).not.toHaveBeenCalledWith('/')
    expect(subscriptionMocks.manageSubscription).toHaveBeenCalledTimes(1)
    expect(authActionMocks.accessBillingPortal).not.toHaveBeenCalled()
    expect(mockShowPricingTable).not.toHaveBeenCalled()
  })

  test('uses first value when subscriptionType is an array', async () => {
    await mountView({
      tier: ['creator', 'pro']
    })

    expect(mockRouterPush).not.toHaveBeenCalledWith('/')
    expect(screen.getByText('Subscribe to Creator')).toBeInTheDocument()
    expect(mockShowPricingTable).toHaveBeenCalledWith(
      expect.objectContaining({
        initialCheckout: expect.objectContaining({ tierKey: 'creator' })
      })
    )
  })

  test('checks out the team plan via the workspace path with the chosen stop and cycle', async () => {
    await mountView({ tier: 'team', stop: 'team_700', cycle: 'yearly' })

    expect(mockRouterPush).not.toHaveBeenCalledWith('/')
    expect(screen.getByText('Subscribe to Team Plan')).toBeInTheDocument()
    expect(mockShowPricingTable).toHaveBeenCalledWith({
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
    subscriptionMocks.teamCreditStops.value = null
    const plansError = new Error('plans down')
    subscriptionMocks.fetchPlans.mockRejectedValue(plansError)

    await mountView({ tier: 'team', stop: 'team_700', cycle: 'yearly' })

    expect(authActionMocks.reportError).toHaveBeenCalledWith(plansError)
    expect(mockShowPricingTable).toHaveBeenCalledWith({
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
    expect(mockShowPricingTable).not.toHaveBeenCalled()
  })

  test('routes a personal tier in an active Team workspace to workspace subscription management', async () => {
    subscriptionMocks.canAccessSubscriptionFeatures.value = true

    await mountView({ tier: 'creator', cycle: 'yearly' })

    expect(subscriptionMocks.manageSubscription).toHaveBeenCalledTimes(1)
    expect(authActionMocks.accessBillingPortal).not.toHaveBeenCalled()
    expect(
      legacyCheckoutMocks.performSubscriptionCheckout
    ).not.toHaveBeenCalled()
    expect(mockShowPricingTable).not.toHaveBeenCalled()
  })

  test('routes an active founder subscription to facade management', async () => {
    subscriptionMocks.canAccessSubscriptionFeatures.value = true

    await mountView({ tier: 'founder' })

    expect(subscriptionMocks.manageSubscription).toHaveBeenCalledTimes(1)
    expect(mockRouterPush).not.toHaveBeenCalled()
    expect(mockShowPricingTable).not.toHaveBeenCalled()
  })

  test('opens personal pricing without unsupported direct checkout for an inactive founder link', async () => {
    await mountView({ tier: 'founder' })

    expect(mockShowPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'personal'
    })
    expect(
      legacyCheckoutMocks.performSubscriptionCheckout
    ).not.toHaveBeenCalled()
  })
})
