import { createI18n } from 'vue-i18n'

const messages = {
  en: {
    billing: {
      eyebrow: 'Comfy Cloud',
      title: 'Add credits',
      description:
        'Choose an amount to keep your workflows and partner nodes running.',
      selectAmount: 'Select amount',
      amountLabel: 'Amount (USD)',
      creditsLabel: 'Credits',
      decreaseAmount: 'Decrease amount',
      increaseAmount: 'Increase amount',
      creditsPerDollar: '{credits} credits per dollar',
      minimumPurchase: '${amount} minimum',
      maximumPurchase: '${amount} maximum',
      continueToCheckout: 'Continue to checkout',
      checkoutPending: 'Secure checkout will be connected through Billing SDK.',
      secureCheckout: 'You will complete payment in a secure checkout.',
      estimatedCredits: 'You receive',
      purchaseAmount: 'Purchase amount'
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
