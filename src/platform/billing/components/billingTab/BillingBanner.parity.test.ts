import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import type {
  PlanCheckoutBanner,
  TopupCheckoutBanner
} from '@comfyorg/account-core/billing'
import {
  BillingBanner,
  planCheckoutBannerView,
  topupCheckoutBannerView
} from '@comfyorg/account-ui/billing'
import type {
  BillingBannerCopy,
  BillingBannerView
} from '@comfyorg/account-ui/billing'

import { formatUsdFromCents } from '@/base/credits/comfyCredits'
import enMessages from '@/locales/en/main.json'
import {
  pausedBannerCopy,
  usePausedBanner
} from '@/platform/billing/composables/usePausedBanner'
import { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'

import BillingParkedBanner from './BillingParkedBanner.vue'
import BillingPausedBanner from './BillingPausedBanner.vue'
import BillingPlanCheckoutBanner from './BillingPlanCheckoutBanner.vue'
import BillingTopupCheckoutBanner from './BillingTopupCheckoutBanner.vue'

vi.mock(import('@/platform/billing/composables/usePausedBanner'), {
  spy: true
})
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
const tc = 'workspacePanel.billingTab.topupCheckout'

function usd(cents: number) {
  return formatUsdFromCents({
    cents,
    locale: 'en',
    numberOptions: {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2
    }
  })
}

const copy: BillingBannerCopy = {
  dismiss: t(`${bs}.planCheckout.dismiss`),
  actions: {
    addCredits: t('workspacePanel.billingTab.credits.addCredits'),
    updatePayment: t(`${bs}.updatePayment`),
    verifyPayment: t(`${bs}.planCheckout.verifyPayment.action`),
    contactSupport: t(`${bs}.parked.contactSupport`)
  },
  planCheckout: {
    verifyPayment: {
      title: t(`${bs}.planCheckout.verifyPayment.title`),
      body: t(`${bs}.planCheckout.verifyPayment.body`)
    },
    paymentReceived: {
      title: t(`${bs}.planCheckout.paymentReceived.title`),
      body: t(`${bs}.planCheckout.paymentReceived.body`)
    }
  },
  topupCheckout: {
    failedTitle: (cents) =>
      cents === null
        ? t(`${tc}.failed.titleNoAmount`)
        : t(`${tc}.failed.title`, { amount: usd(cents) }),
    failedBody: t(`${tc}.failed.body`),
    creditsApplying: {
      title: t(`${tc}.creditsApplying.title`),
      body: t(`${tc}.creditsApplying.body`)
    },
    processing: {
      title: t(`${tc}.processing.title`),
      body: t(`${tc}.processing.body`)
    }
  }
}

interface Rendered {
  text: string
  controls: string[]
  hrefs: (string | null)[]
}

function controlsOf(status: HTMLElement) {
  return [
    ...within(status).queryAllByRole('button'),
    ...within(status).queryAllByRole('link')
  ]
}

function readBanner(): Rendered {
  const status = screen.queryByRole('status')
  if (!status) return { text: '', controls: [], hrefs: [] }
  const controls = controlsOf(status)
  return {
    text: status.textContent.replace(/\s+/g, ''),
    controls: controls.map(
      (control) => `${control.tagName}:${control.textContent.trim()}`
    ),
    hrefs: controls.map((control) => control.getAttribute('href'))
  }
}

async function clickControl(name: string) {
  const control = within(screen.getByRole('status')).getByText(name)
  control.addEventListener('click', (event) => event.preventDefault())
  await userEvent.click(control)
}

function renderPackage(view: BillingBannerView) {
  const onAction = vi.fn()
  const onDismiss = vi.fn()
  const rendered = render(BillingBanner, {
    props: { view, copy, onAction, onDismiss }
  })
  return { rendered, onAction, onDismiss }
}

describe('BillingBanner parity with the plan checkout banner', () => {
  it.for<{ banner: PlanCheckoutBanner; control: string | null }>([
    {
      banner: {
        kind: 'verifyPayment',
        opId: 'op-1',
        actionUrl: 'https://pay.example/verify'
      },
      control: null
    },
    {
      banner: { kind: 'verifyPayment', opId: 'op-1', actionUrl: null },
      control: null
    },
    { banner: { kind: 'paymentReceived', opId: 'op-1' }, control: 'Dismiss' }
  ])(
    'renders $banner.kind (url: $banner.actionUrl) the same',
    async ({ banner, control }) => {
      const onAppDismiss = vi.fn()
      const app = render(BillingPlanCheckoutBanner, {
        props: { banner, onDismiss: onAppDismiss },
        global: { plugins: [i18n] }
      })
      const appBanner = readBanner()
      if (control) await clickControl(control)
      app.unmount()

      const pkg = renderPackage(planCheckoutBannerView(banner, copy))
      const packageBanner = readBanner()
      if (control) await clickControl(control)
      pkg.rendered.unmount()

      expect(packageBanner).toEqual(appBanner)
      expect(pkg.onDismiss).toHaveBeenCalledTimes(
        onAppDismiss.mock.calls.length
      )
    }
  )
})

describe('BillingBanner parity with the top-up checkout banner', () => {
  it.for<{
    banner: TopupCheckoutBanner
    canTopUp: boolean
  }>([
    {
      banner: { kind: 'failed', sessionId: 'cs_1', paymentAmountCents: 2500 },
      canTopUp: true
    },
    {
      banner: { kind: 'failed', sessionId: 'cs_1', paymentAmountCents: 1999 },
      canTopUp: false
    },
    {
      banner: { kind: 'failed', sessionId: 'cs_1', paymentAmountCents: null },
      canTopUp: true
    },
    { banner: { kind: 'creditsApplying', sessionId: 'cs_2' }, canTopUp: true },
    { banner: { kind: 'processing', sessionId: 'cs_3' }, canTopUp: true }
  ])(
    'renders $banner.kind with canTopUp $canTopUp the same',
    async ({ banner, canTopUp }) => {
      const onAppDismiss = vi.fn()
      const onAppAddCredits = vi.fn()
      const app = render(BillingTopupCheckoutBanner, {
        props: {
          banner,
          canTopUp,
          addCreditsVariant: 'secondary',
          onDismiss: onAppDismiss,
          onAddCredits: onAppAddCredits
        },
        global: { plugins: [i18n] }
      })
      const appBanner = readBanner()
      for (const control of appBanner.controls) {
        await clickControl(control.split(':')[1])
      }
      app.unmount()

      const pkg = renderPackage(topupCheckoutBannerView(banner, copy, canTopUp))
      const packageBanner = readBanner()
      for (const control of packageBanner.controls) {
        await clickControl(control.split(':')[1])
      }
      pkg.rendered.unmount()

      expect(packageBanner).toEqual(appBanner)
      expect(pkg.onDismiss).toHaveBeenCalledTimes(
        onAppDismiss.mock.calls.length
      )
      expect(
        pkg.onAction.mock.calls.filter(([action]) => action === 'addCredits')
      ).toHaveLength(onAppAddCredits.mock.calls.length)
    }
  )
})

describe('BillingBanner parity with the paused banner', () => {
  it.for([{ canManageBilling: true }, { canManageBilling: false }])(
    'renders canManageBilling $canManageBilling the same',
    async ({ canManageBilling }) => {
      const updatePayment = vi.fn(async () => ({ ok: true as const }))
      vi.mocked(usePausedBanner).mockReturnValue({
        isPaused: computed(() => true)
      })
      vi.mocked(usePaymentRecoveryDialog).mockReturnValue(
        fromPartial({ updatePayment, isUpdatingPayment: computed(() => false) })
      )

      const app = render(BillingPausedBanner, {
        props: { canManageBilling },
        global: { plugins: [i18n] }
      })
      const appBanner = readBanner()
      for (const control of appBanner.controls) {
        await clickControl(control.split(':')[1])
      }
      app.unmount()

      const paused = pausedBannerCopy(canManageBilling)
      const pkg = renderPackage({
        kind: 'paused',
        title: t(paused.titleKey),
        body: t(paused.bodyKey),
        muted: paused.muted,
        action: paused.action
      })
      const packageBanner = readBanner()
      for (const control of packageBanner.controls) {
        await clickControl(control.split(':')[1])
      }
      pkg.rendered.unmount()

      expect(packageBanner).toEqual(appBanner)
      expect(pkg.onAction).toHaveBeenCalledTimes(
        updatePayment.mock.calls.length
      )
      if (canManageBilling) {
        expect(pkg.onAction).toHaveBeenCalledWith('updatePayment')
      }
    }
  )
})

describe('BillingBanner parity with the parked banner', () => {
  it('renders a parked payment the same', () => {
    const app = render(BillingParkedBanner, {
      props: { parked: true },
      global: { plugins: [i18n] }
    })
    const appBanner = readBanner()
    app.unmount()

    const pkg = renderPackage({
      kind: 'parked',
      title: t(`${bs}.parked.title`),
      body: t(`${bs}.parked.body`),
      action: 'contactSupport',
      href: 'https://comfy.org/contact/'
    })
    const packageBanner = readBanner()
    pkg.rendered.unmount()

    expect(packageBanner).toEqual(appBanner)
  })
})
