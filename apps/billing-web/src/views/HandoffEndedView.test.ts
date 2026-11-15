import { render, screen } from '@testing-library/vue'

import type { HandoffState } from '@/handoff/handoffTab'
import { handoffTab } from '@/handoff/handoffTab'
import { createBillingI18n } from '@/i18n'
import HandoffEndedView from '@/views/HandoffEndedView.vue'

function renderEnded(state: HandoffState | undefined) {
  handoffTab.value = state
  return render(HandoffEndedView, {
    global: { plugins: [createBillingI18n()] }
  })
}

const LINK = 'This checkout link no longer works'

describe('HandoffEndedView', () => {
  afterEach(() => {
    handoffTab.value = undefined
  })

  it.for([
    { ending: 'link_unavailable', title: LINK },
    { ending: 'exchange_lost', title: LINK },
    { ending: 'refused', title: LINK },
    {
      ending: 'storage_unavailable',
      title: "Checkout can't open in this browser"
    },
    { ending: 'unconfirmed', title: "We couldn't confirm your payment" }
  ] as const)(
    'explains $ending without offering a sign-in or a retry',
    ({ ending, title }) => {
      renderEnded({ kind: 'ended', ending })

      expect(screen.getByRole('heading', { name: title })).toBeVisible()
      expect(screen.queryByRole('button')).toBeNull()
      expect(
        screen.getByRole('link', { name: 'Contact support' })
      ).toHaveAttribute('href', expect.stringMatching(/^mailto:/))
    }
  )

  it('says a payment went through, for which workspace and under which reference, without a button that needs the session', () => {
    renderEnded({
      kind: 'ended',
      ending: 'completed',
      workspace: 'Studio',
      reference: 'op-7'
    })

    expect(
      screen.getByRole('heading', { name: "You're all set" })
    ).toBeVisible()
    expect(
      screen.getByText(/A payment for Studio went through\./)
    ).toBeVisible()
    expect(screen.getByText('Your reference for this payment:')).toBeVisible()
    expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent('op-7')
    expect(screen.getByText('You can close this tab.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    expect(screen.queryByText(/Nothing was charged/)).toBeNull()
  })

  it.for<{ name: string; state: HandoffState | undefined }>([
    {
      name: 'a session that may have charged',
      state: { kind: 'ended', ending: 'unconfirmed' }
    },
    { name: 'a tab that has not recorded how it ended', state: undefined }
  ])(
    'warns against paying again for $name, claiming neither a charge nor its absence',
    ({ state }) => {
      renderEnded(state)

      expect(
        screen.getByRole('heading', {
          name: "We couldn't confirm your payment"
        })
      ).toBeVisible()
      expect(screen.getByText(/Don't pay again yet/)).toBeVisible()
      expect(screen.getByText('You can close this tab.')).toBeVisible()
      expect(screen.queryByText(/Nothing was charged/)).toBeNull()
      expect(screen.queryByText(/automatically update/)).toBeNull()
      expect(screen.queryByTestId('checkout-ending-code')).toBeNull()
    }
  )

  it('asks the customer not to pay again and names the payment for support', () => {
    renderEnded({
      kind: 'ended',
      ending: 'payment_pending',
      reference: 'op-7'
    })

    expect(
      screen.getByRole('heading', { name: 'Checking your payment' })
    ).toBeVisible()
    expect(screen.getByText(/Don't pay again while we check/)).toBeVisible()
    expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent('op-7')
    expect(
      screen.getByRole('link', { name: 'Contact support' })
    ).toHaveAttribute('href', expect.stringContaining('Reference%3A%20op-7'))
  })

  it('still asks the customer not to pay again when the payment reference was lost', () => {
    renderEnded({ kind: 'ended', ending: 'payment_pending' })

    expect(
      screen.getByRole('heading', { name: 'Checking your payment' })
    ).toBeVisible()
    expect(screen.queryByTestId('checkout-ending-code')).toBeNull()
  })
})
