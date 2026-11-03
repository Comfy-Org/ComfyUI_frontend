import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import type { FakeBillingClientOptions } from '@/test/fakeBillingClient'
import { createFakeBillingClient } from '@/test/fakeBillingClient'
import { trackedBillingEvents } from '@/test/trackedBillingEvents'
import InvoicesView from '@/views/InvoicesView.vue'

const SURFACE_PATH = '/v1/invoices'
const INVOICES_PATH = `${SURFACE_PATH}?product=comfyui&return_to=comfyui_workspace`

async function renderInvoices(
  options: FakeBillingClientOptions = {},
  path = INVOICES_PATH
) {
  recordBillingEntry(parseBillingEntry(INVOICES_PATH))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: SURFACE_PATH, component: InvoicesView }]
  })
  await router.push(path)
  await router.isReady()
  const fake = createFakeBillingClient(options)
  render(InvoicesView, {
    global: {
      plugins: [createBillingI18n(), router],
      provide: { [BILLING_CLIENT_KEY]: fake.client }
    }
  })
  return { ...fake, router }
}

describe('InvoicesView', () => {
  it('sends the visitor to the portal with this page as the way back', async () => {
    const assign = vi.fn()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
    const fake = await renderInvoices({
      portalUrl: 'https://billing.stripe.test/p'
    })

    await userEvent.click(screen.getByRole('button', { name: 'Open invoices' }))

    expect(fake.openPaymentPortal).toHaveBeenCalledWith({
      returnUrl: expect.stringContaining('portal=return')
    })
    expect(assign).toHaveBeenCalledWith('https://billing.stripe.test/p')
  })

  it('reports the portal opening on the invoices', async () => {
    vi.spyOn(window.location, 'assign').mockImplementation(() => undefined)
    const sent = trackedBillingEvents()
    await renderInvoices({ portalUrl: 'https://billing.stripe.test/p' })

    await userEvent.click(screen.getByRole('button', { name: 'Open invoices' }))

    expect(sent()).toEqual([
      {
        operation: 'portal',
        stage: 'opened',
        outcome: 'pending',
        target: 'invoices',
        billing_client: 'sdk'
      }
    ])
  })

  it('reports the return from the portal once and drops the marker', async () => {
    const sent = trackedBillingEvents()
    const { router } = await renderInvoices(
      {},
      `${INVOICES_PATH}&portal=return`
    )

    await vi.waitFor(() => {
      expect(router.currentRoute.value.fullPath).toBe(INVOICES_PATH)
    })
    expect(sent()).toEqual([
      {
        operation: 'portal',
        stage: 'returned',
        outcome: 'pending',
        target: 'invoices',
        billing_client: 'sdk'
      }
    ])
  })

  it.for<{
    name: string
    portal: FakeBillingClientOptions['portal']
    failure: Record<string, string>
  }>([
    {
      name: 'a request that never reached the server',
      portal: { status: 'error', code: 'REQUEST_FAILED' },
      failure: { failure_category: 'network' }
    },
    {
      name: 'a refusal from the server',
      portal: { status: 'error', code: 'ACCESS_DENIED', httpStatus: 403 },
      failure: { failure_category: 'api_rejected' }
    },
    {
      name: 'a portal address that fails validation',
      portal: { status: 'error', code: 'MALFORMED_RESPONSE', httpStatus: 200 },
      failure: { failure_category: 'unknown' }
    }
  ])('reports $name as a failed portal open', async ({ portal, failure }) => {
    const sent = trackedBillingEvents()
    await renderInvoices({ portal })

    await userEvent.click(screen.getByRole('button', { name: 'Open invoices' }))

    await vi.waitFor(() => {
      expect(sent()).toEqual([
        {
          operation: 'portal',
          stage: 'failed',
          outcome: 'failure',
          target: 'invoices',
          billing_client: 'sdk',
          ...failure
        }
      ])
    })
  })

  it('explains a portal it could not open in our own words', async () => {
    await renderInvoices({
      portal: { status: 'error', code: 'REQUEST_FAILED' }
    })

    await userEvent.click(screen.getByRole('button', { name: 'Open invoices' }))

    expect(
      await screen.findByText(
        "We couldn't reach the billing service. Please try again."
      )
    ).toBeInTheDocument()
  })
})
