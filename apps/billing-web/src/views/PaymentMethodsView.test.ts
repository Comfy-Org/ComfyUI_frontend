import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'

import type { SavedPaymentMethod } from '@comfyorg/account-core/billing'
import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import { createFakeBillingClient } from '@/test/fakeBillingClient'
import PaymentMethodsView from '@/views/PaymentMethodsView.vue'

const SURFACE_PATH = '/v1/payment-methods'
const ENTRY_QUERY = 'product=comfyui&return_to=comfyui_workspace'

/** The default card is second, so picking it cannot be picking the first. */
const SAVED_CARDS: SavedPaymentMethod[] = [
  { brand: 'visa', id: 'pm_1', is_default: false, last4: '4242', type: 'card' },
  { brand: 'amex', id: 'pm_2', is_default: true, last4: '1881', type: 'card' },
  { id: 'pm_3', is_default: false, type: 'us_bank_account' }
]

async function renderPaymentMethods(query: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: SURFACE_PATH, component: PaymentMethodsView }]
  })
  const fake = createFakeBillingClient({
    paymentMethods: { status: 'ok', value: SAVED_CARDS }
  })
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

  it('lists the saved cards and marks the default one', async () => {
    await renderPaymentMethods(ENTRY_QUERY)

    expect(await screen.findByText('visa •••• 4242')).toBeInTheDocument()
    expect(screen.getByText('amex •••• 1881')).toBeInTheDocument()
    expect(screen.getAllByText('Default')).toHaveLength(1)
  })

  it('names a method with no brand or last four in our own copy', async () => {
    await renderPaymentMethods(ENTRY_QUERY)

    expect(await screen.findByText('Saved payment method')).toBeInTheDocument()
    expect(screen.queryByText('us_bank_account')).not.toBeInTheDocument()
  })

  it('sends the visitor to the portal it is given', async () => {
    const { assign } = stubNavigation()
    const fake = await renderPaymentMethods(ENTRY_QUERY)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Manage payment methods' })
    )

    expect(fake.openPaymentPortal).toHaveBeenCalledWith({
      returnUrl: expect.stringContaining('portal=return')
    })
    expect(assign).toHaveBeenCalledWith('https://billing.stripe.test/session')
  })

  it('re-reads the cards once on the way back and drops the marker', async () => {
    const fake = await renderPaymentMethods(`${ENTRY_QUERY}&portal=return`)

    await portalReturnHandled(fake.router)

    expect(fake.invalidatePaymentMethods).toHaveBeenCalledOnce()
    expect(fake.readPaymentMethods).toHaveBeenCalledOnce()
    expect(fake.router.currentRoute.value.fullPath).toBe(
      `${SURFACE_PATH}?${ENTRY_QUERY}`
    )
    expect(await screen.findByText('visa •••• 4242')).toBeInTheDocument()
  })
})
