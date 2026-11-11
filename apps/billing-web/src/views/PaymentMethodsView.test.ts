import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'

import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import { createFakeBillingClient } from '@/test/fakeBillingClient'
import type { FakeBillingClientOptions } from '@/test/fakeBillingClient'
import { trackedBillingEvents } from '@/test/trackedBillingEvents'
import PaymentMethodsView from '@/views/PaymentMethodsView.vue'

const SURFACE_PATH = '/v1/payment-methods'
const ENTRY_QUERY = 'product=comfyui&return_to=comfyui_workspace'
const PORTAL_URL = 'https://billing.stripe.test/session'

async function renderPaymentMethods(
  query: string,
  options: FakeBillingClientOptions = {}
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: SURFACE_PATH, component: PaymentMethodsView }]
  })
  const fake = createFakeBillingClient(options)
  await router.push(`${SURFACE_PATH}?${query}`)
  await router.isReady()
  render(PaymentMethodsView, {
    global: {
      plugins: [createBillingI18n(), router],
      provide: { [BILLING_CLIENT_KEY]: fake.client }
    }
  })
  return { ...fake, router }
}

function stubNavigation(): { assign: ReturnType<typeof vi.fn> } {
  const assign = vi.fn()
  vi.spyOn(window.location, 'assign').mockImplementation(assign)
  return { assign }
}

/** The marker is stripped by a replace, so its absence is the readiness signal. */
async function portalReturnHandled(router: Router) {
  await vi.waitFor(() => {
    expect(router.currentRoute.value.query.portal).toBeUndefined()
  })
}

describe('PaymentMethodsView', () => {
  beforeEach(() => {
    recordBillingEntry(parseBillingEntry(`${SURFACE_PATH}?${ENTRY_QUERY}`))
  })

  it('hands the visitor to the portal as soon as the page opens', async () => {
    const { assign } = stubNavigation()
    const fake = await renderPaymentMethods(ENTRY_QUERY)

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith(PORTAL_URL))
    expect(fake.openPaymentPortal).toHaveBeenCalledWith({
      returnUrl: expect.stringContaining('portal=return')
    })
    expect(fake.readPaymentMethods).not.toHaveBeenCalled()
  })

  it('stays on the page after the portal sends the visitor back', async () => {
    const fake = await renderPaymentMethods(`${ENTRY_QUERY}&portal=return`)

    await portalReturnHandled(fake.router)

    expect(fake.openPaymentPortal).not.toHaveBeenCalled()
    expect(fake.router.currentRoute.value.fullPath).toBe(
      `${SURFACE_PATH}?${ENTRY_QUERY}`
    )
    expect(
      screen.getByRole('button', { name: 'Manage payment methods' })
    ).toBeInTheDocument()
  })

  it('reopens the portal from the button after a return', async () => {
    const { assign } = stubNavigation()
    const fake = await renderPaymentMethods(`${ENTRY_QUERY}&portal=return`)
    await portalReturnHandled(fake.router)

    await userEvent.click(
      screen.getByRole('button', { name: 'Manage payment methods' })
    )

    expect(assign).toHaveBeenCalledWith(PORTAL_URL)
  })

  it('explains a portal it could not open and offers to try again', async () => {
    await renderPaymentMethods(ENTRY_QUERY, {
      portal: { status: 'error', code: 'NOT_FOUND', httpStatus: 404 }
    })

    expect(
      await screen.findByText("We couldn't find that billing record.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Manage payment methods' })
    ).toBeInTheDocument()
    expect(screen.queryByText('Opening your payment methods…')).toBeNull()
  })

  describe('portal telemetry', () => {
    it('reports the portal opening on the payment methods', async () => {
      const { assign } = stubNavigation()
      const sent = trackedBillingEvents()
      await renderPaymentMethods(ENTRY_QUERY)

      await vi.waitFor(() => expect(assign).toHaveBeenCalled())

      expect(sent()).toEqual([
        {
          operation: 'portal',
          stage: 'opened',
          outcome: 'pending',
          target: 'payment_methods',
          billing_client: 'sdk'
        }
      ])
    })

    it('reports a portal it could not open as a failed open', async () => {
      const sent = trackedBillingEvents()
      await renderPaymentMethods(ENTRY_QUERY, {
        portal: { status: 'error', code: 'NOT_FOUND', httpStatus: 404 }
      })

      await vi.waitFor(() => {
        expect(sent()).toEqual([
          {
            operation: 'portal',
            stage: 'failed',
            outcome: 'failure',
            target: 'payment_methods',
            billing_client: 'sdk',
            failure_category: 'api_rejected'
          }
        ])
      })
    })

    it('reports the return from the portal once', async () => {
      const sent = trackedBillingEvents()
      const fake = await renderPaymentMethods(`${ENTRY_QUERY}&portal=return`)

      await portalReturnHandled(fake.router)

      expect(sent()).toEqual([
        {
          operation: 'portal',
          stage: 'returned',
          outcome: 'pending',
          target: 'payment_methods',
          billing_client: 'sdk'
        }
      ])
    })
  })
})
