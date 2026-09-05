// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

import type { WorkshopSession } from './workshop-session'
import type * as CreditsModule from './workshop-credits'

// The credits module carries a shared balance ref and an in-flight-refresh
// guard, so each test loads a fresh copy to keep that state from leaking.
let mod: typeof CreditsModule
const balanceToCredits = (cents: number) => mod.balanceToCredits(cents)
const refreshWorkshopCredits = (fetchImpl?: typeof fetch) =>
  mod.refreshWorkshopCredits(fetchImpl)
const useWorkshopCredits = () => mod.useWorkshopCredits()
interface SessionHandles {
  setSession?: (session: WorkshopSession | undefined) => void
  remint?: ReturnType<typeof vi.fn>
  flag?: { value: boolean }
}

const sessionHandles = vi.hoisted<SessionHandles>(() => ({}))

vi.mock('../scripts/posthog', async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  sessionHandles.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock('./workshop-session-state', async () => {
  const { computed, ref } = await import('vue')
  const session = ref<WorkshopSession | undefined>(undefined)
  const mintedSession: WorkshopSession = {
    token: 'jwt',
    uid: 'user-1',
    permissions: ['workspace:read'],
    expiresAt: Date.now() + 60 * 60 * 1000,
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner'
  }
  const remint = vi.fn(async () => ({
    status: 'ok',
    session: mintedSession
  }))
  sessionHandles.setSession = (next) => {
    session.value = next
  }
  sessionHandles.remint = remint
  return {
    useWorkshopSession: () => ({
      session,
      signedIn: computed(() => session.value !== undefined),
      remint
    })
  }
})

const withToken = (token: string, uid = 'user-1'): WorkshopSession => ({
  token,
  uid,
  permissions: ['workspace:read'],
  expiresAt: Date.now() + 60 * 60 * 1000,
  workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
  role: 'owner'
})

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

beforeEach(async () => {
  vi.resetModules()
  mod = await import('./workshop-credits')
  sessionHandles.setSession!(undefined)
  sessionHandles.remint!.mockClear()
  // Keep the module lifecycle off in the fetch unit tests; each test invokes
  // refresh explicitly with its own fetch implementation.
  sessionHandles.flag!.value = false
  mod.useWorkshopCredits()
  sessionHandles.remint!.mockImplementation(async () => ({
    status: 'ok',
    session: withToken('jwt')
  }))
})

describe('balanceToCredits', () => {
  it('treats the backend values as cents despite their _micros names', () => {
    expect(balanceToCredits(1_000_000)).toBe(centsToCredits(1_000_000))
    expect(balanceToCredits(4_750_000)).toBe(centsToCredits(4_750_000))
    expect(balanceToCredits(0)).toBe(0)
  })
})

describe('refreshWorkshopCredits', () => {
  it('publishes the converted balance for a live session', async () => {
    sessionHandles.setSession!(withToken('jwt'))
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { effective_balance_micros: 2_000_000 })
    )

    await refreshWorkshopCredits(fetchImpl)

    expect(useWorkshopCredits().balance.value).toEqual({
      status: 'ok',
      credits: balanceToCredits(2_000_000)
    })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ]
    expect(url).toContain('/api/billing/balance')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer jwt'
    )
  })

  it('falls back to amount_micros when the effective field is absent', async () => {
    sessionHandles.setSession!(withToken('jwt'))
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { amount_micros: 1_000_000 })
    )

    await refreshWorkshopCredits(fetchImpl)

    expect(useWorkshopCredits().balance.value).toEqual({
      status: 'ok',
      credits: balanceToCredits(1_000_000)
    })
  })

  it('re-mints once on a failed read and retries with the new token', async () => {
    sessionHandles.setSession!(withToken('stale-jwt'))
    sessionHandles.remint!.mockImplementation(async () => {
      sessionHandles.setSession!(withToken('fresh-jwt'))
      return { status: 'ok', session: withToken('fresh-jwt') }
    })
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(
        jsonResponse(200, { effective_balance_micros: 500_000 })
      )

    await refreshWorkshopCredits(fetchImpl)

    expect(sessionHandles.remint).toHaveBeenCalledOnce()
    expect(useWorkshopCredits().balance.value).toEqual({
      status: 'ok',
      credits: balanceToCredits(500_000)
    })
    const second = fetchImpl.mock.calls[1] as unknown as [string, RequestInit]
    expect((second[1].headers as Record<string, string>).Authorization).toBe(
      'Bearer fresh-jwt'
    )
  })

  it('settles on the error state when the retry also fails, never NaN', async () => {
    sessionHandles.setSession!(withToken('jwt'))
    const fetchImpl = vi.fn(async () => jsonResponse(200, { unexpected: true }))

    await refreshWorkshopCredits(fetchImpl)

    expect(useWorkshopCredits().balance.value).toEqual({ status: 'error' })
  })

  it('does nothing while signed out', async () => {
    const fetchImpl = vi.fn()

    await refreshWorkshopCredits(fetchImpl)

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(useWorkshopCredits().balance.value).toEqual({ status: 'unknown' })
  })

  it.for([
    ['null', { effective_balance_micros: null }],
    ['a string', { effective_balance_micros: '2000000' }],
    ['neither field present', { some_other_field: 1 }]
  ] as const)(
    'errors rather than trusting a %s balance field',
    async ([, body]) => {
      sessionHandles.setSession!(withToken('jwt'))
      const fetchImpl = vi.fn(async () => jsonResponse(200, body))

      await refreshWorkshopCredits(fetchImpl)

      expect(useWorkshopCredits().balance.value).toEqual({ status: 'error' })
    }
  )

  it('does not publish a balance that belongs to a superseded user', async () => {
    sessionHandles.setSession!(withToken('jwt', 'user-1'))
    const fetchImpl = vi.fn(async () => {
      sessionHandles.setSession!(withToken('other-jwt', 'user-2'))
      return jsonResponse(200, { effective_balance_micros: 9_000_000 })
    })

    await refreshWorkshopCredits(fetchImpl)

    expect(
      useWorkshopCredits().balance.value,
      'a balance fetched for the previous user must not show under the new one'
    ).not.toEqual({ status: 'ok', credits: balanceToCredits(9_000_000) })
  })

  it('does not publish a balance fetched with a superseded token', async () => {
    sessionHandles.setSession!(withToken('old-jwt'))
    const fetchImpl = vi.fn(async () => {
      sessionHandles.setSession!(withToken('new-jwt'))
      return jsonResponse(200, { effective_balance_micros: 9_000_000 })
    })

    await refreshWorkshopCredits(fetchImpl)

    expect(
      useWorkshopCredits().balance.value,
      'a balance fetched with an older token must not overwrite a newer session'
    ).not.toEqual({ status: 'ok', credits: balanceToCredits(9_000_000) })
  })

  it('bounds the balance read with an abort signal', async () => {
    sessionHandles.setSession!(withToken('jwt'))
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { effective_balance_micros: 1_000_000 })
    )

    await refreshWorkshopCredits(fetchImpl)

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(
      init.signal,
      'a balance read without an abort signal can pin the chip stale'
    ).toBeInstanceOf(AbortSignal)
  })

  it('shares one in-flight read across overlapping triggers', async () => {
    sessionHandles.setSession!(withToken('jwt'))
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const fetchImpl = vi.fn(async () => {
      await gate
      return jsonResponse(200, { effective_balance_micros: 3_000_000 })
    })

    const first = refreshWorkshopCredits(fetchImpl)
    const second = refreshWorkshopCredits(fetchImpl)
    release()
    await Promise.all([first, second])

    expect(
      fetchImpl,
      'two overlapping triggers for one session must not fetch twice'
    ).toHaveBeenCalledOnce()
    expect(useWorkshopCredits().balance.value).toEqual({
      status: 'ok',
      credits: balanceToCredits(3_000_000)
    })
  })

  it('queues a forced refresh after an older read already in flight', async () => {
    sessionHandles.setSession!(withToken('jwt'))
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(async () => {
        await gate
        return jsonResponse(200, { effective_balance_micros: 100 })
      })
      .mockResolvedValueOnce(
        jsonResponse(200, { effective_balance_micros: 200 })
      )

    const oldRead = refreshWorkshopCredits(fetchImpl)
    const forced = mod.refreshWorkshopCredits(fetchImpl, { force: true })
    release()
    await Promise.all([oldRead, forced])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(useWorkshopCredits().balance.value).toEqual({
      status: 'ok',
      credits: balanceToCredits(200)
    })
  })
})

describe('useWorkshopCredits start()', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('installs no focus listener while the flag is off', async () => {
    sessionHandles.flag!.value = false
    const addSpy = vi.spyOn(window, 'addEventListener')
    const mod = await import('./workshop-credits')

    mod.useWorkshopCredits()

    expect(
      addSpy.mock.calls.some(([type]) => type === 'focus'),
      'a flag-off page must install no credits listeners'
    ).toBe(false)
    addSpy.mockRestore()
  })

  it('installs the focus listener once the flag is on', async () => {
    sessionHandles.flag!.value = true
    const addSpy = vi.spyOn(window, 'addEventListener')
    const mod = await import('./workshop-credits')

    mod.useWorkshopCredits()

    expect(addSpy.mock.calls.some(([type]) => type === 'focus')).toBe(true)
    addSpy.mockRestore()
  })
})
