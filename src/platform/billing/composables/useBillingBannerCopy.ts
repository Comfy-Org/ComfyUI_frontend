import type {
  BillingBannerCopy,
  BillingBannerView
} from '@comfyorg/account-ui/billing'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatUsdFromCents } from '@/base/credits/comfyCredits'
import { pausedBannerCopy } from '@/platform/billing/composables/usePausedBanner'

const bs = 'workspacePanel.billingStatus'
const tc = 'workspacePanel.billingTab.topupCheckout'
const CONTACT_SUPPORT_URL = 'https://comfy.org/contact/'

/** The Billing tab banner strings in the app locale, with the paused and parked views. */
export function useBillingBannerCopy() {
  const { t, locale } = useI18n()

  function usd(cents: number) {
    return formatUsdFromCents({
      cents,
      locale: locale.value,
      numberOptions: {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: cents % 100 === 0 ? 0 : 2
      }
    })
  }

  const copy = computed<BillingBannerCopy>(() => ({
    dismiss: t(`${bs}.planCheckout.dismiss`),
    actions: {
      addCredits: t('workspacePanel.billingTab.credits.addCredits'),
      updatePayment: t(`${bs}.updatePayment`),
      verifyPayment: t(`${bs}.planCheckout.verifyPayment.action`),
      contactSupport: t(`${bs}.parked.contactSupport`),
      resumePlan: t(`${bs}.ending.reactivate`),
      choosePlan: t('workspacePanel.billingTab.plan.actions.choosePlan'),
      contactSales: t(`${bs}.ending.contactSales`)
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
  }))

  const topupCopy = computed<BillingBannerCopy>(() => ({
    ...copy.value,
    dismiss: t(`${tc}.dismiss`)
  }))

  function pausedView(canManageBilling: boolean): BillingBannerView {
    const shown = pausedBannerCopy(canManageBilling)
    return {
      kind: 'paused',
      title: t(shown.titleKey),
      body: t(shown.bodyKey),
      muted: shown.muted,
      action: shown.action
    }
  }

  const parkedView = computed<BillingBannerView>(() => ({
    kind: 'parked',
    title: t(`${bs}.parked.title`),
    body: t(`${bs}.parked.body`),
    action: 'contactSupport',
    href: CONTACT_SUPPORT_URL
  }))

  return { copy, topupCopy, pausedView, parkedView }
}
