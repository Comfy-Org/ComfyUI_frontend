import { render, screen } from '@testing-library/vue'

import type { HandoffState } from '@/handoff/handoffTab'
import { handoffTab } from '@/handoff/handoffTab'
import { createBillingI18n } from '@/i18n'
import HandoffEndedView from '@/views/HandoffEndedView.vue'

function renderEnded(state: HandoffState) {
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
    { ending: 'session_ended', title: 'This checkout session has ended' }
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
