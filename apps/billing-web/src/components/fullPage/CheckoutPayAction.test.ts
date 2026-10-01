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
const buttonNames = () =>
  screen.getAllByRole('button').map((button) => button.textContent.trim())

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
      buttons: ['Pay and subscribe']
    },
    {
      name: 'a Pay the bank has not answered yet',
      phase: { kind: 'unknown' },
      canCancel: true,
      line: '',
      buttons: ['Pay and subscribe']
    },
    {
      name: 'a charge processing',
      phase: { kind: 'processing' },
      canCancel: true,
      line: "This payment is already processing and can't be canceled.",
      buttons: ['Pay and subscribe']
    },
    {
      name: 'a challenge the customer can reopen',
      phase: { kind: 'challenge', operation: challenge('required') },
      canCancel: false,
      line: 'Nothing has been charged yet.',
      buttons: ['Complete verification']
    },
    {
      name: 'a challenge this tab is showing',
      phase: { kind: 'challenge', operation: challenge('in_progress') },
      canCancel: false,
      line: 'Nothing has been charged yet.',
      buttons: ['Pay and subscribe']
    },
    {
      name: 'a reopenable challenge once the server can cancel it',
      phase: { kind: 'challenge', operation: challenge('required') },
      canCancel: true,
      line: 'Nothing has been charged yet.',
      buttons: ['Complete verification', 'Cancel payment']
    },
    {
      name: 'a challenge on screen once the server can cancel it',
      phase: { kind: 'challenge', operation: challenge('in_progress') },
      canCancel: true,
      line: 'Nothing has been charged yet.',
      buttons: ['Pay and subscribe', 'Cancel payment']
    },
    {
      name: 'an Alipay redirect',
      phase: { kind: 'redirecting', method: 'alipay' },
      canCancel: true,
      line: 'Taking you to Alipay to finish paying. Nothing has been charged yet.',
      buttons: ['Pay and subscribe']
    },
    {
      name: 'a redirect to a method with no name',
      phase: { kind: 'redirecting', method: 'klarna' },
      canCancel: true,
      line: 'Taking you to your payment provider to finish paying. Nothing has been charged yet.',
      buttons: ['Pay and subscribe']
    }
  ])(
    'shows $name with its line and buttons',
    ({ phase, canCancel, line, buttons }) => {
      renderPayAction({ phase, canCancel })

      expect(footnote().textContent.trim()).toBe(line)
      expect(buttonNames()).toEqual(buttons)
    }
  )

  it('keeps Complete verification live while the page is locked', async () => {
    const onContinueVerification = vi.fn()
    renderPayAction({
      phase: { kind: 'challenge', operation: challenge('required') },
      disabled: true,
      loading: true,
      onContinueVerification
    })

    const complete = screen.getByRole('button', {
      name: 'Complete verification'
    })
    expect(complete).toBeEnabled()
    await userEvent.click(complete)

    expect(onContinueVerification).toHaveBeenCalledOnce()
  })

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

  it('180-6679: buys credits with a bare Pay, authorizing one charge and linking the terms', () => {
    render(CheckoutPayAction, {
      props: { disabled: false, purchase: 'credits' },
      global: { plugins: [createBillingI18n()] }
    })

    expect(screen.getByRole('button', { name: 'Pay' })).toBeInTheDocument()
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent.trim() ===
            "By continuing, you agree to Comfy Org's Terms and Privacy Policy, and authorize Comfy Org to charge your payment method once for this purchase."
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute(
      'href',
      'https://comfy.org/terms-of-service/'
    )
    expect(
      screen.getByRole('link', { name: 'Privacy Policy' })
    ).toHaveAttribute('href', 'https://comfy.org/privacy-policy/')
  })
})
