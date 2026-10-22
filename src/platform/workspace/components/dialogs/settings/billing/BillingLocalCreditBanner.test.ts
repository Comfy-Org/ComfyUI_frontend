import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { BalanceInfo, SubscriptionInfo } from '@/composables/billing/types'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingDialogs } from '@/composables/billing/useBillingDialogs'
import type { AutoReloadSettings } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTelemetry } from '@/platform/telemetry'
import { usePausedBanner } from '@/platform/workspace/composables/usePausedBanner'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import { canManageBillingFact } from '@/platform/workspace/composables/__mocks__/useBillingCapabilities'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

import BillingLocalCreditBanner from './BillingLocalCreditBanner.vue'

const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))
vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/workspace/composables/usePausedBanner'))
vi.mock<unknown>(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string, correlationId?: string) =>
    `https://platform.test${path}?correlation_id=${correlationId}`
}))
vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/composables/billing/useBillingDialogs'))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

const personalSubscription: SubscriptionInfo = {
  isActive: true,
  tier: 'PRO',
  duration: 'MONTHLY',
  planSlug: 'pro-monthly',
  scheduledChange: null,
  renewalDate: null,
  endDate: null,
  isCancelled: false,
  hasFunds: true,
  agentHasFunds: true
}

function arrange(options: {
  isCloud?: boolean
  unified?: boolean
  isTeamPlan?: boolean
  subscription?: SubscriptionInfo
  balance?: BalanceInfo | null
  renewalDate?: string | null
  canTopUp?: boolean
  topUpDenial?: string
  canManageBilling?: boolean
  canManageSubscription?: boolean
  canAccessSubscriptionFeatures?: boolean
  isPaused?: boolean
  autoTopUpEnabled?: boolean
  canManageAutoTopUp?: boolean
  autoReload?: Pick<AutoReloadSettings, 'status' | 'disabled_reason'>
}) {
  vi.mocked(usePausedBanner).mockReturnValue({
    isPaused: computed(() => options.isPaused ?? false)
  })
  vi.mocked(useFeatureFlags().flags).autoTopUpEnabled =
    options.autoTopUpEnabled ?? true
  useBillingCapabilities().canManageAutoTopUp = computed(() =>
    receiveServerFact(
      'can_manage_auto_top_up',
      options.canManageAutoTopUp ?? true
    )
  )
  vi.mocked(workspaceApi.getBillingAutoReload).mockResolvedValue(
    fromPartial({
      status: 'on',
      disabled_reason: null,
      ...options.autoReload
    })
  )
  distribution.isCloud = options.isCloud ?? false
  vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled =
    options.unified ?? true
  const subscription = ref(options.subscription ?? personalSubscription)
  const balance = ref<BalanceInfo | null>(options.balance ?? null)
  vi.mocked(useBillingContext).mockReturnValue(
    fromPartial({
      subscription: computed(() => subscription.value),
      balance: computed(() => balance.value),
      isTeamPlan: computed(() => options.isTeamPlan ?? false),
      renewalDate: computed(() => options.renewalDate ?? null),
      billingStatus: computed(() => 'paid' as const),
      canAccessSubscriptionFeatures: computed(
        () => options.canAccessSubscriptionFeatures ?? true
      )
    })
  )
  useBillingCapabilities().canTopUp = computed(() => options.canTopUp ?? true)
  useBillingCapabilities().topUpDenial = computed(() => options.topUpDenial)
  useBillingCapabilities().canManageBilling = canManageBillingFact(
    options.canManageBilling ?? true
  )
  const workspace = useWorkspaceUI()
  const permissions = workspace.permissions.value
  workspace.permissions = computed(() => ({
    ...permissions,
    canManageSubscription: options.canManageSubscription ?? true
  }))

  render(BillingLocalCreditBanner, {
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

  return { subscription, balance }
}

describe('BillingLocalCreditBanner', () => {
  it('renders nothing off the unified billing flag', () => {
    arrange({
      unified: false,
      subscription: { ...personalSubscription, hasFunds: false }
    })

    expect(
      screen.queryByTestId('billing-local-credit-banner')
    ).not.toBeInTheDocument()
  })

  it('renders nothing on cloud', () => {
    arrange({
      isCloud: true,
      subscription: {
        ...personalSubscription,
        hasFunds: false,
        isCancelled: true,
        endDate: '2026-08-01T00:00:00Z'
      },
      balance: { amountMicros: 500, currency: 'usd', lowBalance: true }
    })

    expect(
      screen.queryByTestId('billing-local-credit-banner')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Subscription paused')).not.toBeInTheDocument()
  })

  it.for([
    {
      name: 'a personal owner',
      isTeamPlan: false,
      renewalDate: '2026-10-01T00:00:00Z',
      body: "You've used all your credits. Add more credits or wait until credits refill on October 1, 2026.",
      buttons: ['Dismiss', 'Add credits']
    },
    {
      name: 'a team owner without a refill date',
      isTeamPlan: true,
      renewalDate: null,
      body: 'Your team has used all its credits. Add more credits.',
      buttons: ['Dismiss', 'Add credits']
    },
    {
      name: 'a team member',
      isTeamPlan: true,
      canManageSubscription: false,
      renewalDate: '2026-10-01T00:00:00Z',
      body: 'Your team has used all its credits. Ask your workspace owner to add more credits or wait until credits refill on October 1, 2026.',
      buttons: ['Dismiss']
    }
  ])(
    'shows out of credits to $name',
    ({ isTeamPlan, renewalDate, canManageSubscription, body, buttons }) => {
      arrange({
        isTeamPlan,
        renewalDate,
        canManageSubscription,
        subscription: { ...personalSubscription, hasFunds: false }
      })

      const banner = screen.getByTestId('billing-local-credit-banner')
      expect(banner).toHaveTextContent('Out of credits')
      expect(banner).toHaveTextContent(body)
      expect(
        screen.getAllByRole('button').map((button) => button.textContent.trim())
      ).toEqual(buttons)
    }
  )

  it('opens the top-up dialog from Add credits when out of credits', async () => {
    arrange({ subscription: { ...personalSubscription, hasFunds: false } })

    await userEvent.click(screen.getByRole('button', { name: 'Add credits' }))

    expect(useBillingDialogs().showTopUpCreditsDialog).toHaveBeenCalled()
  })

  it.for([
    {
      name: 'a personal owner',
      isTeamPlan: false,
      canManageBilling: true,
      body: "You've used all your credits. Update your payment method to add more.",
      buttons: ['Dismiss', 'Update payment']
    },
    {
      name: 'a team owner',
      isTeamPlan: true,
      canManageBilling: true,
      body: 'Your team has used all its credits. Update your payment method to add more.',
      buttons: ['Dismiss', 'Update payment']
    },
    {
      name: 'a team member',
      isTeamPlan: true,
      canManageBilling: false,
      body: 'Your team has used all its credits. Ask your workspace owner to update the payment method.',
      buttons: ['Dismiss']
    }
  ])(
    'uses the past-due out-of-credits copy for $name',
    ({ isTeamPlan, canManageBilling, body, buttons }) => {
      arrange({
        isTeamPlan,
        canManageBilling,
        topUpDenial: 'payment_past_due',
        canTopUp: false,
        subscription: { ...personalSubscription, hasFunds: false }
      })

      const banner = screen.getByTestId('billing-local-credit-banner')
      expect(banner).toHaveTextContent(body)
      expect(
        screen.getAllByRole('button').map((button) => button.textContent.trim())
      ).toEqual(buttons)
      expect(banner).not.toHaveTextContent('credits refill')
    }
  )

  it('shows low credits from the served low_balance flag', () => {
    arrange({
      balance: { amountMicros: 500, currency: 'usd', lowBalance: true }
    })

    const banner = screen.getByTestId('billing-local-credit-banner')
    expect(banner).toHaveTextContent('Credits are low')
    expect(banner).toHaveTextContent(
      'You have 1,055 credits left. Add credits to keep running Partner Nodes.'
    )
    expect(
      screen.getByRole('button', { name: 'Add credits' })
    ).toBeInTheDocument()
  })

  it('skips low credits when the balance response omits low_balance', () => {
    arrange({
      balance: { amountMicros: 500, currency: 'usd' }
    })

    expect(
      screen.queryByTestId('billing-local-credit-banner')
    ).not.toBeInTheDocument()
  })

  it('hides the out-of-credits banner that was visible without showing low credits', async () => {
    arrange({
      topUpDenial: 'payment_past_due',
      canTopUp: false,
      subscription: { ...personalSubscription, hasFunds: false },
      balance: { amountMicros: 500, currency: 'usd', lowBalance: true }
    })

    expect(screen.getByTestId('billing-local-credit-banner')).toHaveTextContent(
      'Out of credits'
    )

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByText('Credits are low')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('billing-local-credit-banner')
    ).not.toBeInTheDocument()
  })

  it('keeps out of credits ahead of low credits and plan copy', () => {
    arrange({
      subscription: {
        ...personalSubscription,
        hasFunds: false,
        isCancelled: true,
        endDate: '2026-08-01T00:00:00Z'
      },
      balance: { amountMicros: 500, currency: 'usd', lowBalance: true }
    })

    const banner = screen.getByTestId('billing-local-credit-banner')
    expect(banner).toHaveTextContent('Out of credits')
    expect(banner).not.toHaveTextContent('Credits are low')
    expect(banner).not.toHaveTextContent('Subscription paused')
    expect(banner).not.toHaveTextContent('plan ends')
    expect(banner).not.toHaveTextContent('plan ended')
  })

  it('shows nothing for a paused or ending plan that still has credits', () => {
    arrange({
      subscription: {
        ...personalSubscription,
        hasFunds: true,
        isCancelled: true,
        endDate: '2026-08-01T00:00:00Z'
      }
    })

    expect(
      screen.queryByTestId('billing-local-credit-banner')
    ).not.toBeInTheDocument()
  })

  it('brings out of credits back after credits return and run out again', async () => {
    const { subscription } = arrange({
      subscription: { ...personalSubscription, hasFunds: false }
    })

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(
      screen.queryByTestId('billing-local-credit-banner')
    ).not.toBeInTheDocument()

    subscription.value = { ...personalSubscription, hasFunds: true }
    await nextTick()
    subscription.value = { ...personalSubscription, hasFunds: false }
    await nextTick()

    expect(screen.getByTestId('billing-local-credit-banner')).toHaveTextContent(
      'Out of credits'
    )
  })

  describe('auto top-up banners', () => {
    const FAILED_BODY =
      "Your last automatic top-up didn't go through. Update your payment method to keep it running."
    const OFF_BODY =
      'Auto top-up turned off after 3 declined charges. Update your payment method, then turn it back on.'

    it.for([
      {
        name: 'failed on local',
        autoReload: { status: 'failed' as const, disabled_reason: null },
        title: 'Auto top-up failed',
        body: FAILED_BODY
      },
      {
        name: 'turned off on local',
        autoReload: {
          status: 'failed' as const,
          disabled_reason: 'consecutive_declines'
        },
        title: 'Auto top-up turned off',
        body: OFF_BODY
      },
      {
        name: 'failed on cloud',
        isCloud: true,
        autoReload: { status: 'failed' as const, disabled_reason: null },
        title: 'Auto top-up failed',
        body: FAILED_BODY
      },
      {
        name: 'turned off on cloud',
        isCloud: true,
        autoReload: {
          status: 'failed' as const,
          disabled_reason: 'consecutive_declines'
        },
        title: 'Auto top-up turned off',
        body: OFF_BODY
      }
    ])('shows $name with its copy and Update payment', async (row) => {
      arrange({ isCloud: row.isCloud, autoReload: row.autoReload })

      const banner = await screen.findByTestId('billing-local-credit-banner')
      expect(banner).toHaveTextContent(row.title)
      expect(banner).toHaveTextContent(row.body)
      expect(
        screen.getAllByRole('link').map((link) => link.textContent.trim())
      ).toEqual(['Update payment'])
      expect(
        screen.queryByRole('button', { name: 'Dismiss' })
      ).not.toBeInTheDocument()
    })

    it.for([
      { name: 'a member', canManageAutoTopUp: false },
      { name: 'the flag off', autoTopUpEnabled: false },
      { name: 'cloud without an active plan', isCloud: true, canAccess: false },
      { name: 'a paused workspace', isCloud: true, isPaused: true }
    ])('shows nothing for $name', async (row) => {
      arrange({
        isCloud: row.isCloud,
        canManageAutoTopUp: row.canManageAutoTopUp,
        autoTopUpEnabled: row.autoTopUpEnabled,
        canAccessSubscriptionFeatures: row.canAccess,
        isPaused: row.isPaused,
        autoReload: { status: 'failed', disabled_reason: null }
      })
      await nextTick()
      await nextTick()

      expect(
        screen.queryByTestId('billing-local-credit-banner')
      ).not.toBeInTheDocument()
    })

    it.for(['on_hold', 'paused_by_budget', 'on', 'off'] as const)(
      'shows nothing for status %s',
      async (status) => {
        arrange({ autoReload: { status, disabled_reason: null } })
        await nextTick()
        await nextTick()

        expect(
          screen.queryByTestId('billing-local-credit-banner')
        ).not.toBeInTheDocument()
      }
    )

    it('ranks out of credits above and low credits below on local', async () => {
      arrange({
        subscription: { ...personalSubscription, hasFunds: false },
        balance: { amountMicros: 500, currency: 'usd', lowBalance: true },
        autoReload: { status: 'failed', disabled_reason: null }
      })
      await nextTick()
      await nextTick()

      expect(
        screen.getByTestId('billing-local-credit-banner')
      ).toHaveTextContent('Out of credits')

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

      const banner = screen.getByTestId('billing-local-credit-banner')
      expect(banner).toHaveTextContent('Auto top-up failed')
      expect(banner).not.toHaveTextContent('Credits are low')
    })

    it('hands off to the platform billing page with auto top-up telemetry', async () => {
      arrange({ autoReload: { status: 'failed', disabled_reason: null } })
      const link = await screen.findByRole('link', { name: 'Update payment' })
      link.addEventListener('click', (event) => event.preventDefault())

      await userEvent.click(link)

      expect(link.getAttribute('href')).toMatch(
        /^https:\/\/platform\.test\/profile\/billing\?correlation_id=/
      )
      expect(vi.mocked(useTelemetry)()?.trackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'platform_handoff',
          stage: 'opened',
          target: 'auto_top_up',
          action: 'update_payment'
        })
      )
    })
  })
})
