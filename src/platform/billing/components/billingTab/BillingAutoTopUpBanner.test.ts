import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import BillingAutoTopUpBanner from './BillingAutoTopUpBanner.vue'

function renderBanner(kind: 'autoTopUpFailed' | 'autoTopUpOff') {
  return render(BillingAutoTopUpBanner, {
    props: { kind },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  })
}

describe('BillingAutoTopUpBanner', () => {
  it.for([
    {
      kind: 'autoTopUpFailed',
      title: 'Auto top-up failed',
      body: "Your auto top-up charge didn't go through. Update your payment method or add credits manually."
    },
    {
      kind: 'autoTopUpOff',
      title: 'Auto top-up turned off',
      body: 'Your payment method was declined 3 times in a row. Update your payment method, then turn auto top-up back on.'
    }
  ] as const)('renders the $kind copy', (row) => {
    renderBanner(row.kind)

    const banner = screen.getByTestId('billing-auto-top-up-banner')
    expect(banner).toHaveTextContent(row.title)
    expect(banner).toHaveTextContent(row.body)
    expect(screen.getByRole('status')).toHaveClass('rounded-xl', 'p-3')
  })
})
