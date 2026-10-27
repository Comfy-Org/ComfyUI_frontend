import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type {
  BalanceInfo,
  SubscriptionInfo
} from '@/platform/billing/composables/types'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json'
import { canManageBillingFact } from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePlatformHandoff } from '@/platform/workspace/composables/usePlatformHandoff'
import { useAutoTopUpBannerKind } from '@/platform/billing/composables/useAutoTopUpBannerKind'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

import BillingLocalCreditBanner from './BillingLocalCreditBanner.vue'

const track = vi.fn()
const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))
vi.mock(import('@/platform/billing/composables/useAutoTopUpBannerKind'))
vi.mock(import('@/platform/workspace/composables/usePlatformHandoff'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/useBillingDialogs'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
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
  autoTopUp?: 'autoTopUpFailed' | 'autoTopUpOff'
}) {
  vi.mocked(usePlatformHandoff).mockReturnValue({
    href: computed(() => 'https://platform.test/profile/billing'),
    track
  })
  vi.mocked(useAutoTopUpBannerKind).mockReturnValue(
    computed(() => options.autoTopUp ?? null)
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
      billingStatus: computed(() => 'paid' as const)
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

  it('renders nothing on cloud without an active plan', () => {
    arrange({
      isCloud: true,
      subscription: {
        ...personalSubscription,
        isActive: false,
        hasFunds: false
      },
      balance: { amountMicros: 500, currency: 'usd', lowBalance: true }
    })

    expect(
      screen.queryByTestId('billing-local-credit-banner')
    ).not.toBeInTheDocument()
  })

  it('shows out of credits on an active cloud plan', () => {
    arrange({
      isCloud: true,
      subscription: { ...personalSubscription, hasFunds: false },
      renewalDate: '2026-10-01T00:00:00Z'
    })

    expect(screen.getByTestId('billing-local-credit-banner')).toHaveTextContent(
      'Out of credits'
    )
  })

  it('shows low credits on an active cloud plan', () => {
    arrange({
      isCloud: true,
      balance: { amountMicros: 500, currency: 'usd', lowBalance: true }
    })

    expect(screen.getByTestId('billing-local-credit-banner')).toHaveTextContent(
      'Credits are low'
    )
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
      expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass('h-8')
      expect(screen.getByRole('status')).toHaveClass('rounded-xl', 'p-3')
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

  it.for([
    { isCloud: false, kind: 'autoTopUpFailed', title: 'Auto top-up failed' },
    { isCloud: false, kind: 'autoTopUpOff', title: 'Auto top-up turned off' },
    { isCloud: true, kind: 'autoTopUpFailed', title: 'Auto top-up failed' },
    { isCloud: true, kind: 'autoTopUpOff', title: 'Auto top-up turned off' }
  ] as const)('shows $kind on cloud=$isCloud', ({ isCloud, kind, title }) => {
    arrange({ isCloud, autoTopUp: kind })

    expect(screen.getByTestId('billing-auto-top-up-banner')).toHaveTextContent(
      title
    )
  })

  it('ranks auto top-up above out of credits and low credits', () => {
    arrange({
      autoTopUp: 'autoTopUpFailed',
      subscription: { ...personalSubscription, hasFunds: false },
      balance: { amountMicros: 500, currency: 'usd', lowBalance: true }
    })

    expect(screen.getByTestId('billing-auto-top-up-banner')).toBeInTheDocument()
    expect(
      screen.queryByTestId('billing-local-credit-banner')
    ).not.toBeInTheDocument()
  })

  it('shows no auto top-up banner off the unified billing flag on local', () => {
    arrange({ unified: false, autoTopUp: 'autoTopUpFailed' })

    expect(
      screen.queryByTestId('billing-auto-top-up-banner')
    ).not.toBeInTheDocument()
  })

  it('hands off the Update payment link to the platform billing page', async () => {
    arrange({ autoTopUp: 'autoTopUpFailed' })
    const link = screen.getByRole('link', { name: 'Update payment' })
    link.addEventListener('click', (event) => event.preventDefault())

    await userEvent.click(link)

    expect(link).toHaveAttribute(
      'href',
      'https://platform.test/profile/billing'
    )
    expect(usePlatformHandoff).toHaveBeenCalledWith('/profile/billing', {
      target: 'auto_top_up',
      action: 'update_payment'
    })
    expect(track).toHaveBeenCalled()
  })
})
