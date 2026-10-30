import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import BillingInfoTip from '@/platform/billing/components/billingTab/BillingInfoTip.vue'

describe('BillingInfoTip', () => {
  it('names the button with its tooltip text', () => {
    render(BillingInfoTip, { props: { text: 'Plan credits are spent first.' } })

    expect(
      screen.getByRole('button', { name: 'Plan credits are spent first.' })
    ).toBeInTheDocument()
  })

  it('uses a separate label when one is given', () => {
    render(BillingInfoTip, {
      props: { text: 'Credits pay for runs.', label: 'About credits' }
    })

    expect(
      screen.getByRole('button', { name: 'About credits' })
    ).toBeInTheDocument()
  })
})
