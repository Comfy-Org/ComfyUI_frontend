import { render, screen } from '@testing-library/vue'
import { createMemoryHistory } from 'vue-router'
import type { Router } from 'vue-router'

import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import type { BillingSource } from '@comfyorg/billing-contract'

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

async function arriveAt(
  path: string,
  router: Router = routerAt('authenticated')
): Promise<Router> {
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

describe('entry workspace binding', () => {
  it('binds the workspace an entry link names', async () => {
    const onEntryWorkspace = vi.fn()
    const router = createBillingRouter(
      createMemoryHistory(),
      () => 'authenticated',
      onEntryWorkspace
    )

    await router.push(`/v1/subscription?${ENTRY_QUERY}&workspace=ws-team`)

    expect(onEntryWorkspace).toHaveBeenCalledExactlyOnceWith('ws-team')
  })

  it('does not bind when the link names no workspace', async () => {
    const onEntryWorkspace = vi.fn()
    const router = createBillingRouter(
      createMemoryHistory(),
      () => 'authenticated',
      onEntryWorkspace
    )

    await router.push(`/v1/subscription?${ENTRY_QUERY}`)

    expect(onEntryWorkspace).not.toHaveBeenCalled()
  })

  it('does not bind on a link the contract rejects', async () => {
    const onEntryWorkspace = vi.fn()
    const router = createBillingRouter(
      createMemoryHistory(),
      () => 'authenticated',
      onEntryWorkspace
    )

    await router.push(`/v1/subscription?${ENTRY_QUERY}&workspace=ws/1`)

    expect(onEntryWorkspace).not.toHaveBeenCalled()
  })
})

describe('plan selection, which the host app owns', () => {
  function hostBoundRouter(phase: BillingWebSessionPhase = 'signed-out') {
    const onEntryWorkspace = vi.fn()
    const leave = vi.fn()
    const router = createBillingRouter(
      createMemoryHistory(),
      () => phase,
      onEntryWorkspace,
      leave
    )
    return { router, onEntryWorkspace, leave }
  }

  it.for([
    [
      `/v1/pricing?${ENTRY_QUERY}&workspace=ws-team`,
      'https://testcloud.comfy.org/?workspace=ws-team'
    ],
    [
      `/v1/checkout?${ENTRY_QUERY}&workspace=ws-team`,
      'https://testcloud.comfy.org/?pricing=1&workspace=ws-team'
    ]
  ])(
    'sends %s to %s without rebinding the tab',
    async ([path, destination]) => {
      const { router, onEntryWorkspace, leave } = hostBoundRouter()

      await router.push(path)

      expect(leave).toHaveBeenCalledExactlyOnceWith(destination)
      expect(onEntryWorkspace).not.toHaveBeenCalled()
      expect(router.currentRoute.value.path).not.toBe('/sign-in')
    }
  )

  it('keeps a checkout that names a plan', async () => {
    const { router, leave } = hostBoundRouter('authenticated')

    await router.push(`/v1/checkout?${ENTRY_QUERY}&plan=creator_monthly`)

    expect(leave).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/v1/checkout')
  })

  it.for(['/v1/pricing?product=platform&return_to=platform_account'])(
    'explains %s, which has nowhere to go back to',
    async (path) => {
      const { router, onEntryWorkspace, leave } =
        hostBoundRouter('authenticated')

      await arriveAt(path, router)

      expect(
        await screen.findByText(
          "That link doesn't name a place we can send you back to."
        )
      ).toBeInTheDocument()
      expect(leave).not.toHaveBeenCalled()
      expect(onEntryWorkspace).not.toHaveBeenCalled()
      expect(useBillingEntry().entry.value).toBeUndefined()
    }
  )
})

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

describe("a checkout's return_to, which is optional", () => {
  it.for([
    {
      name: 'none at all',
      path: '/v1/checkout?product=comfyui&plan=creator_monthly'
    },
    {
      name: 'one outside the registry',
      path: '/v1/checkout?product=comfyui&return_to=https://evil.test&plan=creator_monthly'
    },
    {
      name: 'one this family has no destination for',
      path: '/v1/checkout?product=platform&return_to=platform_account&plan=creator_monthly'
    }
  ])(
    'checks out a link with $name and returns to Plan & Credits',
    async ({ path }) => {
      const leave = vi.fn()
      const router = createBillingRouter(
        createMemoryHistory(),
        () => 'authenticated',
        vi.fn(),
        leave
      )

      await router.push(path)

      expect(router.currentRoute.value.path).toBe('/v1/checkout')
      expect(useBillingEntry().error.value).toBeUndefined()
      expect(useBillingEntry().entry.value).toMatchObject({
        intent: 'checkout',
        plan: 'creator_monthly',
        returnTo: 'comfyui_credits'
      })
      expect(leave).not.toHaveBeenCalled()
    }
  )

  it('keeps a return_to this family can follow', async () => {
    await routerAt('authenticated').push(
      `/v1/checkout?${ENTRY_QUERY}&plan=creator_monthly`
    )

    expect(useBillingEntry().entry.value?.returnTo).toBe('comfyui_workspace')
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
    { intent: 'payment-methods', surface: 'Payment methods' },
    { intent: 'invoices', surface: 'Invoices' },
    { intent: 'result', surface: 'Billing result' }
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

  it('publishes the source and journey the product handed over', async () => {
    await arriveAt(
      `/v1/subscription?${ENTRY_QUERY}&source=agent_paywall&correlation_id=journey-1`
    )

    const { entry } = useBillingEntry()
    expect(entry.value).toEqual({
      version: 'v1',
      intent: 'subscription',
      product: 'comfyui',
      returnTo: 'comfyui_workspace',
      source: 'agent_paywall',
      correlationId: 'journey-1'
    })
    expectTypeOf(entry.value?.source).toEqualTypeOf<BillingSource | undefined>()
    expectTypeOf(entry.value?.correlationId).toEqualTypeOf<string | undefined>()
  })

  it('publishes a link whose source is outside the shared list without one', async () => {
    await arriveAt(
      `/v1/subscription?${ENTRY_QUERY}&source=https%3A%2F%2Fevil.test&correlation_id=journey-1`
    )

    expect(useBillingEntry().error.value).toBeUndefined()
    expect(useBillingEntry().entry.value).toEqual({
      version: 'v1',
      intent: 'subscription',
      product: 'comfyui',
      returnTo: 'comfyui_workspace',
      correlationId: 'journey-1'
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
      path: `/v1/subscription?${ENTRY_QUERY}&workspace=ws/1`,
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

  it("leaves the app's own front door outside the entry contract", async () => {
    await arriveAt('/')

    expect(
      await screen.findByRole('heading', { name: 'Billing' })
    ).toBeInTheDocument()
    expect(useBillingEntry().error.value).toBeUndefined()
  })

  it('drops the error of a link the visitor has navigated away from', async () => {
    const router = await arriveAt(`/v1/refunds?${ENTRY_QUERY}`)

    await router.push('/')

    expect(
      await screen.findByRole('heading', { name: 'Billing' })
    ).toBeInTheDocument()
    expect(useBillingEntry().error.value).toBeUndefined()
  })
})
