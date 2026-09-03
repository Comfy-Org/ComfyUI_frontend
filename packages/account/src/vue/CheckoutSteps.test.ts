import { render, screen } from '@testing-library/vue'
import { expect, it } from 'vitest'
import { defaultBillingCopy } from '../core/index.js'
import type { BillingStep } from '../core/index.js'
import { CheckoutSteps } from './CheckoutSteps.js'

it.each<BillingStep>([
  'verifying',
  'canceled',
  'declined',
  'processing_error',
  'payment_received_hold'
])(
  'TP-10 PM-12: renders stakeholder state %s with canonical copy keys',
  (step) => {
    render(CheckoutSteps, { props: { step } })
    expect(
      screen
        .getByRole('region', { name: step })
        .getAttribute('data-billing-step')
    ).toBe(step)
    expect(screen.getByRole('heading').getAttribute('data-copy-key')).toBe(
      `billing.step.${step}.header`
    )
    expect(
      screen
        .getByText(defaultBillingCopy[`billing.step.${step}.body`])
        .getAttribute('data-copy-key')
    ).toBe(`billing.step.${step}.body`)
  }
)
