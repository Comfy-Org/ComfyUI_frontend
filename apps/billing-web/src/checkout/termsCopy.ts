import type { CheckoutTermsCopy } from '@comfyorg/account-ui/billing/checkout'

/** The terms note under the last way to pay, with `agreement` as its i18n key. */
export function termsCopy(
  t: (key: string, named?: Record<string, string>) => string,
  agreement: string
): CheckoutTermsCopy {
  return {
    agreement: t(agreement, { terms: '{terms}', privacy: '{privacy}' }),
    terms: t('checkout.fullPage.terms.terms'),
    privacyPolicy: t('checkout.fullPage.terms.privacyPolicy')
  }
}
