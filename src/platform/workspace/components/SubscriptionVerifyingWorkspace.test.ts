import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import SubscriptionVerifyingWorkspace from './SubscriptionVerifyingWorkspace.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
  missingWarn: false,
  fallbackWarn: false
})

function renderVerifying(props = {}) {
  return render(SubscriptionVerifyingWorkspace, {
    props: { actionUrl: 'https://bank.example/3ds', ...props },
    global: { plugins: [i18n] }
  })
}

describe('SubscriptionVerifyingWorkspace', () => {
  it('resolves its copy instead of rendering raw i18n keys', () => {
    renderVerifying()

    expect(screen.getByText('Verify your payment')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Your bank requires additional verification to complete this payment.'
      )
    ).toBeInTheDocument()
  })

  it('explains when the charge is too far along to cancel', () => {
    renderVerifying({ cancelUnavailable: true })

    expect(
      screen.getByText(
        "This payment is already processing and can't be canceled."
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel payment' })).toBeNull()
  })

  it('keeps cancel available when the request never reached the server', () => {
    renderVerifying({ cancelUnreachable: true })

    expect(
      screen.getByText(
        "Couldn't reach the server. Your payment has not been canceled — try again."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cancel payment' })
    ).toBeInTheDocument()
  })
})
