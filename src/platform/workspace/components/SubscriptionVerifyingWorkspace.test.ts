import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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

  it('emits the cancellation the customer asked for', async () => {
    const { emitted } = renderVerifying()

    await userEvent.click(
      screen.getByRole('button', { name: 'Cancel payment' })
    )

    expect(emitted().cancelPayment).toHaveLength(1)
  })

  it('tells the customer to finish in the tab that opened', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)

    renderVerifying()
    await userEvent.click(
      screen.getByRole('button', { name: 'Complete verification' })
    )

    expect(openSpy).toHaveBeenCalledWith(
      'https://bank.example/3ds',
      '_blank',
      'noopener,noreferrer'
    )
    expect(
      screen.getByText(
        'Complete the verification in the new tab. This updates automatically.'
      )
    ).toBeInTheDocument()
  })

  it('keeps the original instruction when the popup is blocked', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)

    renderVerifying()
    await userEvent.click(
      screen.getByRole('button', { name: 'Complete verification' })
    )

    expect(
      screen.getByText(
        'Your bank requires additional verification to complete this payment.'
      )
    ).toBeInTheDocument()
  })
})
