import { createI18n } from 'vue-i18n'

const messages = {
  en: {
    checkout: {
      confirmPayment: 'Confirm your payment',
      back: 'Back',
      close: 'Close',
      perMonth: 'USD per month',
      billedMonthly: 'Billed monthly',
      billedYearly: '{amount} billed yearly',
      startingToday: 'Starting today',
      creditsRefill: 'Credits refill every month',
      totalDueToday: 'Total due today',
      promotionCode: 'Promotion code',
      apply: 'Apply',
      paymentMethod: 'Payment method',
      stripeSecurity: 'Your payment details are handled securely by Stripe.',
      card: 'Card',
      cardNumber: 'Card number',
      cardDetails: 'MM / YY  CVC',
      country: 'Country',
      postalCode: 'Postal code',
      alipay: 'Alipay',
      payAndSubscribe: 'Pay and subscribe',
      terms:
        'By subscribing, you agree to recurring charges until cancellation.',
      sdkPending: 'Payment actions will be connected through Billing SDK.',
      successTitle: "You're all set",
      successBody: 'Your plan was updated. A receipt was sent to your email.',
      creditsPerMonth: 'credits per month'
    }
  }
} as const

export function createBillingI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages
  })
}
