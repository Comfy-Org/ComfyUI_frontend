import userEvent from '@testing-library/user-event'
import { cleanup, render, screen, waitFor } from '@testing-library/vue'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { h } from 'vue'

import type {
  StripePaymentCopy,
  StripePaymentPhase
} from './stripePaymentPhase'
import StripePaymentForm from './StripePaymentForm.vue'

const stripeMocks = vi.hoisted(() => {
  const mount = vi.fn()
  const destroy = vi.fn()
  const on = vi.fn()
  const addressMount = vi.fn()
  const addressDestroy = vi.fn()
  const addressOn = vi.fn()
  const submit = vi.fn()
  const update = vi.fn()
  const paymentElement = { mount, destroy, on }
  const addressElement = {
    mount: addressMount,
    destroy: addressDestroy,
    on: addressOn
  }
  const create = vi.fn((type: string) =>
    type === 'address' ? addressElement : paymentElement
  )
  const elements = { submit, create, update }
  const createConfirmationToken = vi.fn()
  const stripe = {
    elements: vi.fn(() => elements),
    createConfirmationToken
  }
  return {
    mount,
    destroy,
    on,
    addressMount,
    addressDestroy,
    addressOn,
    submit,
    update,
    create,
    elements,
    createConfirmationToken,
    stripe,
    loadStripe: vi.fn(() => Promise.resolve(stripe))
  }
})

vi.mock<unknown>(import('@stripe/stripe-js/pure'), () => ({
  loadStripe: stripeMocks.loadStripe
}))

const COPY: StripePaymentCopy = {
  paymentMethod: 'Payment method',
  methodChoice: 'Choose a payment method',
  billingAddress: 'Billing address',
  alipayRenewalNote: 'Alipay renewal note',
  unavailable: 'Stripe is unavailable',
  genericError: 'Error'
}

/** What the host would send to its telemetry sink. */
let phaseEvents: StripePaymentPhase[] = []

function renderForm(
  amountCents = 66500,
  paymentMethodConfigurationId = 'pmc_test',
  props: {
    canSubmit?: boolean
    verificationPending?: boolean
    publishableKey?: string
    onConfirm?: (token: string) => void
    onSubmittingChange?: (submitting: boolean) => void
    container?: HTMLElement
  } = {}
) {
  const { publishableKey = 'pk_test_example', container, ...rest } = props
  return render(StripePaymentForm, {
    container,
    props: {
      publishableKey,
      amountCents,
      currency: 'usd',
      copy: COPY,
      paymentMethodConfigurationId,
      onPhase: (phase: StripePaymentPhase) => phaseEvents.push(phase),
      ...rest
    },
    // The host owns the pay action; this stands in for its button.
    slots: {
      submit: (slotProps: { disabled: boolean; loading: boolean }) =>
        h(
          'button',
          { type: 'submit', disabled: slotProps.disabled },
          'Pay and subscribe'
        )
    }
  })
}

describe('StripePaymentForm', () => {
  function fireStripeElementEvent(name: string, arg?: unknown) {
    const handler = stripeMocks.on.mock.calls.find(([event]) => event === name)
    handler?.[1]?.(arg)
  }

  function fireAddressElementEvent(name: string, arg?: unknown) {
    const handler = stripeMocks.addressOn.mock.calls.find(
      ([event]) => event === name
    )
    handler?.[1]?.(arg)
  }

  beforeEach(() => {
    phaseEvents = []
    stripeMocks.loadStripe.mockResolvedValue(stripeMocks.stripe)
    stripeMocks.stripe.elements.mockReturnValue(stripeMocks.elements)
    stripeMocks.create.mockImplementation((type: string) =>
      type === 'address'
        ? {
            mount: stripeMocks.addressMount,
            destroy: stripeMocks.addressDestroy,
            on: stripeMocks.addressOn
          }
        : {
            mount: stripeMocks.mount,
            destroy: stripeMocks.destroy,
            on: stripeMocks.on
          }
    )
    stripeMocks.submit.mockResolvedValue({})
    stripeMocks.update.mockResolvedValue(undefined)
    stripeMocks.createConfirmationToken.mockResolvedValue({
      confirmationToken: { id: 'ctoken_1' }
    })
  })

  afterEach(cleanup)

  it('leaves billing address collection to the Address Element alone', async () => {
    renderForm()
    await waitFor(() => expect(stripeMocks.mount).toHaveBeenCalled())

    // Two address forms in one group can disagree, and the one the issuer sees
    // would then contradict the one collected for AVS.
    expect(stripeMocks.create).toHaveBeenCalledWith(
      'payment',
      expect.objectContaining({
        fields: { billingDetails: { address: 'never' } }
      })
    )
    expect(stripeMocks.create).toHaveBeenCalledWith('address', {
      mode: 'billing'
    })
  })

  it('themes Stripe from the theme scope the form renders in, not the page body', async () => {
    document.body.style.setProperty('--base-foreground', 'rgb(20, 20, 20)')
    document.body.style.setProperty('--base-background', 'rgb(255, 255, 255)')
    const darkScope = document.createElement('div')
    darkScope.style.setProperty('--base-foreground', 'rgb(250, 250, 250)')
    darkScope.style.setProperty('--base-background', 'rgb(30, 30, 30)')
    document.body.append(darkScope)
    onTestFinished(() => {
      darkScope.remove()
      document.body.removeAttribute('style')
    })

    renderForm(66500, 'pmc_test', { container: darkScope })
    await waitFor(() => expect(stripeMocks.stripe.elements).toHaveBeenCalled())

    expect(stripeMocks.stripe.elements).toHaveBeenCalledWith(
      expect.objectContaining({
        appearance: expect.objectContaining({
          variables: expect.objectContaining({
            colorText: 'rgb(250, 250, 250)',
            colorBackground: 'rgb(30, 30, 30)'
          })
        })
      })
    )
  })

  describe('checkout journey instrumentation', () => {
    it('emits payment_element_ready on the ready callback for the live mount', async () => {
      renderForm()
      await waitFor(() => expect(stripeMocks.mount).toHaveBeenCalled())

      fireStripeElementEvent('ready')

      expect(phaseEvents).toContainEqual(
        expect.objectContaining({
          phase: 'payment_element_ready',
          element: 'payment'
        })
      )
    })

    it('distinguishes the address readiness from the payment element', async () => {
      renderForm()
      await waitFor(() =>
        expect(stripeMocks.addressMount).toHaveBeenCalledTimes(1)
      )

      fireStripeElementEvent('ready')
      fireAddressElementEvent('ready')

      const readyElements = phaseEvents
        .filter((event) => event.phase === 'payment_element_ready')
        .map((event) => event.element)
      expect(readyElements).toStrictEqual(['payment', 'address'])
    })

    it('reports a mount failure with a safe code from loaderror', async () => {
      renderForm()
      await waitFor(() => expect(stripeMocks.mount).toHaveBeenCalled())

      fireStripeElementEvent('loaderror', {
        error: { code: 'invalid_request' }
      })

      expect(phaseEvents).toContainEqual(
        expect.objectContaining({
          phase: 'payment_element_failed',
          element: 'payment',
          element_phase: 'mount',
          error_code: 'invalid_request'
        })
      )
    })

    it('reports an Address Element load failure as a mount failure', async () => {
      renderForm()
      await waitFor(() =>
        expect(stripeMocks.addressMount).toHaveBeenCalledTimes(1)
      )

      fireAddressElementEvent('loaderror', {
        error: { code: 'invalid_request' }
      })

      expect(phaseEvents).toContainEqual(
        expect.objectContaining({
          phase: 'payment_element_failed',
          element: 'address',
          element_phase: 'mount',
          error_code: 'invalid_request'
        })
      )
    })

    it('emits submit attempted before a validation failure', async () => {
      const user = userEvent.setup()
      stripeMocks.submit.mockResolvedValue({
        error: { code: 'incomplete_number', message: 'Card is incomplete' }
      })
      renderForm()
      await waitFor(() => expect(stripeMocks.mount).toHaveBeenCalled())

      await user.click(
        screen.getByRole('button', { name: 'Pay and subscribe' })
      )

      await waitFor(() =>
        expect(phaseEvents).toContainEqual(
          expect.objectContaining({
            phase: 'payment_submit_failed',
            submit_phase: 'validation',
            error_code: 'incomplete_number'
          })
        )
      )
      const phases = phaseEvents.map((event) => event.phase)
      expect(phases.indexOf('payment_submit_attempted')).toBeLessThan(
        phases.indexOf('payment_submit_failed')
      )
    })

    it('labels a rejected submit() as a validation failure', async () => {
      const user = userEvent.setup()
      stripeMocks.submit.mockRejectedValue(new Error('network'))
      renderForm()
      await waitFor(() => expect(stripeMocks.mount).toHaveBeenCalled())

      await user.click(
        screen.getByRole('button', { name: 'Pay and subscribe' })
      )

      await waitFor(() =>
        expect(phaseEvents).toContainEqual(
          expect.objectContaining({
            phase: 'payment_submit_failed',
            submit_phase: 'validation'
          })
        )
      )
      expect(stripeMocks.createConfirmationToken).not.toHaveBeenCalled()
    })

    it('suppresses a submit rejection that resolves after unmount', async () => {
      const user = userEvent.setup()
      let rejectSubmit: (reason: unknown) => void = () => {}
      stripeMocks.submit.mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectSubmit = reject
        })
      )
      const { unmount } = renderForm()
      await waitFor(() => expect(stripeMocks.mount).toHaveBeenCalled())

      await user.click(
        screen.getByRole('button', { name: 'Pay and subscribe' })
      )
      unmount()
      phaseEvents = []
      rejectSubmit(new Error('late'))
      await Promise.resolve()

      expect(phaseEvents).toStrictEqual([])
    })

    it('delivers neither confirm nor a settled submitting state to the host after unmount', async () => {
      const user = userEvent.setup()
      const confirmed: string[] = []
      const submitting: boolean[] = []
      let resolveToken: (value: unknown) => void = () => {}
      stripeMocks.createConfirmationToken.mockReturnValue(
        new Promise((resolve) => {
          resolveToken = resolve
        })
      )
      const { unmount } = renderForm(66500, 'pmc_test', {
        onConfirm: (token: string) => confirmed.push(token),
        onSubmittingChange: (value: boolean) => submitting.push(value)
      })
      await waitFor(() => expect(stripeMocks.mount).toHaveBeenCalled())

      await user.click(
        screen.getByRole('button', { name: 'Pay and subscribe' })
      )
      unmount()
      resolveToken({ confirmationToken: { id: 'ctoken_late' } })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(confirmed).toStrictEqual([])
      expect(submitting).toStrictEqual([true])
    })

    it('does not leak an element event after unmount', async () => {
      const { unmount } = renderForm()
      await waitFor(() => expect(stripeMocks.mount).toHaveBeenCalled())
      unmount()
      phaseEvents = []

      fireStripeElementEvent('ready')

      expect(phaseEvents).toStrictEqual([])
    })
  })

  it('collects deferred subscription details and emits a confirmation token', async () => {
    const user = userEvent.setup()
    const { emitted } = renderForm()

    await waitFor(() => {
      expect(stripeMocks.stripe.elements).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          amount: 66500,
          currency: 'usd',
          setupFutureUsage: 'off_session',
          paymentMethodConfiguration: 'pmc_test'
        })
      )
    })
    expect(stripeMocks.create).toHaveBeenCalledWith('payment', {
      layout: {
        type: 'accordion',
        defaultCollapsed: false,
        radios: 'always',
        spacedAccordionItems: true
      },
      fields: { billingDetails: { address: 'never' } },
      terms: { card: 'never' }
    })
    expect(stripeMocks.mount).toHaveBeenCalledTimes(1)

    await user.click(
      screen.getByRole('button', {
        name: 'Pay and subscribe'
      })
    )

    expect(stripeMocks.submit).toHaveBeenCalledTimes(1)
    expect(stripeMocks.createConfirmationToken).toHaveBeenCalledWith({
      elements: stripeMocks.elements
    })
    expect(emitted().confirm).toEqual([['ctoken_1']])
  })

  it('collects a billing address alongside the payment element', async () => {
    renderForm()

    await waitFor(() =>
      expect(stripeMocks.create).toHaveBeenCalledWith('address', {
        mode: 'billing'
      })
    )
    expect(stripeMocks.addressMount).toHaveBeenCalledTimes(1)
  })

  it('blocks submission until the billing address is valid', async () => {
    const user = userEvent.setup()
    stripeMocks.submit.mockResolvedValue({
      error: { code: 'incomplete_address', message: 'Enter your address' }
    })
    const { emitted } = renderForm()

    await waitFor(() =>
      expect(stripeMocks.addressMount).toHaveBeenCalledTimes(1)
    )
    await user.click(screen.getByRole('button', { name: 'Pay and subscribe' }))

    expect(await screen.findByText('Enter your address')).toBeTruthy()
    expect(stripeMocks.createConfirmationToken).not.toHaveBeenCalled()
    expect(emitted().confirm).toBeUndefined()
  })

  it('keeps the customer in the form when Stripe rejects its contents', async () => {
    const user = userEvent.setup()
    stripeMocks.submit.mockResolvedValue({
      error: { message: 'Payment details are incomplete' }
    })
    const { emitted } = renderForm()

    await waitFor(() => expect(stripeMocks.mount).toHaveBeenCalledTimes(1))
    await user.click(
      screen.getByRole('button', {
        name: 'Pay and subscribe'
      })
    )

    expect(
      await screen.findByText('Payment details are incomplete')
    ).toBeTruthy()
    expect(stripeMocks.createConfirmationToken).not.toHaveBeenCalled()
    expect(emitted().confirm).toBeUndefined()
  })

  it('shows Stripe confirmation-token errors without leaving the form', async () => {
    const user = userEvent.setup()
    stripeMocks.createConfirmationToken.mockResolvedValue({
      error: { message: 'Your card was declined.' }
    })
    const { emitted } = renderForm()

    await waitFor(() => expect(stripeMocks.mount).toHaveBeenCalledTimes(1))
    await user.click(
      screen.getByRole('button', {
        name: 'Pay and subscribe'
      })
    )

    expect(await screen.findByText('Your card was declined.')).toBeTruthy()
    expect(emitted().confirm).toBeUndefined()
  })

  it.for([
    {
      description: 'the quote cannot be submitted',
      props: { canSubmit: false }
    },
    {
      description: 'verification is pending',
      props: { verificationPending: true }
    }
  ])('blocks paying when $description', async ({ props }) => {
    renderForm(66500, 'pmc_test', props)
    await waitFor(() => expect(stripeMocks.mount).toHaveBeenCalledTimes(1))

    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Pay and subscribe'
      }).disabled
    ).toBe(true)
  })

  it('shows unavailable state when Stripe configuration is missing', async () => {
    renderForm(66500, 'pmc_test', { publishableKey: '' })

    expect(await screen.findByText('Stripe is unavailable')).toBeTruthy()
    expect(stripeMocks.loadStripe).not.toHaveBeenCalled()
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Pay and subscribe'
      }).disabled
    ).toBe(true)
  })

  it('shows unavailable state when Stripe fails to load', async () => {
    stripeMocks.loadStripe.mockRejectedValue(new Error('load failed'))

    renderForm()

    expect(await screen.findByText('Stripe is unavailable')).toBeTruthy()
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Pay and subscribe'
      }).disabled
    ).toBe(true)
  })

  it('updates Stripe Elements when the quote changes', async () => {
    const { rerender } = renderForm()
    await waitFor(() => expect(stripeMocks.mount).toHaveBeenCalledTimes(1))

    await rerender({ amountCents: 72000, currency: 'EUR' })

    expect(stripeMocks.update).toHaveBeenCalledWith({
      amount: 72000,
      currency: 'eur'
    })
  })

  it('destroys the Stripe elements when the preview unmounts', async () => {
    const { unmount } = renderForm()
    await waitFor(() =>
      expect(stripeMocks.addressMount).toHaveBeenCalledTimes(1)
    )

    unmount()

    expect(stripeMocks.destroy).toHaveBeenCalledTimes(1)
    expect(stripeMocks.addressDestroy).toHaveBeenCalledTimes(1)
  })
})

describe('StripePaymentForm payment method configuration', () => {
  beforeEach(() => {
    phaseEvents = []
    stripeMocks.loadStripe.mockResolvedValue(stripeMocks.stripe)
    stripeMocks.stripe.elements.mockReturnValue(stripeMocks.elements)
    stripeMocks.create.mockImplementation((type: string) =>
      type === 'address'
        ? {
            mount: stripeMocks.addressMount,
            destroy: stripeMocks.addressDestroy,
            on: stripeMocks.addressOn
          }
        : {
            mount: stripeMocks.mount,
            destroy: stripeMocks.destroy,
            on: stripeMocks.on
          }
    )
  })

  it('mounts against the served configuration instead of a hardcoded method list', async () => {
    renderForm(66500, 'pmc_environment')

    await waitFor(() => {
      expect(stripeMocks.stripe.elements).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethodConfiguration: 'pmc_environment'
        })
      )
    })
    expect(stripeMocks.stripe.elements).not.toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethodTypes: expect.anything() })
    )
  })

  it('does not initialize Stripe when the backend configuration is absent', async () => {
    renderForm(66500, '')

    expect(await screen.findByText('Stripe is unavailable')).toBeTruthy()
    expect(stripeMocks.loadStripe).not.toHaveBeenCalled()
    expect(stripeMocks.stripe.elements).not.toHaveBeenCalled()
  })
})
