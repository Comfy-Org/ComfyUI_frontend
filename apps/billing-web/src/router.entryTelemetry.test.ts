import { createMemoryHistory } from 'vue-router'

import { createBillingRouter } from '@/router'
import type { BillingWebSessionPhase } from '@/router'
import { billingWebTelemetry } from '@/telemetry/billingWebTelemetry'

const ENTRY_QUERY = 'product=comfyui&return_to=comfyui_workspace'

function trackedEvents() {
  const track = vi
    .spyOn(billingWebTelemetry, 'trackBillingEvent')
    .mockImplementation(() => undefined)
  return () => track.mock.calls.map(([event]) => event)
}

function arrivalRouter(
  readPhase: () => BillingWebSessionPhase = () => 'authenticated'
) {
  const leave = vi.fn()
  const router = createBillingRouter(
    createMemoryHistory(),
    readPhase,
    vi.fn(),
    leave
  )
  return { router, leave }
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('the entry link a tab arrives with', () => {
  it.for([
    {
      name: 'a plain subscription link',
      path: `/v1/subscription?${ENTRY_QUERY}`,
      received: {
        intent: 'subscription',
        product: 'comfyui',
        has_plan: false
      }
    },
    {
      name: 'a checkout that names its plan, source and journey',
      path: `/v1/checkout?${ENTRY_QUERY}&plan=creator_monthly&source=agent_paywall&correlation_id=journey-1`,
      received: {
        intent: 'checkout',
        product: 'comfyui',
        has_plan: true,
        payment_intent_source: 'agent_paywall',
        correlation_id: 'journey-1'
      }
    },
    {
      name: 'a link carrying values billing must never report',
      path: `/v1/top-up?${ENTRY_QUERY}&amount_cents=500&workspace=ws-team&team_credit_stop_id=stop-1&promo=SPRING`,
      received: {
        intent: 'top-up',
        product: 'comfyui',
        has_plan: false
      }
    }
  ])('reports $name once it is received', async ({ path, received }) => {
    const sent = trackedEvents()
    const { router } = arrivalRouter()

    await router.push(path)

    expect(sent()).toStrictEqual([
      {
        operation: 'web_entry',
        stage: 'received',
        outcome: 'pending',
        ...received
      }
    ])
  })

  it.for([
    {
      code: 'UNSUPPORTED_VERSION',
      path: `/v2/subscription?${ENTRY_QUERY}`
    },
    { code: 'UNKNOWN_INTENT', path: `/v1/refunds?${ENTRY_QUERY}` },
    {
      code: 'UNKNOWN_PRODUCT',
      path: '/v1/subscription?product=spreadsheet&return_to=comfyui_workspace'
    },
    {
      code: 'UNKNOWN_RETURN_TARGET',
      path: '/v1/subscription?product=comfyui&return_to=https://evil.test'
    },
    {
      code: 'INVALID_PLAN',
      path: `/v1/subscription?${ENTRY_QUERY}&plan=creator/monthly`
    },
    {
      code: 'INVALID_CORRELATION_ID',
      path: `/v1/subscription?${ENTRY_QUERY}&correlation_id=a b`
    },
    {
      code: 'INVALID_WORKSPACE_ID',
      path: `/v1/subscription?${ENTRY_QUERY}&workspace=ws/1`
    },
    {
      code: 'INVALID_TEAM_CREDIT_STOP_ID',
      path: `/v1/subscription?${ENTRY_QUERY}&team_credit_stop_id=stop/1`
    },
    {
      code: 'INVALID_AMOUNT',
      path: `/v1/top-up?${ENTRY_QUERY}&amount_cents=lots`
    }
  ])('reports a link rejected as $code and nothing else', async (row) => {
    const sent = trackedEvents()
    const { router } = arrivalRouter()

    await router.push(row.path)

    expect(sent()).toStrictEqual([
      {
        operation: 'web_entry',
        stage: 'rejected',
        outcome: 'pending',
        error_code: row.code
      }
    ])
  })

  it('reports a link whose way back cannot be resolved as rejected, not received', async () => {
    const sent = trackedEvents()
    const { router, leave } = arrivalRouter()

    await router.push('/v1/pricing?product=platform&return_to=platform_account')

    expect(leave).not.toHaveBeenCalled()
    expect(sent()).toStrictEqual([
      {
        operation: 'web_entry',
        stage: 'rejected',
        outcome: 'pending',
        error_code: 'UNKNOWN_RETURN_TARGET'
      }
    ])
  })
})

describe('an entry link billing web sends back to the host', () => {
  it('reports a pricing link as bounced to the target it named, without receiving it', async () => {
    const sent = trackedEvents()
    const { router, leave } = arrivalRouter(() => 'signed-out')

    await router.push(`/v1/pricing?${ENTRY_QUERY}`)

    expect(leave).toHaveBeenCalledOnce()
    expect(sent()).toStrictEqual([
      {
        operation: 'web_entry',
        stage: 'bounced',
        outcome: 'pending',
        reason: 'pricing_link',
        to: 'comfyui_workspace'
      }
    ])
  })

  it('reports a checkout that names no plan as bounced to the pricing table', async () => {
    const sent = trackedEvents()
    const { router, leave } = arrivalRouter(() => 'signed-out')

    await router.push(`/v1/checkout?${ENTRY_QUERY}`)

    expect(leave).toHaveBeenCalledOnce()
    expect(sent()).toStrictEqual([
      {
        operation: 'web_entry',
        stage: 'bounced',
        outcome: 'pending',
        reason: 'planless_checkout',
        to: 'pricing_table'
      }
    ])
  })

  it.for([
    {
      name: 'none at all',
      path: '/v1/checkout?product=comfyui&plan=creator_monthly'
    },
    {
      name: 'one outside the registry',
      path: '/v1/checkout?product=comfyui&return_to=https://evil.test&plan=creator_monthly'
    }
  ])(
    'reports a checkout with $name as received, then as rewritten to Plan & Credits',
    async ({ path }) => {
      const sent = trackedEvents()
      const { router, leave } = arrivalRouter()

      await router.push(path)

      expect(leave).not.toHaveBeenCalled()
      expect(sent()).toStrictEqual([
        {
          operation: 'web_entry',
          stage: 'received',
          outcome: 'pending',
          intent: 'checkout',
          product: 'comfyui',
          has_plan: true
        },
        {
          operation: 'web_entry',
          stage: 'bounced',
          outcome: 'pending',
          reason: 'return_target_rewritten',
          to: 'comfyui_credits'
        }
      ])
    }
  )
})

describe('once per tab entry', () => {
  it('reports a received link once across route changes inside the tab', async () => {
    const sent = trackedEvents()
    const { router } = arrivalRouter()

    await router.push(`/v1/subscription?${ENTRY_QUERY}`)
    await router.push(`/v1/invoices?${ENTRY_QUERY}`)
    await router.push('/')
    await router.push(`/v1/subscription?${ENTRY_QUERY}`)

    expect(sent().map((event) => event.stage)).toStrictEqual(['received'])
  })

  it('reports a received link once across the sign-in redirect it takes', async () => {
    const sent = trackedEvents()
    let phase: BillingWebSessionPhase = 'signed-out'
    const { router } = arrivalRouter(() => phase)

    await router.push(`/v1/subscription?${ENTRY_QUERY}`)
    expect(router.currentRoute.value.path).toBe('/sign-in')
    phase = 'authenticated'
    await router.replace(`/v1/subscription?${ENTRY_QUERY}`)

    expect(router.currentRoute.value.path).toBe('/v1/subscription')
    expect(sent().map((event) => event.stage)).toStrictEqual(['received'])
  })

  it('reports a rejected link once across route changes inside the tab', async () => {
    const sent = trackedEvents()
    const { router } = arrivalRouter()

    await router.push(`/v1/refunds?${ENTRY_QUERY}`)
    await router.push(`/v1/orders?${ENTRY_QUERY}`)
    await router.push(`/v2/subscription?${ENTRY_QUERY}`)

    expect(sent().map((event) => event.stage)).toStrictEqual(['rejected'])
  })

  it('reports a link once across a reload of the tab', async () => {
    const before = trackedEvents()
    await arrivalRouter().router.push(`/v1/subscription?${ENTRY_QUERY}`)
    expect(before()).toHaveLength(1)

    vi.resetModules()
    const reloaded = await import('@/router')
    const { billingWebTelemetry: reloadedTelemetry } =
      await import('@/telemetry/billingWebTelemetry')
    const afterReload = vi
      .spyOn(reloadedTelemetry, 'trackBillingEvent')
      .mockImplementation(() => undefined)
    const router = reloaded.createBillingRouter(
      createMemoryHistory(),
      () => 'authenticated'
    )
    await router.push(`/v1/subscription?${ENTRY_QUERY}`)

    expect(afterReload).not.toHaveBeenCalled()
  })

  it('still reports once per page load when the tab keeps no storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const sent = trackedEvents()
    const { router } = arrivalRouter()

    await router.push(`/v1/subscription?${ENTRY_QUERY}`)
    await router.push(`/v1/invoices?${ENTRY_QUERY}`)

    expect(sent().map((event) => event.stage)).toStrictEqual(['received'])
  })
})
