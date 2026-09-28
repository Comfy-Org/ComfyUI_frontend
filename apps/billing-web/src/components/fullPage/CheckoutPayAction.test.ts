import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'

import type { PendingBillingOperation } from '@comfyorg/account-core/billing'

import type { SubmitPhase } from '@/checkout/checkoutPage'
import CheckoutPayAction from '@/components/fullPage/CheckoutPayAction.vue'
import { createBillingI18n } from '@/i18n'
import { pendingOperation } from '@/test/fakeBillingClient'

const challenge = (
  status: 'required' | 'in_progress'
): PendingBillingOperation => ({
  ...pendingOperation('op_3ds'),
  authenticationState: 'requires_action',
  challenge: { clientSecret: 'cs', status }
})

function renderPayAction(
  props: {
    phase?: SubmitPhase
    canCancel?: boolean
    loading?: boolean
    disabled?: boolean
    onCancel?: () => void
    onContinueVerification?: () => void
  } = {}
) {
  return render(CheckoutPayAction, {
    props: { disabled: false, ...props },
    global: { plugins: [createBillingI18n()] }
  })
}

const footnote = () => screen.getByTestId('checkout-phase-footnote')
const ghostButtons = () =>
  screen
    .getAllByRole('button')
    .map((button) => button.textContent.trim())
    .filter((name) => name !== 'Pay and subscribe')

describe('CheckoutPayAction', () => {
  it.for<{
    name: string
    phase: SubmitPhase
    canCancel: boolean
    line: string
    buttons: string[]
  }>([
    {
      name: 'Pay at rest',
      phase: { kind: 'capture' },
      canCancel: true,
      line: '',
      buttons: []
    },
    {
      name: 'a charge processing',
      phase: { kind: 'processing' },
      canCancel: true,
      line: "This payment is already processing and can't be canceled.",
      buttons: []
    },
    {
      name: 'a challenge the customer can reopen',
      phase: { kind: 'challenge', operation: challenge('required') },
      canCancel: false,
      line: 'Nothing has been charged yet.',
      buttons: ['Continue verification']
    },
    {
      name: 'a challenge this tab is showing',
      phase: { kind: 'challenge', operation: challenge('in_progress') },
      canCancel: false,
      line: 'Nothing has been charged yet.',
      buttons: []
    },
    {
      name: 'a challenge once the server can cancel it',
      phase: { kind: 'challenge', operation: challenge('required') },
      canCancel: true,
      line: 'Nothing has been charged yet.',
      buttons: ['Continue verification', 'Cancel payment']
    },
    {
      name: 'an Alipay redirect',
      phase: { kind: 'redirecting', method: 'alipay' },
      canCancel: true,
      line: 'Taking you to Alipay to finish paying. Nothing has been charged yet.',
      buttons: []
    },
    {
      name: 'a redirect to a method with no name',
      phase: { kind: 'redirecting', method: 'klarna' },
      canCancel: true,
      line: 'Taking you to your payment provider to finish paying. Nothing has been charged yet.',
      buttons: []
    }
  ])(
    'shows $name with its line and ghost buttons',
    ({ phase, canCancel, line, buttons }) => {
      renderPayAction({ phase, canCancel })

      expect(footnote().textContent.trim()).toBe(line)
      expect(ghostButtons()).toEqual(buttons)
    }
  )

  it('keeps an empty polite status region mounted at rest', () => {
    renderPayAction({ phase: { kind: 'capture' } })

    const region = screen.getByRole('status')
    expect(region).toBe(footnote())
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toBeEmptyDOMElement()
  })

  it('leaves the live region to the visible pay action when given no phase', () => {
    renderPayAction()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('emits cancel from Cancel payment', async () => {
    const onCancel = vi.fn()
    renderPayAction({
      phase: { kind: 'challenge', operation: challenge('in_progress') },
      canCancel: true,
      onCancel
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Cancel payment' })
    )

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('emits continueVerification from Continue verification', async () => {
    const onContinueVerification = vi.fn()
    renderPayAction({
      phase: { kind: 'challenge', operation: challenge('required') },
      onContinueVerification
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Continue verification' })
    )

    expect(onContinueVerification).toHaveBeenCalledOnce()
  })

  it.for<{ name: string; loading: boolean; disabled: boolean; busy: string }>([
    { name: 'while loading', loading: true, disabled: true, busy: 'true' },
    { name: 'at rest', loading: false, disabled: false, busy: 'false' }
  ])(
    'marks Pay busy and disabled only $name',
    ({ loading, disabled, busy }) => {
      renderPayAction({ loading })

      const pay = screen.getByRole('button', { name: 'Pay and subscribe' })
      expect(pay).toHaveAttribute('aria-busy', busy)
      expect(pay).toHaveProperty('disabled', disabled)
    }
  )
})
