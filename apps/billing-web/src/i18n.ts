import { createI18n } from 'vue-i18n'

const messages = {
  en: {
    billing: {
      eyebrow: 'Comfy Cloud',
      title: 'Billing',
      description:
        'The billing experience is being prepared. Account and billing integrations will be connected after their client contracts are available.',
      accountIntegration: 'Account integration',
      billingIntegration: 'Billing integration',
      pending: 'Pending SDK'
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
