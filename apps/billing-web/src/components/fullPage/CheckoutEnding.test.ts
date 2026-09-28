import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'

import type { EndingScreen } from '@/checkout/endingScreen'
import type { EndingPlan } from '@/components/fullPage/CheckoutEnding.vue'
import CheckoutEnding from '@/components/fullPage/CheckoutEnding.vue'
import { createBillingI18n } from '@/i18n'

const PLAN: EndingPlan = { name: 'Pro', price: '$50.00', period: 'USD / mo' }

function renderEnding(ending: EndingScreen) {
  return render(CheckoutEnding, {
    props: { screen: ending, workspace: 'Acme Team', plan: PLAN },
    global: { plugins: [createBillingI18n()] }
  })
}

const CLOSE_LINE =
  "You can close this page. We'll email your invoice once this goes through and this page will automatically update."

describe('CheckoutEnding', () => {
  it.for<{
    ending: EndingScreen
    title: string
    body: string
    codeLabel?: string
    close: boolean
    support: boolean
    closeLine: boolean
  }>([
    {
      ending: { kind: 'success' },
      title: "You're all set",
      body: 'Your plan for Acme Team has been successfully updated.',
      close: true,
      support: false,
      closeLine: false
    },
    {
      ending: { kind: 'completed', code: 'op_seen' },
      title: "You're all set",
      body: 'A payment on this workspace completed — check your plan in settings.',
      codeLabel: 'Your reference for this payment:',
      close: true,
      support: false,
      closeLine: false
    },
    {
      ending: { kind: 'already_completed', code: 'op_old' },
      title: 'Already completed',
      body: "This payment for Acme Team already went through. You won't be charged again.",
      codeLabel: 'Your reference for this payment:',
      close: true,
      support: false,
      closeLine: false
    },
    {
      ending: { kind: 'in_progress', code: 'op_s' },
      title: 'Payment in progress',
      body: "Your bank is still settling this payment — this can take up to a day. Nothing more is needed from you, and don't pay again: you could be charged twice.",
      codeLabel:
        'If nothing has changed after 24 hours, contact support with this code:',
      close: false,
      support: true,
      closeLine: true
    },
    {
      ending: { kind: 'received', code: 'op_r' },
      title: 'Payment received',
      body: "Your payment went through and you should receive your credits or subscription soon. You won't be charged again.",
      codeLabel:
        'If nothing has changed after 24 hours, contact support with this code:',
      close: false,
      support: true,
      closeLine: true
    },
    {
      ending: { kind: 'unconfirmed', code: 'op_u' },
      title: "We couldn't confirm your payment",
      body: "Your payment may or may not have gone through. Don't pay again yet, you could be charged twice.",
      codeLabel:
        "If this page still can't confirm it after a few minutes, contact support with this code:",
      close: false,
      support: true,
      closeLine: true
    }
  ])(
    '$ending.kind reads as designed',
    ({ ending, title, body, codeLabel, close, support, closeLine }) => {
      renderEnding(ending)

      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
      expect(screen.getByText(body)).toBeInTheDocument()
      if (codeLabel === undefined) {
        expect(screen.queryByTestId('checkout-ending-code')).toBeNull()
      } else {
        expect(screen.getByText(codeLabel)).toBeInTheDocument()
        expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
          'code' in ending ? (ending.code ?? '') : ''
        )
      }
      expect(screen.queryByRole('button', { name: 'Close' }) !== null).toBe(
        close
      )
      expect(
        screen.queryByRole('link', { name: 'Contact support' }) !== null
      ).toBe(support)
      expect(screen.queryByText(CLOSE_LINE) !== null).toBe(closeLine)
      expect(screen.queryByTestId('checkout-ending-plan') !== null).toBe(
        ending.kind === 'success'
      )
    }
  )

  it('names the plan this page bought on Success', () => {
    renderEnding({ kind: 'success' })

    expect(screen.getByTestId('checkout-ending-plan')).toHaveTextContent(
      'Pro$50.00 USD / mo'
    )
  })

  it('Close emits close', async () => {
    const { emitted } = renderEnding({ kind: 'success' })

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(emitted()).toHaveProperty('close')
  })

  it('mails support with the code the screen shows', () => {
    renderEnding({ kind: 'in_progress', code: 'op_s' })

    const href = screen
      .getByRole('link', { name: 'Contact support' })
      .getAttribute('href')
    expect(new URL(href ?? '').searchParams.get('body')).toBe('Reference: op_s')
  })

  it('copies the code and says so', async () => {
    const user = userEvent.setup()
    renderEnding({ kind: 'unconfirmed', code: 'op_u' })

    await user.click(screen.getByRole('button', { name: 'Copy code' }))

    expect(await navigator.clipboard.readText()).toBe('op_u')
    expect(
      await screen.findByRole('button', { name: 'Copied' })
    ).toBeInTheDocument()
  })
})
