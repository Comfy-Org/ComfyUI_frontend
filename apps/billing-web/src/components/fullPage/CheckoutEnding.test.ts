import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'

import type { CapabilityDenialReason } from '@comfyorg/account-core/billing'

import type { EndingScreen } from '@/checkout/endingScreen'
import { endingOf } from '@/checkout/endingScreen'
import type { EndingPlan } from '@/components/fullPage/CheckoutEnding.vue'
import CheckoutEnding from '@/components/fullPage/CheckoutEnding.vue'
import { createBillingI18n } from '@/i18n'

const PLAN: EndingPlan = { name: 'Pro', price: '$50.00', period: 'USD / mo' }

function renderEnding(ending: EndingScreen, closesItself = false) {
  return render(CheckoutEnding, {
    props: { screen: ending, workspace: 'Acme Team', plan: PLAN, closesItself },
    global: { plugins: [createBillingI18n()] }
  })
}

const CLOSE_LINE =
  "You can close this page. We'll email your invoice once this goes through and this page will automatically update."

type Action = 'Close' | 'Try again' | 'View plans'

describe('CheckoutEnding', () => {
  const UNKNOWN =
    'Checkout isn’t available for this workspace right now. Contact support with the code below.'

  it.for<{ reason: CapabilityDenialReason; code: string; body: string }>([
    {
      reason: 'not_workspace_owner',
      code: 'NOT_WORKSPACE_OWNER',
      body: 'Billing for this workspace is managed by its owner. Ask them to make this change.'
    },
    {
      reason: 'tier_not_self_serve',
      code: 'TIER_NOT_SELF_SERVE',
      body: 'Your plan is managed by our team. Contact your account manager to make changes.'
    },
    {
      reason: 'subscription_not_started',
      code: 'SUBSCRIPTION_NOT_STARTED',
      body: 'A previous payment didn’t finish. Finish or cancel it in your billing settings.'
    },
    {
      reason: 'subscription_status_unrecognized',
      code: 'SUBSCRIPTION_STATUS_UNRECOGNIZED',
      body: UNKNOWN
    },
    {
      reason: 'subscription_change_in_progress',
      code: 'SUBSCRIPTION_CHANGE_IN_PROGRESS',
      body: UNKNOWN
    },
    { reason: 'not_a_member', code: 'NOT_A_MEMBER', body: UNKNOWN },
    { reason: 'unspecified', code: 'UNSPECIFIED', body: UNKNOWN }
  ])(
    'a refusal for $reason explains itself and shows $code, with support only',
    ({ reason, code, body }) => {
      const ending = endingOf({ kind: 'refused', reason })
      if (ending === undefined) throw new Error('a refusal is an ending')
      renderEnding(ending)

      expect(
        screen.getByRole('heading', { name: 'Checkout not available' })
      ).toBeInTheDocument()
      expect(screen.getByText(body)).toBeInTheDocument()
      expect(
        screen.getByText('If this is an error, contact support with this code:')
      ).toBeInTheDocument()
      expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(code)
      expect(
        screen.getByRole('link', { name: 'Contact support' })
      ).toBeInTheDocument()
      expect(
        screen
          .queryAllByRole('button')
          .filter((button) => button.textContent.trim() !== '')
      ).toEqual([])
    }
  )

  it.for<{
    ending: EndingScreen
    title: string
    body: string
    codeLabel?: string
    action?: Action
    support: boolean
    closeLine: boolean
  }>([
    {
      ending: { kind: 'success' },
      title: "You're all set",
      body: 'Your plan for Acme Team has been successfully updated.',
      action: 'Close',
      support: false,
      closeLine: false
    },
    {
      ending: { kind: 'completed', code: 'op_seen' },
      title: "You're all set",
      body: 'A payment on this workspace completed — check your plan in settings.',
      codeLabel: 'Your reference for this payment:',
      action: 'Close',
      support: false,
      closeLine: false
    },
    {
      ending: { kind: 'already_completed', code: 'op_old' },
      title: 'Already completed',
      body: "This payment for Acme Team already went through. You won't be charged again.",
      codeLabel: 'Your reference for this payment:',
      action: 'Close',
      support: false,
      closeLine: false
    },
    {
      ending: { kind: 'in_progress', code: 'op_s' },
      title: 'Payment in progress',
      body: 'Your bank is still settling this payment. This can take up to a day. Nothing more is needed from you.',
      codeLabel:
        'If nothing has changed after 24 hours, contact support with this code:',
      support: true,
      closeLine: true
    },
    {
      ending: { kind: 'received', code: 'op_r' },
      title: 'Payment received',
      body: "Your payment went through and you should receive your credits or subscription soon. You won't be charged again.",
      codeLabel:
        'If nothing has changed after 24 hours, contact support with this code:',
      support: true,
      closeLine: true
    },
    {
      ending: { kind: 'unconfirmed', code: 'op_u' },
      title: "We couldn't confirm your payment",
      body: "Your payment may or may not have gone through. Don't pay again yet, you could be charged twice.",
      codeLabel:
        "If this page still can't confirm it after a few minutes, contact support with this code:",
      support: true,
      closeLine: true
    },
    {
      ending: { kind: 'plan_unavailable', code: 'PLAN_NOT_FOUND' },
      title: "This plan isn't available",
      body: "The plan in your link isn't available. Nothing has been charged. See our current plans instead.",
      codeLabel:
        'If you think this is a mistake, contact support with this code:',
      action: 'View plans',
      support: true,
      closeLine: false
    },
    {
      ending: { kind: 'load_failed', code: 'REQUEST_FAILED' },
      title: "Couldn't load your checkout",
      body: "We couldn't load your quote. Nothing has been charged. Try again, or contact support if this keeps happening.",
      codeLabel: 'If this keeps happening, contact support with this code:',
      action: 'Try again',
      support: true,
      closeLine: false
    },
    {
      ending: { kind: 'recheck_failed', code: 'REQUEST_FAILED' },
      title: "Couldn't load your checkout",
      body: "We couldn't check this workspace's payments, so we can't show your checkout yet. Try again, or contact support if this keeps happening.",
      codeLabel: 'If this keeps happening, contact support with this code:',
      action: 'Try again',
      support: true,
      closeLine: false
    }
  ])(
    '$ending.kind reads as designed',
    ({ ending, title, body, codeLabel, action, support, closeLine }) => {
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
      const buttons = screen
        .queryAllByRole('button')
        .map((button) => button.textContent.trim())
        .filter((label) => label !== '')
      expect(buttons).toEqual(action === undefined ? [] : [action])
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

  it.for<{ ending: EndingScreen; action: Action; event: string }>([
    { ending: { kind: 'success' }, action: 'Close', event: 'close' },
    {
      ending: { kind: 'load_failed', code: 'REQUEST_FAILED' },
      action: 'Try again',
      event: 'retry'
    },
    {
      ending: { kind: 'recheck_failed', code: 'REQUEST_FAILED' },
      action: 'Try again',
      event: 'retry'
    },
    {
      ending: { kind: 'plan_unavailable', code: 'PLAN_NOT_FOUND' },
      action: 'View plans',
      event: 'viewPlans'
    }
  ])('$action emits $event', async ({ ending, action, event }) => {
    const { emitted } = renderEnding(ending)

    await userEvent.click(screen.getByRole('button', { name: action }))

    expect(emitted()).toHaveProperty(event)
  })

  describe('the Success footer', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('counts down on a tab a script opened, then closes it', async () => {
      const { emitted } = renderEnding({ kind: 'success' }, true)

      expect(screen.getByText('Closing in 5…')).toBeInTheDocument()
      await vi.advanceTimersByTimeAsync(1000)
      expect(screen.getByText('Closing in 4…')).toBeInTheDocument()
      expect(emitted()).not.toHaveProperty('close')

      await vi.advanceTimersByTimeAsync(4000)

      expect(emitted('close')).toHaveLength(1)
      expect(
        screen.queryByText('You can close this tab now.')
      ).not.toBeInTheDocument()
    })

    it('tells any other tab it can be closed, and never closes it', async () => {
      const { emitted } = renderEnding({ kind: 'success' })

      await vi.advanceTimersByTimeAsync(10_000)

      expect(
        screen.getByText('You can close this tab now.')
      ).toBeInTheDocument()
      expect(screen.queryByText(/Closing in/)).not.toBeInTheDocument()
      expect(emitted()).not.toHaveProperty('close')
    })

    it.for<EndingScreen>([
      { kind: 'already_completed', code: 'op_old' },
      { kind: 'completed', code: 'op_seen' }
    ])('never counts down on $kind', async (ending) => {
      const { emitted } = renderEnding(ending, true)

      await vi.advanceTimersByTimeAsync(10_000)

      expect(screen.queryByText(/Closing in/)).not.toBeInTheDocument()
      expect(emitted()).not.toHaveProperty('close')
    })
  })

  it('372-4951: Payment in progress warns in bold not to pay again', () => {
    renderEnding({ kind: 'in_progress', code: 'op_s' })

    const warning = screen.getByText(/you could be charged twice/)
    expect(warning).toHaveTextContent(
      "Don't pay again, you could be charged twice."
    )
    expect(
      screen.getByText("Don't pay again", { selector: 'strong' })
    ).toBeInTheDocument()
  })

  it('warns only while money may still move twice', () => {
    renderEnding({ kind: 'received', code: 'op_r' })

    expect(screen.queryByText(/Don't pay again/)).not.toBeInTheDocument()
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
