import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import type { PaymentProjection } from '@comfyorg/account-core/billing'
import { DEFAULT_PAYMENT_COPY } from '@comfyorg/account-core/billing'

import CheckoutSteps from './CheckoutSteps.vue'

function projection(
  overrides: Partial<PaymentProjection> & Pick<PaymentProjection, 'step'>
): PaymentProjection {
  return { noChargeConfirmed: false, ...overrides }
}

describe('CheckoutSteps', () => {
  it('renders the approved copy for the projection, host overrides by key, and the class props', () => {
    render(CheckoutSteps, {
      props: {
        projection: projection({
          step: 'declined',
          reasonKey: 'card_declined',
          operationId: 'op-1'
        }),
        copy: { 'billing.step.declined.header': 'Zahlung abgelehnt' },
        rootClass: 'host-root'
      }
    })

    const region = screen.getByRole('region', { name: 'Zahlung abgelehnt' })
    expect(region.classList.contains('host-root')).toBe(true)
    expect(
      screen.getByText(DEFAULT_PAYMENT_COPY['billing.step.declined.body'])
    ).toBeTruthy()
    expect(
      screen.getByText(DEFAULT_PAYMENT_COPY['billing.reason.card_declined'])
    ).toBeTruthy()
  })

  it('shows the safety line only when the projection confirms it, and never a host version of it', async () => {
    const { rerender } = render(CheckoutSteps, {
      props: {
        projection: projection({ step: 'canceled' }),
        copy: { 'billing.safety.nothing_was_charged': 'Relax, no charge.' }
      }
    })
    expect(screen.queryByText(/charge/)).toBeNull()

    await rerender({
      projection: projection({ step: 'canceled', noChargeConfirmed: true })
    })

    expect(
      screen.getByText(
        DEFAULT_PAYMENT_COPY['billing.safety.nothing_was_charged']
      )
    ).toBeTruthy()
    expect(screen.queryByText('Relax, no charge.')).toBeNull()
  })

  it.for([
    ['verifying', 'Continue verification', 'continue-verification'],
    ['processing_error', 'Try again', 'retry']
  ] as const)(
    'offers %s the "%s" action and emits %s',
    async ([step, label, event]) => {
      const { emitted } = render(CheckoutSteps, {
        props: { projection: projection({ step }) }
      })

      await userEvent.click(screen.getByRole('button', { name: label }))

      expect(emitted(event)).toHaveLength(1)
    }
  )

  it('offers no action on success, and none fires while disabled', async () => {
    render(CheckoutSteps, {
      props: { projection: projection({ step: 'success' }) }
    })
    expect(screen.queryByRole('button')).toBeNull()

    const { emitted } = render(CheckoutSteps, {
      props: { projection: projection({ step: 'declined' }), disabled: true }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(emitted('retry')).toBeUndefined()
  })

  it('keeps host-rendered actions from firing while disabled', async () => {
    const { emitted } = render(CheckoutSteps, {
      props: { projection: projection({ step: 'verifying' }), disabled: true },
      slots: {
        actions: (scope: {
          cancel: () => void
          continueVerification: () => void
        }) => [
          h('button', { onClick: scope.cancel }, 'Back'),
          h('button', { onClick: scope.continueVerification }, 'Go')
        ]
      }
    })

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))

    expect(emitted('cancel')).toBeUndefined()
    expect(emitted('continue-verification')).toBeUndefined()
  })

  it('names the region after the heading on screen, including one the host renders', () => {
    render(CheckoutSteps, {
      props: { projection: projection({ step: 'canceled' }) },
      slots: {
        header: (scope: { headerId: string }) =>
          h('h2', { id: scope.headerId }, 'Checkout cancelled by you')
      }
    })

    expect(
      screen.getByRole('region', { name: 'Checkout cancelled by you' })
    ).toBeTruthy()
    expect(
      screen.queryByRole('region', {
        name: DEFAULT_PAYMENT_COPY['billing.step.canceled.header']
      }),
      'the region must not be named after copy that is no longer on screen'
    ).toBeNull()
  })

  it('gives the actions slot the projection and the callbacks so a host lays out its own controls', async () => {
    const { emitted } = render(CheckoutSteps, {
      props: { projection: projection({ step: 'verifying' }) },
      slots: {
        actions: (scope: {
          projection: PaymentProjection
          cancel: () => void
          continueVerification: () => void
        }) => [
          h(
            'button',
            { onClick: scope.cancel },
            `Back from ${scope.projection.step}`
          ),
          h('button', { onClick: scope.continueVerification }, 'Go')
        ]
      }
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Back from verifying' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))

    expect(emitted('cancel')).toHaveLength(1)
    expect(emitted('continue-verification')).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: 'Continue verification' }),
      'the default actions yield to the slot'
    ).toBeNull()
  })
})
