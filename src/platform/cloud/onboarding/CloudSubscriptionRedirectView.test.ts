import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

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
  isActiveSubscription: { value: false },
  isInitialized: { value: true },
  subscriptionStatus: { value: null }
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => subscriptionMocks
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => subscriptionMocks
}))

// Avoid real network / isCloud behavior
const mockPerformSubscriptionCheckout = vi.fn()
vi.mock('@/platform/cloud/subscription/utils/subscriptionCheckoutUtil', () => ({
  performSubscriptionCheckout: (...args: unknown[]) =>
    mockPerformSubscriptionCheckout(...args)
}))

const mockPerformTeamSubscriptionCheckout = vi.fn()
vi.mock(
  '@/platform/cloud/subscription/utils/teamSubscriptionCheckoutUtil',
  () => ({
    performTeamSubscriptionCheckout: (...args: unknown[]) =>
      mockPerformTeamSubscriptionCheckout(...args)
  })
)

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
          teamPlan: {
            name: 'Team Plan',
            confirmHeading: 'Confirm your Team subscription',
            confirmCreditsPerMonth: '{credits} credits / month',
            billedMonthly: 'Billed monthly',
            billedYearly: 'Billed yearly',
            confirmChargeNotice:
              'Continuing subscribes your workspace and charges the payment method on file.',
            confirmCta: 'Confirm & subscribe',
            confirmCancel: 'Cancel'
          },
          tiers: {
            standard: { name: 'Standard' },
            creator: { name: 'Creator' },
            pro: { name: 'Pro' }
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
    vi.clearAllMocks()
    mockQuery = {}
    subscriptionMocks.isActiveSubscription.value = false
    subscriptionMocks.isInitialized.value = true
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

    // Triggers checkout flow
    expect(mockPerformSubscriptionCheckout).toHaveBeenCalledWith(
      'creator',
      'monthly',
      {
        openInNewTab: false,
        paymentIntentSource: 'deep_link'
      }
    )

    // Shows loading affordances
    expect(
      screen.getByRole('link', { name: /skip to the cloud app/i })
    ).toBeInTheDocument()
  })

  test('opens billing portal when subscription is already active', async () => {
    subscriptionMocks.isActiveSubscription.value = true

    await mountView({ tier: 'creator' })

    expect(mockRouterPush).not.toHaveBeenCalledWith('/')
    expect(authActionMocks.accessBillingPortal).toHaveBeenCalledTimes(1)
    expect(mockPerformSubscriptionCheckout).not.toHaveBeenCalled()
  })

  test('uses first value when subscriptionType is an array', async () => {
    await mountView({
      tier: ['creator', 'pro']
    })

    expect(mockRouterPush).not.toHaveBeenCalledWith('/')
    expect(screen.getByText('Subscribe to Creator')).toBeInTheDocument()
    expect(mockPerformSubscriptionCheckout).toHaveBeenCalledWith(
      'creator',
      'monthly',
      {
        openInNewTab: false,
        paymentIntentSource: 'deep_link'
      }
    )
  })

  test('stages the team plan and does not charge until the user confirms', async () => {
    await mountView({ tier: 'team', stop: 'team_700', cycle: 'yearly' })

    expect(mockRouterPush).not.toHaveBeenCalledWith('/')
    // A confirmation is shown instead of an immediate charge
    expect(
      screen.getByText('Confirm your Team subscription')
    ).toBeInTheDocument()
    expect(screen.getByText(/147,700 credits \/ month/)).toBeInTheDocument()
    // Nothing is charged on mount
    expect(mockPerformTeamSubscriptionCheckout).not.toHaveBeenCalled()
  })

  test('checks out the team plan via the workspace path once confirmed', async () => {
    await mountView({ tier: 'team', stop: 'team_700', cycle: 'yearly' })

    await userEvent.click(
      screen.getByRole('button', { name: /confirm & subscribe/i })
    )
    await flushPromises()

    expect(mockPerformTeamSubscriptionCheckout).toHaveBeenCalledWith(
      'team_700',
      'yearly',
      { paymentIntentSource: 'deep_link' }
    )
    // Team never goes through the personal checkout path
    expect(mockPerformSubscriptionCheckout).not.toHaveBeenCalled()
  })

  test('cancelling the team confirmation goes home without charging', async () => {
    await mountView({ tier: 'team', stop: 'team_700', cycle: 'yearly' })

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await flushPromises()

    expect(mockRouterPush).toHaveBeenCalledWith('/')
    expect(mockPerformTeamSubscriptionCheckout).not.toHaveBeenCalled()
  })

  test('redirects to home for a team link with no stop', async () => {
    await mountView({ tier: 'team', cycle: 'yearly' })

    expect(mockRouterPush).toHaveBeenCalledWith('/')
    expect(mockPerformTeamSubscriptionCheckout).not.toHaveBeenCalled()
  })
})
