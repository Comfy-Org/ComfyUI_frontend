import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import SubscriptionReconciliationWorkspace from './SubscriptionReconciliationWorkspace.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

describe('SubscriptionReconciliationWorkspace', () => {
  it('hands over the support id and offers only acknowledgement and support', async () => {
    const { emitted } = render(SubscriptionReconciliationWorkspace, {
      props: { operationId: 'op-recon-1' },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Payment received')).toBeInTheDocument()
    expect(screen.getByText(/won't be charged again/)).toBeInTheDocument()
    expect(
      screen.getByText("If it doesn't resolve, give support this ID")
    ).toBeInTheDocument()
    expect(screen.getByText('op-recon-1')).toHaveClass('font-mono')

    // Terminal: no retry, no payment collection, no way back into the flow.
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Update payment method' })
    ).toBeNull()

    await userEvent.click(
      screen.getByRole('button', { name: 'Contact support' })
    )
    expect(emitted().contactSupport).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(emitted().close).toBeTruthy()
  })

  it('omits the support box when no operation id is known', () => {
    render(SubscriptionReconciliationWorkspace, {
      global: { plugins: [i18n] }
    })

    expect(
      screen.queryByText("If it doesn't resolve, give support this ID")
    ).toBeNull()
  })
})
