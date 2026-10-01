import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'

import type { CapabilityDenialReason } from '@comfyorg/account-core/billing'

import type { EndingScreen } from '@/checkout/endingScreen'
import { endingOf } from '@/checkout/endingScreen'
import type { EndingPlan } from '@/components/fullPage/EndingPlanCard.vue'
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

type Action = 'Close' | 'Try again' | 'View plans' | 'Add credits'

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
      body: 'Your plan already has a change scheduled. Cancel it in your billing settings to make a different one.'
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

  it.for([
    { duration: 'MONTHLY', plan: 'Pro' },
    { duration: 'ANNUAL', plan: 'Pro Yearly' }
  ] as const)(
    'a refusal for a change already scheduled to $duration names it $plan and the full date it takes effect',
    ({ duration, plan }) => {
      const ending = endingOf({
        kind: 'refused',
        reason: 'subscription_change_in_progress',
        scheduled: {
          plan: { tier: 'PRO', duration },
          effectiveAt: '2026-10-28T00:00:00.000Z'
        }
      })
      if (ending === undefined) throw new Error('a refusal is an ending')
      renderEnding(ending)

      expect(
        screen.getByText(
          `Your plan is set to change to ${plan} on October 28, 2026. Cancel that change in your billing settings to make a different one.`
        )
      ).toBeInTheDocument()
      expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
        'SUBSCRIPTION_CHANGE_IN_PROGRESS'
      )
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
      body: 'A payment for Acme Team went through. Check your plan in settings for the details.',
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
      ending: { kind: 'link_invalid', code: 'CHECKOUT_LINK_INVALID' },
      title: "This link isn't valid",
      body: "The amount in your link isn't valid. Nothing has been charged. Choose an amount in your billing settings.",
      codeLabel:
        'If you think this is a mistake, contact support with this code:',
      action: 'Add credits',
      support: true,
      closeLine: false
    },
    {
      ending: { kind: 'load_failed', cause: 'quote', code: 'REQUEST_FAILED' },
      title: "Couldn't load your checkout",
      body: "We couldn't load your quote. Nothing has been charged. Try again, or contact support if this keeps happening.",
      codeLabel: 'If this keeps happening, contact support with this code:',
      action: 'Try again',
      support: true,
      closeLine: false
    },
    {
      ending: { kind: 'load_failed', cause: 'recheck', code: 'REQUEST_FAILED' },
      title: "Couldn't load your checkout",
      body: "We couldn't check your recent payments, so checkout can't open yet. Try again, or contact support if this keeps happening.",
      codeLabel: 'If this keeps happening, contact support with this code:',
      action: 'Try again',
      support: true,
      closeLine: false
    }
  ])(
    '$ending.kind reads as designed: $body',
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
    expect(screen.queryByText(/credits added/)).not.toBeInTheDocument()
  })

  it('77-4068: Success counts the credits the server says it added', () => {
    renderEnding({ kind: 'success', receipt: { creditsAdded: 6858 } })

    expect(screen.getByTestId('checkout-ending-plan')).toHaveTextContent(
      'Pro$50.00 USD / mo6,858 credits added'
    )
  })

  it('758-15763: Success keeps the rate and lists each reason, then Paid today', () => {
    render(CheckoutEnding, {
      props: {
        screen: { kind: 'success' },
        workspace: 'Acme Team',
        plan: PLAN,
        breakdown: {
          deductions: [
            { label: 'Launch', amount: '−$10.00', subline: 'First month' },
            { label: 'Account balance', amount: '−$5.00' }
          ],
          paidToday: { label: 'Paid today', amount: '$35.00', sublines: [] }
        }
      },
      global: { plugins: [createBillingI18n()] }
    })

    expect(screen.getByTestId('checkout-ending-plan')).toHaveTextContent(
      'Pro$50.00 USD / moLaunch−$10.00First monthAccount balance−$5.00Paid today$35.00'
    )
  })

  it('shows no Paid today when the charge matched the plan rate', () => {
    renderEnding({ kind: 'success' })

    expect(
      screen.queryByTestId('checkout-ending-paid-today')
    ).not.toBeInTheDocument()
  })

  describe('the receipt the server reported', () => {
    const RECEIPT_PLAN = { slug: 'pro_monthly', duration: 'MONTHLY' } as const

    it.for<EndingScreen>([
      {
        kind: 'already_completed',
        code: 'op_old',
        receipt: { plan: RECEIPT_PLAN, creditsAdded: 6858 }
      },
      {
        kind: 'completed',
        code: 'op_seen',
        receipt: { plan: RECEIPT_PLAN, creditsAdded: 6858 }
      }
    ])(
      '328-4444: $kind names the plan its receipt names, in place of the reference',
      (ending) => {
        renderEnding(ending)

        expect(screen.getByTestId('checkout-ending-plan')).toHaveTextContent(
          'Pro$50.00 USD / mo6,858 credits added'
        )
        expect(
          screen.queryByTestId('checkout-ending-code')
        ).not.toBeInTheDocument()
      }
    )

    it('keeps the reference when the catalog cannot list the plan a receipt names', () => {
      render(CheckoutEnding, {
        props: {
          screen: {
            kind: 'already_completed',
            code: 'op_old',
            receipt: { plan: RECEIPT_PLAN }
          },
          workspace: 'Acme Team'
        },
        global: { plugins: [createBillingI18n()] }
      })

      expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
        'op_old'
      )
      expect(
        screen.queryByTestId('checkout-ending-plan')
      ).not.toBeInTheDocument()
    })

    it('410-5225: a top-up already completed reads Added and Amount paid, and no balance', () => {
      renderEnding({
        kind: 'already_completed',
        code: 'op_topup',
        receipt: { creditsAdded: 3000, amountChargedCents: 1500 }
      })

      expect(screen.getByTestId('checkout-ending-receipt')).toHaveTextContent(
        'Added+3,000Amount paid$15.00'
      )
      expect(screen.getByTestId('checkout-ending-credits-icon')).toBeVisible()
      expect(screen.queryByText(/balance/i)).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('checkout-ending-plan')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('checkout-ending-code')
      ).not.toBeInTheDocument()
    })

    it('77-3783: a top-up Success counts the credits added and what they cost, and names no plan', () => {
      renderEnding({
        kind: 'success',
        purchase: 'credits',
        receipt: { creditsAdded: 3165, amountChargedCents: 1500 }
      })

      expect(
        screen.getByRole('heading', { name: '3,165 credits added' })
      ).toBeInTheDocument()
      expect(
        screen.getByText('Credits for Acme Team have been successfully added.')
      ).toBeInTheDocument()
      expect(screen.getByTestId('checkout-ending-receipt')).toHaveTextContent(
        'Added+3,165Amount paid$15.00'
      )
      expect(screen.getByTestId('checkout-ending-credits-icon')).toBeVisible()
      expect(
        screen.queryByTestId('checkout-ending-plan')
      ).not.toBeInTheDocument()
    })

    it('a top-up Success the server has not counted yet claims no number', () => {
      renderEnding({ kind: 'success', purchase: 'credits' })

      expect(
        screen.getByRole('heading', { name: "You're all set" })
      ).toBeInTheDocument()
      expect(
        screen.getByText('Credits for Acme Team have been successfully added.')
      ).toBeInTheDocument()
      expect(
        screen.queryByTestId('checkout-ending-plan')
      ).not.toBeInTheDocument()
    })

    it('390-4947: Payment received confirms the payment and shows the credits still adding', () => {
      renderEnding({
        kind: 'received',
        code: 'op_r',
        receipt: { amountChargedCents: 3500, plan: RECEIPT_PLAN }
      })

      expect(screen.getByTestId('checkout-ending-receipt')).toHaveTextContent(
        'Payment$35.00Credits addedAdding…PlanPro'
      )
      expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
        'op_r'
      )
    })

    it('390-4947: a top-up still adding its credits names no plan', () => {
      renderEnding({
        kind: 'received',
        code: 'op_r',
        receipt: { amountChargedCents: 2500 }
      })

      expect(screen.getByTestId('checkout-ending-receipt')).toHaveTextContent(
        'Payment$25.00Credits addedAdding…'
      )
      expect(
        screen.queryByTestId('checkout-ending-credits-icon')
      ).not.toBeInTheDocument()
      expect(screen.queryByText('Plan')).not.toBeInTheDocument()
    })

    it('keeps Payment received card-less while the charge is not confirmed', () => {
      renderEnding({ kind: 'received', code: 'op_r' })

      expect(
        screen.queryByTestId('checkout-ending-receipt')
      ).not.toBeInTheDocument()
    })
  })

  it.for<{ ending: EndingScreen; action: Action; event: string }>([
    { ending: { kind: 'success' }, action: 'Close', event: 'close' },
    {
      ending: { kind: 'load_failed', cause: 'quote', code: 'REQUEST_FAILED' },
      action: 'Try again',
      event: 'retry'
    },
    {
      ending: { kind: 'load_failed', cause: 'recheck', code: 'REQUEST_FAILED' },
      action: 'Try again',
      event: 'retry'
    },
    {
      ending: { kind: 'plan_unavailable', code: 'PLAN_NOT_FOUND' },
      action: 'View plans',
      event: 'viewPlans'
    },
    {
      ending: { kind: 'link_invalid', code: 'CHECKOUT_LINK_INVALID' },
      action: 'Add credits',
      event: 'addCredits'
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

  it.for([
    {
      code: '3f2b9c1e-8a4d-4f6b-9c2e-7d1a5b8e0f43',
      pieces: ['3f2b9c1e-', '8a4d-', '4f6b-', '9c2e-', '7d1a5b8e0f43']
    },
    {
      code: 'SUBSCRIPTION_CHANGE_IN_PROGRESS',
      pieces: ['SUBSCRIPTION_', 'CHANGE_', 'IN_', 'PROGRESS']
    }
  ])(
    '372-4951: $code may wrap after each hyphen or underscore',
    ({ code, pieces }) => {
      renderEnding({ kind: 'in_progress', code })

      const shown = screen.getByTestId('checkout-ending-code')
      const breakable = Array.from(shown.childNodes)
        .map((node) =>
          node.nodeName === 'WBR'
            ? '|'
            : node.nodeType === Node.TEXT_NODE
              ? node.textContent
              : ''
        )
        .join('')
        .split('|')
      expect(breakable).toEqual(pieces)
    }
  )

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
