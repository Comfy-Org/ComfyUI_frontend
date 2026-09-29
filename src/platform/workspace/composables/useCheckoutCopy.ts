import type {
  CheckoutCopy,
  CheckoutPlan,
  CheckoutSuccessCopy
} from '@comfyorg/account-ui/billing/checkout'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import {
  getTierCredits,
  getTierPrice
} from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierKey'

/**
 * The app's translations and catalog for the shared checkout steps.
 * Sentences that wrap an element around a placeholder keep their `{name}`
 * tokens for the component to split.
 */
export function useCheckoutCopy() {
  const { t } = useI18n()

  const keepTokens = (keys: readonly string[]) =>
    Object.fromEntries(keys.map((key) => [key, `{${key}}`]))
  const reactivationTokens = keepTokens([
    'plan',
    'date',
    'newPlan',
    'nextDate',
    'amount'
  ])

  const copy = computed<CheckoutCopy>(() => ({
    back: t('g.back'),
    usdPerMonth: t('subscription.usdPerMonth'),
    billedMonthly: t('subscription.billedMonthly'),
    billedYearly: (total) => t('subscription.billedYearly', { total }),
    eachMonthCreditsRefill: t('subscription.preview.eachMonthCreditsRefill'),
    eachYearCreditsRefill: t('subscription.preview.eachYearCreditsRefill'),
    totalDueToday: t('subscription.preview.totalDueToday'),
    renewsAt: (amount, date) =>
      t('subscription.preview.renewsAt', { amount, date }),
    renewsAtAmount: (amount) =>
      t('subscription.preview.renewsAtAmount', { amount }),
    discount: {
      plan: t('subscription.preview.discount.plan'),
      promotion: t('subscription.preview.discount.promotion')
    },
    promoCodePlaceholder: t('subscription.preview.promoCodePlaceholder'),
    applyPromoCode: t('subscription.preview.applyPromoCode'),
    reconciliationTitle: t('billingOperation.reconciliationTitle'),
    reconciliationDetail: t('billingOperation.reconciliationDetail'),
    authenticationFailedDetail: t(
      'billingOperation.authenticationFailedDetail'
    ),
    pendingVerificationDetail: t(
      'subscription.preview.pendingVerificationDetail'
    ),
    completeVerification: t('subscription.preview.completeVerification'),
    confirmPayment: t('subscription.preview.confirmPayment'),
    startingToday: t('subscription.preview.startingToday'),
    parkedCheckoutDetail: t('subscription.preview.parkedCheckoutDetail'),
    completePayment: t('subscription.preview.completePayment'),
    payAndSubscribe: t('subscription.preview.payAndSubscribe'),
    subscribeToPlan: (plan) =>
      t('subscription.preview.subscribeToPlan', { plan }),
    confirmUpgradeTitle: t('subscription.preview.confirmUpgradeTitle'),
    confirmChangeTitle: t('subscription.preview.confirmChangeTitle'),
    switchesToday: t('subscription.preview.switchesToday'),
    startsOn: (date) => t('subscription.preview.startsOn', { date }),
    creditsYoullGetToday: t('subscription.preview.creditsYoullGetToday'),
    refillReplacesNote: t('subscription.preview.refillReplacesNote'),
    afterThat: t('subscription.preview.afterThat'),
    creditsRefillMonthlyTo: t('subscription.preview.creditsRefillMonthlyTo'),
    billedEachMonth: (amount) =>
      t('subscription.preview.billedEachMonth', { amount }),
    discountComposition: t('subscription.preview.discountComposition'),
    quoteUnavailable: t('subscription.preview.quoteUnavailable'),
    confirmUpgradeCta: t('subscription.preview.confirmUpgradeCta'),
    confirmChange: t('subscription.preview.confirmChange'),
    reactivation: {
      title: t('subscription.preview.reactivation.title'),
      titleAnnual: t('subscription.preview.reactivation.titleAnnual'),
      upgradeBody: t(
        'subscription.preview.reactivation.upgradeBody',
        reactivationTokens
      ),
      downgradeBody: t(
        'subscription.preview.reactivation.downgradeBody',
        reactivationTokens
      ),
      durationChangeBody: t(
        'subscription.preview.reactivation.durationChangeBody',
        reactivationTokens
      ),
      durationChangeBodyMonthly: t(
        'subscription.preview.reactivation.durationChangeBodyMonthly',
        reactivationTokens
      ),
      withoutRenewalDate: {
        upgradeBody: t(
          'subscription.preview.reactivation.withoutRenewalDate.upgradeBody',
          reactivationTokens
        ),
        downgradeBody: t(
          'subscription.preview.reactivation.withoutRenewalDate.downgradeBody',
          reactivationTokens
        ),
        durationChangeBody: t(
          'subscription.preview.reactivation.withoutRenewalDate.durationChangeBody',
          reactivationTokens
        ),
        durationChangeBodyMonthly: t(
          'subscription.preview.reactivation.withoutRenewalDate.durationChangeBodyMonthly',
          reactivationTokens
        )
      },
      confirmButton: t('subscription.preview.reactivation.confirmButton'),
      confirmButtonWithCharge: (amount) =>
        t('subscription.preview.reactivation.confirmButtonWithCharge', {
          amount
        }),
      checkboxLabel: (amount) =>
        t('subscription.preview.reactivation.checkboxLabel', { amount })
    },
    savedMethod: {
      savedPaymentMethod: t('subscription.preview.savedPaymentMethod'),
      changePaymentMethod: t('subscription.preview.changePaymentMethod'),
      addNewPaymentMethod: t('subscription.preview.addNewPaymentMethod'),
      alipay: t('subscription.preview.alipay'),
      selectLabel: t('g.singleSelectDropdown')
    },
    terms: {
      agreement: t(
        'subscription.preview.termsAgreement',
        keepTokens(['terms', 'privacy'])
      ),
      terms: t('subscription.preview.terms'),
      privacyPolicy: t('subscription.preview.privacyPolicy')
    },
    payment: {
      paymentMethod: t('subscription.preview.paymentMethod'),
      methodChoice: t('subscription.preview.stripeMethodChoice'),
      billingAddress: t('subscription.preview.billingAddress'),
      alipayRenewalNote: t('subscription.preview.alipayRenewalNote'),
      unavailable: t('subscription.preview.stripeUnavailable'),
      genericError: t('g.error')
    }
  }))

  const successCopy = computed<CheckoutSuccessCopy>(() => ({
    allSet: t('subscription.success.allSet'),
    planUpdated: t('subscription.success.planUpdated'),
    receiptEmailed: t('subscription.success.receiptEmailed'),
    usdPerMonth: t('subscription.usdPerMonth'),
    usdPerYear: t('subscription.usdPerYear'),
    perMonth: t('subscription.perMonth'),
    perYear: t('subscription.perYear'),
    promoApplied: (code) => t('subscription.success.promoApplied', { code }),
    promoRenews: (amount, date) =>
      t('subscription.success.promoRenews', { amount, date }),
    close: t('g.close')
  }))

  function checkoutPlan(
    tierKey: Exclude<TierKey, 'free' | 'founder'> | null | undefined,
    teamPlan: TeamPlanSelection | null
  ): CheckoutPlan {
    if (teamPlan) {
      return {
        name: t('subscription.teamPlan.name'),
        monthlyPriceUsd: {
          monthly: teamPlan.discountedUsd,
          yearly: teamPlan.discountedUsd
        },
        monthlyCredits: teamPlan.credits,
        pricedByQuote: false
      }
    }
    return {
      name: t(`subscription.tiers.${tierKey}.name`),
      monthlyPriceUsd: {
        monthly: tierKey ? getTierPrice(tierKey, false) : 0,
        yearly: tierKey ? getTierPrice(tierKey, true) : 0
      },
      monthlyCredits: tierKey ? (getTierCredits(tierKey) ?? 0) : 0,
      pricedByQuote: true
    }
  }

  return { copy, successCopy, checkoutPlan }
}
