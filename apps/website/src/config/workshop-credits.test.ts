// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

import {
  microsToCredits,
  refreshWorkshopCredits,
  useWorkshopCredits,
  workshopPurchaseUrl
} from './workshop-credits'

interface SessionHandles {
  setSession?: (session: { token: string; uid: string } | undefined) => void
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
  const session = ref<{ token: string; uid: string } | undefined>(undefined)
  const remint = vi.fn(async () => ({
    status: 'ok',
    session: { token: 'jwt', uid: 'user-1' }
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

const withToken = (token: string, uid = 'user-1') => ({ token, uid })

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

beforeEach(() => {
  sessionHandles.setSession!(undefined)
  sessionHandles.remint!.mockClear()
  sessionHandles.flag!.value = true
  sessionHandles.remint!.mockImplementation(async () => ({
    status: 'ok',
    session: { token: 'jwt', uid: 'user-1' }
  }))
})

describe('microsToCredits', () => {
  it('agrees with the shared creditsUtil rounding', () => {
    expect(microsToCredits(1_000_000)).toBe(centsToCredits(100))
    expect(microsToCredits(4_750_000)).toBe(centsToCredits(475))
    expect(microsToCredits(0)).toBe(0)
  })
})

describe('workshopPurchaseUrl', () => {
  it('points at platform with the utm source and the return address', () => {
    const url = new URL(workshopPurchaseUrl('/workshop/models/flux/'))
    expect(url.origin).toBe('https://platform.comfy.org')
    expect(url.searchParams.get('utm_source')).toBe('comfy_workshop')
    expect(url.searchParams.get('returnTo')).toBe('/workshop/models/flux/')
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
      credits: microsToCredits(2_000_000)
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
      credits: microsToCredits(1_000_000)
    })
  })

  it('re-mints once on a failed read and retries with the new token', async () => {
    sessionHandles.setSession!(withToken('stale-jwt'))
    sessionHandles.remint!.mockImplementation(async () => {
      sessionHandles.setSession!(withToken('fresh-jwt'))
      return { status: 'ok', session: { token: 'fresh-jwt', uid: 'user-1' } }
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
      credits: microsToCredits(500_000)
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
    ).not.toEqual({ status: 'ok', credits: microsToCredits(9_000_000) })
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
