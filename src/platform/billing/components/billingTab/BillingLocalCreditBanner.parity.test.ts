import type { BillingTopUpDenial } from '@comfyorg/billing-core'
import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import { BillingBanner } from '@comfyorg/account-ui/billing'
import type {
  BillingBannerCopy,
  BillingBannerView
} from '@comfyorg/account-ui/billing'

import {
  centsToCredits,
  formatCreditsFromCents
} from '@/base/credits/comfyCredits'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json'
import type {
  BalanceInfo,
  SubscriptionInfo
} from '@/platform/billing/composables/types'
import { canManageBillingFact } from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useAutoTopUpBannerKind } from '@/platform/billing/composables/useAutoTopUpBannerKind'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { useBillingUI } from '@/platform/billing/composables/useBillingUI'
import { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'

import BillingLocalCreditBanner from './BillingLocalCreditBanner.vue'

const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))
vi.mock(import('@/platform/billing/composables/useAutoTopUpBannerKind'))
vi.mock(import('@/platform/billing/composables/usePlatformHandoff'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/useBillingDialogs'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/composables/useBillingUI'))
vi.mock(import('@/platform/billing/composables/usePaymentRecoveryDialog'), {
  spy: true
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})
const t = i18n.global.t
const bs = 'workspacePanel.billingStatus'
const HANDOFF_URL = 'https://platform.test/profile/billing'
const LOW_BALANCE_CENTS = 500

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

const subscription: SubscriptionInfo = {
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

interface Scenario {
  isCloud?: boolean
  isTeamPlan?: boolean
  outOfCredits?: boolean
  lowBalance?: boolean
  nextCreditRefillAt?: string | null
  canTopUp?: boolean
  topUpDenial?: BillingTopUpDenial
  canManageBilling?: boolean
  autoTopUp?: 'autoTopUpFailed' | 'autoTopUpOff'
  workspaceType?: 'personal' | 'team'
}

const track = vi.fn()
const updatePayment = vi.fn(async () => ({ ok: true as const }))

function arrangeApp(scenario: Scenario) {
  vi.mocked(usePlatformHandoff).mockReturnValue({
    href: computed(() => HANDOFF_URL),
    track
  })
  vi.mocked(useAutoTopUpBannerKind).mockReturnValue(
    computed(() => scenario.autoTopUp ?? null)
  )
  vi.mocked(usePaymentRecoveryDialog).mockReturnValue(
    fromPartial({ updatePayment, isUpdatingPayment: computed(() => false) })
  )
  distribution.isCloud = scenario.isCloud ?? false
  vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
  const balance = ref<BalanceInfo | null>(
    scenario.lowBalance
      ? { amountMicros: LOW_BALANCE_CENTS, currency: 'usd', lowBalance: true }
      : null
  )
  vi.mocked(useBillingContext).mockReturnValue(
    fromPartial({
      subscription: computed(() => ({
        ...subscription,
        hasFunds: !scenario.outOfCredits
      })),
      balance: computed(() => balance.value),
      isTeamPlan: computed(() => scenario.isTeamPlan ?? false),
      nextCreditRefillAt: computed(() => scenario.nextCreditRefillAt ?? null),
      billingStatus: computed(() => 'paid' as const)
    })
  )
  useBillingCapabilities().canTopUp = computed(() => scenario.canTopUp ?? true)
  useBillingCapabilities().topUpDenial = computed(() => scenario.topUpDenial)
  useBillingCapabilities().canManageBilling = canManageBillingFact(
    scenario.canManageBilling ?? true
  )
  useBillingUI().workspaceType = computed(
    () => scenario.workspaceType ?? 'personal'
  )
  return render(BillingLocalCreditBanner, { global: { plugins: [i18n] } })
}

function lowCreditsBody(key: string) {
  return t(
    `${bs}.lowCredits.${key}`,
    {
      credits: formatCreditsFromCents({
        cents: LOW_BALANCE_CENTS,
        locale: 'en',
        numberOptions: { minimumFractionDigits: 0, maximumFractionDigits: 0 }
      })
    },
    centsToCredits(LOW_BALANCE_CENTS)
  )
}

function outOfCredits(
  body: string,
  action: 'addCredits' | 'updatePayment' | null
): BillingBannerView {
  return {
    kind: 'credit',
    title: t(`${bs}.outOfCredits.title`),
    body,
    action,
    dismissKey: 'outOfCredits'
  }
}

function lowCredits(
  bodyKey: string,
  action: 'addCredits' | null
): BillingBannerView {
  return {
    kind: 'credit',
    title: t(`${bs}.lowCredits.title`),
    body: lowCreditsBody(bodyKey),
    action,
    dismissKey: 'lowCredits'
  }
}

function autoTopUp(
  kind: 'autoTopUpFailed' | 'autoTopUpOff'
): BillingBannerView {
  return {
    kind: 'autoTopUp',
    title: t(`${bs}.${kind}.title`),
    body: t(`${bs}.${kind}.body`),
    action: 'updatePayment',
    href: HANDOFF_URL
  }
}

function readBanner() {
  const status = screen.queryByRole('status')
  if (!status) return null
  const controls = [
    ...within(status).queryAllByRole('button'),
    ...within(status).queryAllByRole('link')
  ]
  return {
    text: status.textContent.replace(/\s+/g, ''),
    controls: controls.map(
      (control) => `${control.tagName}:${control.textContent.trim()}`
    ),
    hrefs: controls.map((control) => control.getAttribute('href'))
  }
}

async function clickAction(view: BillingBannerView) {
  if (!('action' in view) || !view.action) return
  const control = within(screen.getByRole('status')).getByText(
    copy.actions[view.action]
  )
  control.addEventListener('click', (event) => event.preventDefault())
  await userEvent.click(control)
}

async function clickDismiss() {
  const dismiss = screen.queryByRole('button', { name: copy.dismiss })
  if (dismiss) await userEvent.click(dismiss)
}

function appOutcome() {
  return {
    addCredits: vi.mocked(useBillingDialogs().showTopUpCreditsDialog).mock.calls
      .length,
    updatePayment: updatePayment.mock.calls.length + track.mock.calls.length
  }
}

const DATE = '2026-10-01T00:00:00Z'
const LONG_DATE = 'October 1, 2026'

describe('BillingBanner parity with the local credit banner', () => {
  it.for<{ case: string; scenario: Scenario; view: () => BillingBannerView }>([
    {
      case: 'out of credits, personal owner with a refill date',
      scenario: { outOfCredits: true, nextCreditRefillAt: DATE },
      view: () =>
        outOfCredits(
          t(`${bs}.outOfCredits.personalBody`, { date: LONG_DATE }),
          'addCredits'
        )
    },
    {
      case: 'out of credits, team owner without a refill date',
      scenario: { outOfCredits: true, isTeamPlan: true },
      view: () => outOfCredits(t(`${bs}.outOfCredits.bodyNoDate`), 'addCredits')
    },
    {
      case: 'out of credits, team member',
      scenario: {
        outOfCredits: true,
        isTeamPlan: true,
        canTopUp: false,
        topUpDenial: 'not_workspace_owner',
        nextCreditRefillAt: DATE
      },
      view: () =>
        outOfCredits(
          t(`${bs}.outOfCredits.memberBody`, { date: LONG_DATE }),
          null
        )
    },
    {
      case: 'out of credits, personal purchases paused',
      scenario: {
        outOfCredits: true,
        canTopUp: false,
        topUpDenial: 'topup_purchases_paused'
      },
      view: () =>
        outOfCredits(t(`${bs}.outOfCredits.pausedPersonalBodyNoDate`), null)
    },
    {
      case: 'out of credits, team refused for another reason',
      scenario: {
        outOfCredits: true,
        isTeamPlan: true,
        canTopUp: false,
        topUpDenial: 'creator_only_provisioning'
      },
      view: () => outOfCredits(t(`${bs}.outOfCredits.refusedBody`), null)
    },
    {
      case: 'out of credits, past due team owner',
      scenario: {
        outOfCredits: true,
        isTeamPlan: true,
        canTopUp: false,
        topUpDenial: 'payment_past_due'
      },
      view: () =>
        outOfCredits(t(`${bs}.outOfCredits.pastDueBody`), 'updatePayment')
    },
    {
      case: 'out of credits, past due team member',
      scenario: {
        outOfCredits: true,
        isTeamPlan: true,
        canTopUp: false,
        canManageBilling: false,
        topUpDenial: 'payment_past_due'
      },
      view: () => outOfCredits(t(`${bs}.outOfCredits.pastDueMemberBody`), null)
    },
    {
      case: 'low credits on a personal cloud workspace',
      scenario: { isCloud: true, lowBalance: true },
      view: () => lowCredits('personalBody', 'addCredits')
    },
    {
      case: 'low credits on local',
      scenario: { lowBalance: true },
      view: () => lowCredits('localBody', 'addCredits')
    },
    {
      case: 'low credits for a cloud team member',
      scenario: {
        isCloud: true,
        lowBalance: true,
        workspaceType: 'team',
        canTopUp: false,
        canManageBilling: false
      },
      view: () => lowCredits('memberBody', null)
    },
    {
      case: 'auto top-up failed',
      scenario: { isCloud: true, autoTopUp: 'autoTopUpFailed' },
      view: () => autoTopUp('autoTopUpFailed')
    },
    {
      case: 'auto top-up turned off',
      scenario: { isCloud: true, autoTopUp: 'autoTopUpOff' },
      view: () => autoTopUp('autoTopUpOff')
    }
  ])('renders $case the same', async ({ scenario, view: viewFor }) => {
    const view = viewFor()
    const app = arrangeApp(scenario)
    const appBanner = readBanner()
    await clickAction(view)
    const appActions = appOutcome()
    await clickDismiss()
    const appDismissed = readBanner() === null
    app.unmount()

    const onAction = vi.fn()
    const onDismiss = vi.fn()
    const pkg = render(BillingBanner, {
      props: { view, copy, onAction, onDismiss }
    })
    const packageBanner = readBanner()
    await clickAction(view)
    await clickDismiss()
    pkg.unmount()

    expect(appBanner).not.toBeNull()
    expect(packageBanner).toEqual(appBanner)
    expect({
      addCredits: onAction.mock.calls.filter(([a]) => a === 'addCredits')
        .length,
      updatePayment: onAction.mock.calls.filter(([a]) => a === 'updatePayment')
        .length
    }).toEqual(appActions)
    expect(onDismiss.mock.calls).toEqual(
      appDismissed && 'dismissKey' in view ? [[view.dismissKey]] : []
    )
  })
})
