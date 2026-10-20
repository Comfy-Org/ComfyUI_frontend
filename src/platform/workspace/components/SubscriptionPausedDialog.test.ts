import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SubscriptionPausedDialog from './SubscriptionPausedDialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      subscription: {
        paymentRecovery: {
          title: 'Subscription paused',
          ownerDescription:
            "Update your payment method to restore the workspace's subscription and run workflows.",
          memberDescription:
            "Ask your workspace owner to restore the workspace's subscription.",
          paymentFailedOwnerTitle: "Your payment didn't go through",
          paymentFailedMemberTitle:
            "This workspace's payment didn't go through",
          paymentFailedOwnerDescription:
            'Update your payment method to keep running workflows.',
          paymentFailedMemberDescription:
            "Ask your workspace owner to update the workspace's payment method.",
          ownerCta: 'Update payment',
          memberCta: 'Ok, got it'
        }
      }
    }
  }
})

function renderDialog(
  canManage: boolean,
  isUpdatingPayment = false,
  status: 'paused' | 'payment_failed' = 'paused'
) {
  const onClose = vi.fn()
  const onUpdatePayment = vi.fn()
  render(SubscriptionPausedDialog, {
    props: { canManage, status, isUpdatingPayment, onClose, onUpdatePayment },
    global: { plugins: [i18n] }
  })
  return { onClose, onUpdatePayment }
}

describe('SubscriptionPausedDialog', () => {
  it('gives owners a payment recovery action', async () => {
    const { onUpdatePayment } = renderDialog(true)

    expect(screen.getByText('Subscription paused')).toBeInTheDocument()
    expect(screen.getByText(/Update your payment method/)).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment' })
    )

    expect(onUpdatePayment).toHaveBeenCalledOnce()
  })

  it('gives members privacy-safe copy and no payment action', async () => {
    const { onClose, onUpdatePayment } = renderDialog(false)

    expect(
      screen.getByText(
        "Ask your workspace owner to restore the workspace's subscription."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Update payment' })
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ok, got it' }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(onUpdatePayment).not.toHaveBeenCalled()
  })

  it('gives owners outstanding-payment recovery copy', () => {
    renderDialog(true, false, 'payment_failed')

    expect(
      screen.getByText("Your payment didn't go through")
    ).toBeInTheDocument()
    expect(
      screen.getByText('Update your payment method to keep running workflows.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Subscription paused')).not.toBeInTheDocument()
  })

  it('gives members outstanding-payment guidance without a payment action', () => {
    renderDialog(false, false, 'payment_failed')

    expect(
      screen.getByText("This workspace's payment didn't go through")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Ask your workspace owner to update the workspace's payment method."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Update payment' })
    ).not.toBeInTheDocument()
  })

  it('closes from the visible close button', async () => {
    const { onClose } = renderDialog(true)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('disables the owner action while payment recovery is pending', () => {
    renderDialog(true, true)

    expect(
      screen.getByRole('button', { name: 'Update payment' })
    ).toBeDisabled()
  })
})
