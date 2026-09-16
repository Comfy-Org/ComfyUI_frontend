import { render, screen } from '@testing-library/vue'
import { createMemoryHistory } from 'vue-router'
import type { Router } from 'vue-router'

import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'

import App from '@/App.vue'
import { safeReturnTo } from '@/auth/returnTo'
import { recordBillingEntry, useBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import { createBillingRouter } from '@/router'
import type { BillingWebSessionPhase } from '@/router'
import { createFakeBillingClient } from '@/test/fakeBillingClient'

const ENTRY_QUERY = 'product=comfyui&return_to=comfyui_workspace'

beforeEach(() => {
  recordBillingEntry(undefined)
})

function routerAt(phase: BillingWebSessionPhase) {
  return createBillingRouter(createMemoryHistory(), () => phase)
}

async function arriveAt(path: string): Promise<Router> {
  const router = routerAt('authenticated')
  await router.push(path)
  await router.isReady()
  const { client } = createFakeBillingClient()
  render(App, {
    global: {
      plugins: [createBillingI18n(), router],
      provide: { [BILLING_CLIENT_KEY]: client }
    }
  })
  return router
}

describe('the billing route guard', () => {
  it.for(['pending', 'signed-out', 'minting', 'error'] as const)(
    'sends a %s visitor to sign-in with the path to come back to',
    async (phase) => {
      const router = routerAt(phase)

      await router.push('/')

      expect(router.currentRoute.value.path).toBe('/sign-in')
      expect(router.currentRoute.value.query.returnTo).toBe('/')
    }
  )

  it('lets an authenticated visitor onto the billing route', async () => {
    const router = routerAt('authenticated')

    await router.push('/')

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('keeps the sign-in page reachable while signed out', async () => {
    const router = routerAt('signed-out')

    await router.push('/sign-in')

    expect(router.currentRoute.value.path).toBe('/sign-in')
  })

  it('brings a signed-out visitor back to the surface the link named', async () => {
    const router = routerAt('signed-out')

    await router.push(`/v1/subscription?${ENTRY_QUERY}`)

    expect(router.currentRoute.value.path).toBe('/sign-in')
    expect(router.currentRoute.value.query.returnTo).toBe(
      `/v1/subscription?${ENTRY_QUERY}`
    )
  })

  it('keeps the entry error of a link it turns away', async () => {
    const router = routerAt('signed-out')

    await router.push(`/v1/refunds?${ENTRY_QUERY}`)

    expect(router.currentRoute.value.path).toBe('/sign-in')
    expect(useBillingEntry().error.value).toBe('UNKNOWN_INTENT')
  })
})

describe('the return destination', () => {
  it.for([
    ['/', '/'],
    ['/checkout?plan=creator', '/checkout?plan=creator'],
    ['https://evil.example/steal', '/'],
    ['//evil.example/steal', '/'],
    ['/\\evil.example', '/'],
    ['javascript:alert(1)', '/'],
    ['', '/']
  ] as const)('resolves %s to %s', ([raw, expected]) => {
    expect(safeReturnTo(raw)).toBe(expected)
  })

  it('ignores a repeated query parameter that is not a single path', () => {
    expect(safeReturnTo(['https://evil.example', '/'])).toBe('/')
  })
})

describe('hosted billing entry routing', () => {
  it.for([
    { intent: 'subscription', surface: 'Your subscription' },
    { intent: 'pricing', surface: 'Plans' },
    { intent: 'payment-methods', surface: 'Payment methods' },
    { intent: 'invoices', surface: 'Invoices' },
    { intent: 'result', surface: 'Billing result' },
    { intent: 'checkout', surface: 'Confirm your payment' }
  ])('opens $intent on the $surface surface', async ({ intent, surface }) => {
    await arriveAt(`/v1/${intent}?${ENTRY_QUERY}`)

    expect(
      await screen.findByRole('heading', { name: surface })
    ).toBeInTheDocument()
  })

  it('publishes the request the product made', async () => {
    await arriveAt(`/v1/subscription?${ENTRY_QUERY}&plan=creator_monthly`)

    expect(useBillingEntry().entry.value).toEqual({
      version: 'v1',
      intent: 'subscription',
      product: 'comfyui',
      returnTo: 'comfyui_workspace',
      plan: 'creator_monthly'
    })
  })

  it.for([
    {
      code: 'UNSUPPORTED_VERSION',
      path: `/v2/subscription?${ENTRY_QUERY}`,
      message:
        'That link uses an older billing address. Update the app you came from and try again.'
    },
    {
      code: 'UNKNOWN_INTENT',
      path: `/v1/refunds?${ENTRY_QUERY}`,
      message: "That link asks for a billing page that doesn't exist."
    },
    {
      // Checkout renders its own shell, so this row proves the error surface
      // wins over whichever route the path matched.
      code: 'UNKNOWN_PRODUCT',
      path: '/v1/checkout?product=spreadsheet&return_to=comfyui_workspace',
      message: "That link doesn't say which product sent you here."
    },
    {
      code: 'UNKNOWN_RETURN_TARGET',
      path: '/v1/subscription?product=comfyui&return_to=https://evil.test',
      message: "That link doesn't name a place we can send you back to."
    },
    {
      code: 'INVALID_PLAN',
      path: `/v1/subscription?${ENTRY_QUERY}&plan=creator/monthly`,
      message: "That link names a plan we can't read."
    },
    {
      code: 'INVALID_CORRELATION_ID',
      path: `/v1/subscription?${ENTRY_QUERY}&correlation_id=a b`,
      message: "That link carries a reference we can't read."
    },
    {
      code: 'INVALID_WORKSPACE_ID',
      path: `/v1/subscription?${ENTRY_QUERY}&workspace_id=ws/1`,
      message: "That link names a workspace we can't read."
    }
  ])('explains $code in our own words', async ({ path, message }) => {
    await arriveAt(path)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(useBillingEntry().entry.value).toBeUndefined()
  })

  it('leaves an unrecognised path where it is instead of redirecting', async () => {
    const router = await arriveAt('/unknown-path')

    expect(router.currentRoute.value.fullPath).toBe('/unknown-path')
    expect(
      await screen.findByRole('heading', {
        name: "We couldn't open that billing page"
      })
    ).toBeInTheDocument()
  })

  it('leaves the scaffold checkout page outside the entry contract', async () => {
    await arriveAt('/')

    expect(
      await screen.findByRole('heading', { name: 'Confirm your payment' })
    ).toBeInTheDocument()
    expect(useBillingEntry().error.value).toBeUndefined()
  })

  it('drops the error of a link the visitor has navigated away from', async () => {
    const router = await arriveAt(`/v1/refunds?${ENTRY_QUERY}`)

    await router.push('/')

    expect(
      await screen.findByRole('heading', { name: 'Confirm your payment' })
    ).toBeInTheDocument()
    expect(useBillingEntry().error.value).toBeUndefined()
  })
})
