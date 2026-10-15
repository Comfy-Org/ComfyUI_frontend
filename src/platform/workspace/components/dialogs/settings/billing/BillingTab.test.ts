import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { SubscriptionInfo } from '@/composables/billing/types'
import { useFreeTierQuota } from '@/platform/cloud/subscription/composables/useFreeTierQuota'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

import BillingTab from './BillingTab.vue'

vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))
vi.mock(import('@/platform/cloud/subscription/composables/useFreeTierQuota'))
vi.mock<unknown>(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string) => `https://platform.test${path}?workspace=ws_1`
}))

const activeSubscription: SubscriptionInfo = {
  isActive: true,
  tier: 'PRO',
  duration: 'MONTHLY',
  planSlug: 'pro-monthly',
  scheduledChange: null,
  renewalDate: '2026-11-15T00:00:00Z',
  endDate: null,
  isCancelled: false,
  hasFunds: true,
  agentHasFunds: true
}

interface Scenario {
  subscription?: SubscriptionInfo | null
  subscriptionStatus?: 'active' | 'canceled' | 'ended' | null
  isInitialized?: boolean
  error?: string | null
  role?: 'owner' | 'member'
  canSubscribeSelfServe?: boolean
  capabilitiesReady?: boolean
  capabilitiesResolved?: boolean
}

function arrange(scenario: Scenario = {}) {
  const initialize = vi.fn(async () => {})
  const refresh = vi.fn(async () => {})

  vi.mocked(useBillingContext).mockReturnValue(
    fromPartial({
      isInitialized: ref(scenario.isInitialized ?? true),
      isLoading: ref(false),
      error: ref(scenario.error ?? null),
      subscription: computed(() =>
        scenario.subscription === undefined
          ? activeSubscription
          : scenario.subscription
      ),
      subscriptionStatus: computed(() =>
        scenario.subscriptionStatus === undefined
          ? 'active'
          : scenario.subscriptionStatus
      ),
      billingStatus: computed(() => 'paid'),
      isTeamPlan: computed(() => false),
      plans: computed(() => []),
      initialize
    })
  )
  vi.mocked(useBillingCapabilities).mockReturnValue(
    fromPartial({
      canSubscribeSelfServe: computed(
        () => scenario.canSubscribeSelfServe ?? true
      ),
      isReady: computed(() => scenario.capabilitiesReady ?? true),
      hasResolvedCapabilities: computed(
        () => scenario.capabilitiesResolved ?? true
      ),
      initialize: vi.fn(async () => {}),
      refresh
    })
  )
  vi.mocked(useWorkspaceUI).mockReturnValue(
    fromPartial({ workspaceRole: computed(() => scenario.role ?? 'owner') })
  )
  vi.mocked(useFreeTierQuota).mockReturnValue(
    fromPartial({
      quotaEnabled: computed(() => false),
      available: ref(0),
      maxAvailable: ref(0)
    })
  )

  render(BillingTab, {
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  })

  return { initialize, refresh }
}

describe('BillingTab', () => {
  it('shows a skeleton and no plan row while billing loads', () => {
    arrange({ isInitialized: false })

    expect(screen.getByTestId('billing-plan-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('billing-plan-row')).not.toBeInTheDocument()
  })

  it('replaces the plan with one error that retries both reads', async () => {
    const { initialize, refresh } = arrange({ error: 'boom' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't load your plan."
    )
    expect(screen.queryByTestId('billing-plan-row')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(initialize).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it('shows the error when capabilities settle without a snapshot', () => {
    arrange({ capabilitiesResolved: false })

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders an active plan with Manage and the owner handoff linked to the billing site', () => {
    arrange()

    expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument()
    expect(screen.getByTestId('billing-plan-line')).toHaveTextContent(
      'Billed monthly. Next invoice November 15.'
    )
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      'https://platform.test/profile/plans?workspace=ws_1'
    )
    expect(screen.getByRole('link', { name: 'Open billing' })).toHaveAttribute(
      'href',
      'https://platform.test/profile/billing?workspace=ws_1'
    )
  })

  it('hides the plan action when the server does not grant it', () => {
    arrange({ canSubscribeSelfServe: false })

    expect(
      screen.queryByRole('link', { name: 'Manage' })
    ).not.toBeInTheDocument()
  })

  it('gives a member usage instead of billing and no plan action', () => {
    arrange({ role: 'member', canSubscribeSelfServe: false })

    expect(screen.getByTestId('billing-plan-line')).toHaveTextContent(
      'Managed by the workspace owner.'
    )
    expect(screen.getByRole('link', { name: 'View usage' })).toHaveAttribute(
      'href',
      'https://platform.test/profile/usage?workspace=ws_1'
    )
    expect(
      screen.queryByRole('link', { name: 'Open billing' })
    ).not.toBeInTheDocument()
  })

  it('renders an unrecognised plan as Your plan', () => {
    arrange({ subscription: { ...activeSubscription, tier: null } })

    expect(
      screen.getByRole('heading', { name: 'Your plan' })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('billing-plan-line')).not.toBeInTheDocument()
  })
})
