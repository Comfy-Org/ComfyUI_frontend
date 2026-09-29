import { createMemoryHistory } from 'vue-router'

import type { BillingWebSessionPhase } from '@/router'

const h = vi.hoisted(() => ({
  livePhase: undefined as BillingWebSessionPhase | undefined,
  settledPhase: new Promise<BillingWebSessionPhase>(() => {}),
  bind: vi.fn<(workspaceId: string) => void>()
}))

vi.mock<unknown>(import('@/session/billingWebAuth'), () => ({
  billingWebPhase: () => h.livePhase ?? 'pending',
  billingWebLivePhase: {
    get value() {
      return h.livePhase
    }
  },
  billingWebSettledPhase: () => h.settledPhase,
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
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ billing_web_checkout_ui: variant }))
  )
}

const PLANLESS =
  '/v1/checkout?product=comfyui&return_to=comfyui_workspace&workspace=ws-team'
const HOST = 'https://testcloud.comfy.org/?workspace=ws-team'

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  h.bind.mockReset()
})

async function openPlanless(visitor: {
  livePhase: BillingWebSessionPhase | undefined
  settledPhase?: BillingWebSessionPhase
  flag: string
}) {
  h.livePhase = visitor.livePhase
  h.settledPhase =
    visitor.settledPhase === undefined
      ? new Promise(() => {})
      : Promise.resolve(visitor.settledPhase)
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
  await router.push(PLANLESS)
  return { router, leave, ...useBillingEntry() }
}

describe('a checkout link that names no plan', () => {
  it.for<{
    name: string
    livePhase: BillingWebSessionPhase | undefined
    settledPhase?: BillingWebSessionPhase
    flag: string
  }>([
    {
      name: 'a signed-out visitor',
      livePhase: 'signed-out',
      settledPhase: 'signed-out',
      flag: 'embedded'
    },
    {
      name: 'a signed-out visitor on the flag',
      livePhase: 'signed-out',
      settledPhase: 'signed-out',
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
      settledPhase: 'minting',
      flag: 'full_page'
    },
    {
      name: 'an identity still minting',
      livePhase: 'minting',
      settledPhase: 'minting',
      flag: 'full_page'
    },
    {
      name: 'a sign-in that failed',
      livePhase: 'error',
      settledPhase: 'error',
      flag: 'full_page'
    }
  ])(
    'sends $name straight back to the host, without asking for a session or the flag',
    async (visitor) => {
      const { router, leave } = await openPlanless(visitor)

      expect(leave).toHaveBeenCalledExactlyOnceWith(HOST)
      expect(router.currentRoute.value.path).not.toBe('/sign-in')
      expect(h.bind).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it('sends a signed-in customer off the flag back to the host', async () => {
    const { router, leave } = await openPlanless({
      livePhase: 'authenticated',
      settledPhase: 'authenticated',
      flag: 'embedded'
    })

    expect(leave).toHaveBeenCalledExactlyOnceWith(HOST)
    expect(router.currentRoute.value.path).not.toBe('/sign-in')
    expect(h.bind).not.toHaveBeenCalled()
  })

  it('keeps it for the full page when a signed-in customer is on the flag', async () => {
    const { router, leave, entry, error } = await openPlanless({
      livePhase: 'authenticated',
      settledPhase: 'authenticated',
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
  })
})
