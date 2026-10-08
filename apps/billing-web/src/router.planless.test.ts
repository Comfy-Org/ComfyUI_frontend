import { createMemoryHistory } from 'vue-router'

import type { WebEntryBounceTarget } from '@comfyorg/account-core/billing'
import type { BillingEnvironment } from '@comfyorg/billing-contract'

import type { BillingWebSessionPhase } from '@/router'

const h = vi.hoisted(() => ({
  livePhase: undefined as BillingWebSessionPhase | undefined,
  bind: vi.fn<(workspaceId: string) => void>(),
  track: vi.fn<(event: unknown) => void>()
}))

vi.mock<unknown>(import('@/telemetry/billingWebTelemetry'), () => ({
  billingWebTelemetry: { trackBillingEvent: h.track }
}))

vi.mock<unknown>(import('@/session/billingWebAuth'), () => ({
  billingWebPhase: () => h.livePhase ?? 'pending',
  billingWebLivePhase: {
    get value() {
      return h.livePhase
    }
  },
  onBillingWebEntryWorkspace: h.bind
}))

vi.mock<unknown>(import('@/session/billingWebSession'), () => ({
  billingWebSessionClient: () => ({
    getSnapshot: () =>
      h.livePhase === 'authenticated'
        ? {
            phase: 'authenticated',
            user: { uid: 'uid-1' },
            session: { uid: 'uid-1', workspace: { id: 'ws_personal' } }
          }
        : { phase: h.livePhase ?? 'pending', user: null, session: undefined },
    ensureFresh: async () => ({
      status: 'ok',
      session: { token: 'jwt-1', uid: 'uid-1' }
    })
  })
}))

const fetchMock = vi.fn<typeof fetch>()

function flagAnswers(variant: string) {
  if (variant === 'unreachable') {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    return
  }
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ billing_web_checkout_ui: variant }))
  )
}

const PLANLESS =
  '/v1/checkout?product=comfyui&return_to=comfyui_workspace&workspace=ws-team'
const PRICING_TABLE = 'https://testcloud.comfy.org/?pricing=1&workspace=ws-team'
const PLANLESS_BOUNCE = {
  operation: 'web_entry',
  stage: 'bounced',
  outcome: 'pending',
  reason: 'planless_checkout',
  to: 'pricing_table'
}

beforeEach(() => {
  sessionStorage.clear()
  vi.resetModules()
  vi.mocked(fetch).mockImplementation(fetchMock)
  fetchMock.mockReset()
  h.bind.mockReset()
  h.track.mockReset()
})

async function openPlanless(
  visitor: {
    livePhase: BillingWebSessionPhase | undefined
    flag: string
  },
  path: string = PLANLESS
) {
  h.livePhase = visitor.livePhase
  flagAnswers(visitor.flag)
  const { createBillingRouter } = await import('@/router')
  const { useBillingEntry } = await import('@/entry/billingEntry')
  const leave = vi.fn()
  const router = createBillingRouter(
    createMemoryHistory(),
    undefined,
    undefined,
    leave
  )
  await router.push(path)
  return { router, leave, ...useBillingEntry() }
}

describe('a checkout link that names no plan', () => {
  it.for<{
    name: string
    livePhase: BillingWebSessionPhase | undefined
    flag: string
  }>([
    {
      name: 'a signed-out visitor',
      livePhase: 'signed-out',
      flag: 'embedded'
    },
    {
      name: 'a signed-out visitor on the flag',
      livePhase: 'signed-out',
      flag: 'full_page'
    },
    {
      name: 'a page load whose sign-in mode is undecided',
      livePhase: undefined,
      flag: 'full_page'
    },
    {
      name: 'a restored identity with no session minted yet',
      livePhase: 'pending',
      flag: 'full_page'
    },
    {
      name: 'an identity still minting',
      livePhase: 'minting',
      flag: 'full_page'
    },
    {
      name: 'a sign-in that failed',
      livePhase: 'error',
      flag: 'full_page'
    }
  ])(
    'sends $name straight to the pricing table, without asking for a session or the flag',
    async (visitor) => {
      const { router, leave } = await openPlanless(visitor)

      expect(leave).toHaveBeenCalledExactlyOnceWith(PRICING_TABLE)
      expect(router.currentRoute.value.path).not.toBe('/sign-in')
      expect(h.bind).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(h.track).toHaveBeenCalledExactlyOnceWith(PLANLESS_BOUNCE)
    }
  )

  it.for(['embedded', 'unreachable'])(
    'sends a signed-in customer whose flag reads %s to the pricing table',
    async (flag) => {
      const { router, leave } = await openPlanless({
        livePhase: 'authenticated',
        flag
      })

      expect(leave).toHaveBeenCalledExactlyOnceWith(PRICING_TABLE)
      expect(router.currentRoute.value.path).not.toBe('/sign-in')
      expect(h.bind).not.toHaveBeenCalled()
      expect(h.track).toHaveBeenCalledExactlyOnceWith(PLANLESS_BOUNCE)
    }
  )

  it('keeps it for the full page when a signed-in customer is on the flag', async () => {
    const { router, leave, entry, error } = await openPlanless({
      livePhase: 'authenticated',
      flag: 'full_page'
    })

    expect(leave).not.toHaveBeenCalled()
    expect(h.bind).toHaveBeenCalledExactlyOnceWith('ws-team')
    expect(router.currentRoute.value.path).toBe('/v1/checkout')
    expect(entry.value).toMatchObject({
      intent: 'checkout',
      workspaceId: 'ws-team'
    })
    expect(entry.value?.plan).toBeUndefined()
    expect(error.value).toBeUndefined()
    expect(h.track).toHaveBeenCalledExactlyOnceWith({
      operation: 'web_entry',
      stage: 'received',
      outcome: 'pending',
      intent: 'checkout',
      product: 'comfyui',
      has_plan: false
    })
  })
})

describe('where a checkout link that names no plan sends the customer to pick one', () => {
  const SIGNED_OUT = { livePhase: 'signed-out', flag: 'embedded' } as const

  it.for<{
    name: string
    env: BillingEnvironment
    query: string
    destination: string
    to: WebEntryBounceTarget
  }>([
    {
      name: 'a cloud link to the pricing table',
      env: 'staging',
      query: 'product=comfyui&return_to=comfyui_workspace&workspace=ws-1',
      destination: 'https://stagingcloud.comfy.org/?pricing=1&workspace=ws-1',
      to: 'pricing_table'
    },
    {
      name: 'a cloud link without a return_to to the pricing table',
      env: 'production',
      query: 'product=comfyui',
      destination: 'https://cloud.comfy.org/?pricing=1',
      to: 'pricing_table'
    },
    {
      name: 'a cloud link that names a team to the Team tab',
      env: 'staging',
      query:
        'product=comfyui&return_to=comfyui_workspace&workspace=ws-1&team_credit_stop_id=stop_700',
      destination:
        'https://stagingcloud.comfy.org/?pricing=team&workspace=ws-1',
      to: 'pricing_table'
    },
    {
      name: 'a platform link to its return_to',
      env: 'staging',
      query: 'product=platform&return_to=platform_account&workspace=ws-1',
      destination: 'https://stagingplatform.comfy.org/?workspace=ws-1',
      to: 'platform_account'
    },
    {
      name: 'a platform link to a return_to in another product',
      env: 'production',
      query: 'product=platform&return_to=comfyui_credits',
      destination: 'https://cloud.comfy.org/?settings=plan-credits',
      to: 'comfyui_credits'
    },
    {
      name: 'a platform link with an unregistered return_to to the platform billing page',
      env: 'staging',
      query: 'product=platform&return_to=https://evil.test&workspace=ws-1',
      destination:
        'https://stagingplatform.comfy.org/profile/billing?workspace=ws-1',
      to: 'platform_billing'
    },
    {
      name: 'a platform link without a return_to to the platform billing page',
      env: 'production',
      query: 'product=platform',
      destination: 'https://platform.comfy.org/profile/billing',
      to: 'platform_billing'
    }
  ])('sends $name', async ({ env, query, destination, to }) => {
    vi.stubEnv('VITE_BILLING_ENV', env)

    const { router, leave } = await openPlanless(
      SIGNED_OUT,
      `/v1/checkout?${query}`
    )

    expect(leave).toHaveBeenCalledExactlyOnceWith(destination)
    expect(router.currentRoute.value.path).not.toBe('/sign-in')
    expect(h.bind).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(h.track).toHaveBeenCalledExactlyOnceWith({
      ...PLANLESS_BOUNCE,
      to
    })
  })

  it('explains a platform link where this deployment has no platform to send it to', async () => {
    const { leave, entry, error } = await openPlanless(
      SIGNED_OUT,
      '/v1/checkout?product=platform&return_to=platform_account'
    )

    expect(leave).not.toHaveBeenCalled()
    expect(entry.value).toBeUndefined()
    expect(error.value).toBe('UNKNOWN_RETURN_TARGET')
    expect(h.track).toHaveBeenCalledExactlyOnceWith({
      operation: 'web_entry',
      stage: 'rejected',
      outcome: 'pending',
      error_code: 'UNKNOWN_RETURN_TARGET'
    })
  })
})

describe('a planless checkout link the customer navigates away from', () => {
  const LATER =
    '/v1/subscription?product=comfyui&return_to=comfyui_workspace&workspace=ws-other'

  it.for(['full_page', 'embedded'])(
    'leaves the later page alone when the flag answers %s afterwards',
    async (variant) => {
      h.livePhase = 'authenticated'
      let answerFlag: (response: Response) => void = () => undefined
      fetchMock.mockReturnValue(
        new Promise((resolve) => {
          answerFlag = resolve
        })
      )
      const { createBillingRouter } = await import('@/router')
      const { useBillingEntry } = await import('@/entry/billingEntry')
      const leave = vi.fn()
      const router = createBillingRouter(
        createMemoryHistory(),
        undefined,
        undefined,
        leave
      )

      const planless = router.push(PLANLESS)
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
      await router.push(LATER)
      answerFlag(
        new Response(JSON.stringify({ billing_web_checkout_ui: variant }))
      )
      await planless

      expect(leave).not.toHaveBeenCalled()
      expect(h.bind).toHaveBeenCalledExactlyOnceWith('ws-other')
      expect(router.currentRoute.value.path).toBe('/v1/subscription')
      expect(useBillingEntry().entry.value).toMatchObject({
        intent: 'subscription',
        workspaceId: 'ws-other'
      })
      expect(h.track).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ stage: 'received', intent: 'subscription' })
      )
    }
  )
})
