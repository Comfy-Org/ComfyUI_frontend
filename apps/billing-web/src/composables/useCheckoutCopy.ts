import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  CheckoutCopy,
  CheckoutInviteCopy,
  CheckoutSuccessCopy
} from '@comfyorg/account-ui/billing/checkout'

/**
 * billing-web's translations for the shared checkout steps: the cloud app's
 * English copy, key for key. Sentences that wrap an element around a
 * placeholder keep their `{name}` tokens for the component to split.
 */
export function useCheckoutCopy() {
  const { t, te } = useI18n()

  const keepTokens = (keys: readonly string[]) =>
    Object.fromEntries(keys.map((key) => [key, `{${key}}`]))
  const reactivationTokens = keepTokens([
    'plan',
    'date',
    'newPlan',
    'nextDate',
    'amount'
  ])
  const preview = (key: string, params: Record<string, string> = {}) =>
    t(`checkout.preview.${key}`, params)

  const copy = computed<CheckoutCopy>(() => ({
    back: t('checkout.back'),
    usdPerMonth: t('checkout.usdPerMonth'),
    billedMonthly: t('checkout.billedMonthly'),
    billedYearly: (total) => t('checkout.billedYearly', { total }),
    eachMonthCreditsRefill: preview('eachMonthCreditsRefill'),
    eachYearCreditsRefill: preview('eachYearCreditsRefill'),
    totalDueToday: preview('totalDueToday'),
    renewsAt: (amount, date) => preview('renewsAt', { amount, date }),
    renewsAtAmount: (amount) => preview('renewsAtAmount', { amount }),
    discount: {
      plan: preview('discount.plan'),
      promotion: preview('discount.promotion')
    },
    promoCodePlaceholder: preview('promoCodePlaceholder'),
    applyPromoCode: preview('applyPromoCode'),
    reconciliationTitle: t('checkout.operation.reconciliationTitle'),
    reconciliationDetail: t('checkout.operation.reconciliationDetail'),
    authenticationFailedDetail: t(
      'checkout.operation.authenticationFailedDetail'
    ),
    pendingVerificationDetail: preview('pendingVerificationDetail'),
    completeVerification: preview('completeVerification'),
    confirmPayment: preview('confirmPayment'),
    startingToday: preview('startingToday'),
    parkedCheckoutDetail: preview('parkedCheckoutDetail'),
    completePayment: preview('completePayment'),
    payAndSubscribe: preview('payAndSubscribe'),
    subscribeToPlan: (plan) => preview('subscribeToPlan', { plan }),
    confirmUpgradeTitle: preview('confirmUpgradeTitle'),
    confirmChangeTitle: preview('confirmChangeTitle'),
    switchesToday: preview('switchesToday'),
    startsOn: (date) => preview('startsOn', { date }),
    creditsYoullGetToday: preview('creditsYoullGetToday'),
    refillReplacesNote: preview('refillReplacesNote'),
    afterThat: preview('afterThat'),
    creditsRefillMonthlyTo: preview('creditsRefillMonthlyTo'),
    billedEachMonth: (amount) => preview('billedEachMonth', { amount }),
    discountComposition: preview('discountComposition'),
    quoteUnavailable: preview('quoteUnavailable'),
    confirmUpgradeCta: preview('confirmUpgradeCta'),
    confirmChange: preview('confirmChange'),
    reactivation: {
      title: preview('reactivation.title'),
      titleAnnual: preview('reactivation.titleAnnual'),
      upgradeBody: preview('reactivation.upgradeBody', reactivationTokens),
      downgradeBody: preview('reactivation.downgradeBody', reactivationTokens),
      durationChangeBody: preview(
        'reactivation.durationChangeBody',
        reactivationTokens
      ),
      durationChangeBodyMonthly: preview(
        'reactivation.durationChangeBodyMonthly',
        reactivationTokens
      ),
      confirmButton: preview('reactivation.confirmButton'),
      confirmButtonWithCharge: (amount) =>
        preview('reactivation.confirmButtonWithCharge', { amount }),
      checkboxLabel: (amount) =>
        preview('reactivation.checkboxLabel', { amount })
    },
    savedMethod: {
      savedPaymentMethod: preview('savedPaymentMethod'),
      changePaymentMethod: preview('changePaymentMethod'),
      addNewPaymentMethod: preview('addNewPaymentMethod'),
      alipay: preview('alipay'),
      selectLabel: t('checkout.singleSelectDropdown')
    },
    terms: {
      agreement: preview('termsAgreement', keepTokens(['terms', 'privacy'])),
      terms: preview('terms'),
      privacyPolicy: preview('privacyPolicy')
    },
    payment: {
      paymentMethod: preview('paymentMethod'),
      methodChoice: preview('stripeMethodChoice'),
      billingAddress: preview('billingAddress'),
      alipayRenewalNote: preview('alipayRenewalNote'),
      unavailable: preview('stripeUnavailable'),
      genericError: t('checkout.genericError')
    }
  }))

  const successCopy = computed<CheckoutSuccessCopy>(() => ({
    allSet: t('checkout.success.allSet'),
    planUpdated: t('checkout.success.planUpdated'),
    receiptEmailed: t('checkout.success.receiptEmailed'),
    usdPerMonth: t('checkout.usdPerMonth'),
    usdPerYear: t('checkout.usdPerYear'),
    perMonth: t('checkout.perMonth'),
    perYear: t('checkout.perYear'),
    promoApplied: (code) => t('checkout.success.promoApplied', { code }),
    promoRenews: (amount, date) =>
      t('checkout.success.promoRenews', { amount, date }),
    close: t('checkout.close')
  }))

  const inviteCopy = computed<CheckoutInviteCopy>(() => ({
    title: t('checkout.invite.title'),
    subtext: t('checkout.invite.subtext'),
    placeholder: t('checkout.invite.placeholder'),
    sendInvites: t('checkout.invite.sendInvites'),
    removeTag: t('checkout.invite.removeTag'),
    invalidEmailCount: (count) => t('checkout.invite.invalidEmailCount', count),
    pendingInviteSingle: t('checkout.invite.pendingInviteSingle'),
    pendingInviteCount: (count) =>
      t('checkout.invite.pendingInviteCount', { count }),
    seatLimitExceeded: (max, overage) =>
      t('checkout.invite.seatLimitExceeded', { max, overage }),
    invitedMessage: (emails, count) =>
      t('checkout.invite.invitedMessage', { emails }, count),
    failedCount: (count) => t('checkout.invite.failedCount', count)
  }))

  /** The cloud app's tier naming: catalog copy, else the tier in words. */
  function tierName(tier: string): string {
    const key = `checkout.tiers.${tier.toLowerCase()}`
    if (te(key)) return t(key)
    return tier
      .toLowerCase()
      .split(/[_-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return { copy, successCopy, inviteCopy, tierName }
}
