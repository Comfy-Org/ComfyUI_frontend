import { createMemoryHistory } from 'vue-router'

import type { BillingWebSessionPhase } from '@/router'

const h = vi.hoisted(() => ({
  livePhase: undefined as BillingWebSessionPhase | undefined,
  bind: vi.fn<(workspaceId: string) => void>()
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
const HOST = 'https://testcloud.comfy.org/?workspace=ws-team'

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  h.bind.mockReset()
})

async function openPlanless(visitor: {
  livePhase: BillingWebSessionPhase | undefined
  flag: string
}) {
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
  await router.push(PLANLESS)
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
    'sends $name straight back to the host, without asking for a session or the flag',
    async (visitor) => {
      const { router, leave } = await openPlanless(visitor)

      expect(leave).toHaveBeenCalledExactlyOnceWith(HOST)
      expect(router.currentRoute.value.path).not.toBe('/sign-in')
      expect(h.bind).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it.for(['embedded', 'unreachable'])(
    'sends a signed-in customer whose flag reads %s back to the host',
    async (flag) => {
      const { router, leave } = await openPlanless({
        livePhase: 'authenticated',
        flag
      })

      expect(leave).toHaveBeenCalledExactlyOnceWith(HOST)
      expect(router.currentRoute.value.path).not.toBe('/sign-in')
      expect(h.bind).not.toHaveBeenCalled()
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
    }
  )
})
