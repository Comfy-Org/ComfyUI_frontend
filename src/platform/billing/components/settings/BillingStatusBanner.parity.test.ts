import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import { BillingBanner } from '@comfyorg/account-ui/billing'
import type { BillingBannerCopy } from '@comfyorg/account-ui/billing'
import type { WorkspaceWithRole } from '@comfyorg/ingest-types'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json'
import type { SubscriptionInfo } from '@/platform/billing/composables/types'
import BillingStatusBanner from '@/platform/billing/components/settings/BillingStatusBanner.vue'

interface Subscription {
  hasFunds: boolean
  isCancelled: boolean
  endDate: string | null
  tier?: SubscriptionInfo['tier']
  scheduledChange?: SubscriptionInfo['scheduledChange']
}

const state = vi.hoisted(() => ({
  canAccessSubscriptionFeatures: true,
  isTeamPlan: true,
  billingStatus: 'paid' as string | null,
  subscriptionStatus: 'active' as string | null,
  subscription: null as Subscription | null,
  workspaceType: 'team' as WorkspaceWithRole['type'],
  canManageSubscription: true
}))

vi.mock<unknown>(
  import('@/platform/billing/composables/useBillingRouting'),
  () => ({
    useBillingRouting: () => ({
      shouldUseWorkspaceBilling: computed(() => true)
    })
  })
)
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock<unknown>(
  import('@/platform/billing/composables/useBillingContext'),
  () => ({
    useBillingContext: () => ({
      canAccessSubscriptionFeatures: computed(
        () => state.canAccessSubscriptionFeatures
      ),
      isTeamPlan: computed(() => state.isTeamPlan),
      billingStatus: computed(() => state.billingStatus),
      subscriptionStatus: computed(() => state.subscriptionStatus),
      subscription: computed(() => state.subscription),
      plans: computed(() => [
        { slug: 'pro-annual', tier: 'PRO', duration: 'ANNUAL' }
      ]),
      renewalDate: computed(() => '2026-12-15T00:00:00Z'),
      nextCreditRefillAt: computed(() => null),
      manageSubscription: vi.fn(),
      fetchStatus: vi.fn(),
      fetchBalance: vi.fn()
    })
  })
)
vi.mock<unknown>(import('@/platform/billing/composables/useBillingUI'), () => ({
  useBillingUI: () => ({
    permissions: computed(() => ({
      canManageSubscription: state.canManageSubscription,
      canManageSubscriptionLifecycle: state.canManageSubscription
    })),
    workspaceType: computed(() => state.workspaceType),
    canReactivatePlan: computed(() => true)
  })
}))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/composables/useResubscribe'), () => ({
  useResubscribe: () => ({
    isResubscribing: computed(() => false),
    handleResubscribe: vi.fn()
  })
}))
vi.mock(import('@/platform/billing/composables/useBillingDialogs'))
vi.mock<unknown>(
  import('@/platform/billing/subscription/composables/useSubscriptionDialog'),
  () => ({ useSubscriptionDialog: () => ({ show: vi.fn() }) })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})
const t = i18n.global.t
const bs = 'workspacePanel.billingStatus'

const copy: Pick<BillingBannerCopy, 'dismiss' | 'actions'> = {
  dismiss: t(`${bs}.outOfCredits.dismiss`),
  actions: {
    addCredits: t(`${bs}.outOfCredits.addCredits`),
    updatePayment: t(`${bs}.updatePayment`),
    verifyPayment: t(`${bs}.planCheckout.verifyPayment.action`),
    contactSupport: t(`${bs}.parked.contactSupport`),
    resumePlan: t(`${bs}.ending.reactivate`),
    choosePlan: t('workspacePanel.billingTab.plan.actions.choosePlan'),
    contactSales: t(`${bs}.ending.contactSales`)
  }
}

const ENDS = '2026-10-28T00:00:00Z'
const ENDED = '2026-09-12T12:00:00Z'

function ending(tier?: SubscriptionInfo['tier']) {
  state.subscription = {
    hasFunds: true,
    isCancelled: true,
    endDate: ENDS,
    scheduledChange: null,
    tier
  }
}

function ended() {
  state.subscriptionStatus = 'ended'
  state.billingStatus = 'inactive'
  state.canAccessSubscriptionFeatures = false
  state.subscription = {
    hasFunds: false,
    isCancelled: true,
    endDate: ENDED,
    scheduledChange: null,
    tier: 'PRO'
  }
}

function personal() {
  state.isTeamPlan = false
  state.workspaceType = 'personal'
}

function member() {
  state.canManageSubscription = false
}

function readBanner() {
  const status = screen.queryByRole('status')
  if (!status) return null
  return {
    text: status.textContent.replace(/\s+/g, ''),
    controls: [
      ...within(status).queryAllByRole('button'),
      ...within(status).queryAllByRole('link')
    ].map((control) => control.textContent.trim())
  }
}

describe('BillingBanner parity with the Billing tab plan status banner', () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlags().flags).billingControlEnabled = true
    vi.mocked(useFeatureFlags().flags).v1PaymentRecovery = true
    state.canAccessSubscriptionFeatures = true
    state.isTeamPlan = true
    state.billingStatus = 'paid'
    state.subscriptionStatus = 'active'
    state.subscription = {
      hasFunds: true,
      isCancelled: false,
      endDate: null,
      scheduledChange: null
    }
    state.workspaceType = 'team'
    state.canManageSubscription = true
  })

  it.for<{
    case: string
    enter: () => void
    title: () => string
    body: () => string
    action?: 'resumePlan' | 'choosePlan' | 'contactSales'
  }>([
    {
      case: 'a team plan ending',
      enter: () => ending(),
      title: () => t(`${bs}.ending.title`, { date: 'October 28, 2026' }),
      body: () => t(`${bs}.ending.body`),
      action: 'resumePlan'
    },
    {
      case: 'a team plan ending, for a member',
      enter: () => {
        ending()
        member()
      },
      title: () => t(`${bs}.ending.title`, { date: 'October 28, 2026' }),
      body: () => t(`${bs}.ending.memberBody`)
    },
    {
      case: 'a personal Pro plan ending',
      enter: () => {
        personal()
        ending('PRO')
      },
      title: () =>
        t(`${bs}.ending.personalTitle`, {
          plan: 'Pro',
          date: 'October 28, 2026'
        }),
      body: () => t(`${bs}.ending.personalBody`),
      action: 'resumePlan'
    },
    {
      case: 'an Enterprise plan ending inside the notice window',
      enter: () => {
        vi.setSystemTime(new Date('2026-10-20T00:00:00Z'))
        state.isTeamPlan = false
        ending('ENTERPRISE')
      },
      title: () =>
        t(`${bs}.ending.enterpriseTitle`, { date: 'October 28, 2026' }),
      body: () => t(`${bs}.ending.enterpriseBody`),
      action: 'contactSales'
    },
    {
      case: 'a scheduled plan change',
      enter: () => {
        state.subscription = {
          hasFunds: true,
          isCancelled: false,
          endDate: null,
          scheduledChange: {
            plan_slug: 'pro-annual',
            effective_at: '2026-10-01T00:00:00Z',
            team_credit_stop: null
          }
        }
      },
      title: () =>
        t(`${bs}.planChange.title`, { plan: 'Pro', date: 'October 1, 2026' }),
      body: () => t(`${bs}.planChange.body`)
    },
    {
      case: 'a team plan ended',
      enter: ended,
      title: () =>
        t(`${bs}.planEnded.teamTitle`, { date: 'September 12, 2026' }),
      body: () => t(`${bs}.planEnded.teamBody`)
    },
    {
      case: 'a team plan ended, for a member',
      enter: () => {
        ended()
        member()
      },
      title: () =>
        t(`${bs}.planEnded.teamTitle`, { date: 'September 12, 2026' }),
      body: () => t(`${bs}.planEnded.teamMemberBody`)
    },
    {
      case: 'a personal plan ended',
      enter: () => {
        personal()
        ended()
      },
      title: () =>
        t(`${bs}.planEnded.personalTitle`, {
          plan: 'Pro',
          date: 'September 12, 2026'
        }),
      body: () => t(`${bs}.planEnded.personalBody`)
    }
  ])('renders $case the same', ({ enter, title, body, action = null }) => {
    enter()
    const app = render(BillingStatusBanner, {
      props: { section: 'billing' },
      global: { plugins: [i18n] }
    })
    const appBanner = readBanner()
    app.unmount()

    const pkg = render(BillingBanner, {
      props: {
        view: {
          kind: 'planStatus',
          title: title(),
          body: body(),
          action,
          href: null
        },
        copy
      }
    })
    const packageBanner = readBanner()
    pkg.unmount()

    expect(appBanner).not.toBeNull()
    expect(packageBanner).toEqual(appBanner)
  })
})
