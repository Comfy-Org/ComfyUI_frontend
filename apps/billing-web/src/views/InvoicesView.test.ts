import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import type { FakeBillingClientOptions } from '@/test/fakeBillingClient'
import { createFakeBillingClient } from '@/test/fakeBillingClient'
import InvoicesView from '@/views/InvoicesView.vue'

const INVOICES_PATH = '/v1/invoices?product=comfyui&return_to=comfyui_workspace'

function renderInvoices(options: FakeBillingClientOptions = {}) {
  recordBillingEntry(parseBillingEntry(INVOICES_PATH))
  const fake = createFakeBillingClient(options)
  render(InvoicesView, {
    global: {
      plugins: [createBillingI18n()],
      provide: { [BILLING_CLIENT_KEY]: fake.client }
    }
  })
  return fake
}

describe('InvoicesView', () => {
  it('sends the visitor to the portal with this page as the way back', async () => {
    const assign = vi.fn()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
    const fake = renderInvoices({ portalUrl: 'https://billing.stripe.test/p' })

    await userEvent.click(screen.getByRole('button', { name: 'Open invoices' }))

    expect(fake.openPaymentPortal).toHaveBeenCalledWith({
      returnUrl: window.location.href
    })
    expect(assign).toHaveBeenCalledWith('https://billing.stripe.test/p')
  })

  it('explains a portal it could not open in our own words', async () => {
    renderInvoices({ portal: { status: 'error', code: 'REQUEST_FAILED' } })

    await userEvent.click(screen.getByRole('button', { name: 'Open invoices' }))

    expect(
      await screen.findByText(
        "We couldn't reach the billing service. Please try again."
      )
    ).toBeInTheDocument()
  })
})
