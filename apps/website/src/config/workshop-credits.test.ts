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
  setSessionToken?: (token: string | undefined) => void
  remint?: ReturnType<typeof vi.fn>
}

const sessionHandles = vi.hoisted<SessionHandles>(() => ({}))

vi.mock('./workshop-session-state', async () => {
  const { computed, ref } = await import('vue')
  const session = ref<{ token: string } | undefined>(undefined)
  const remint = vi.fn(async () => ({
    status: 'ok',
    session: { token: 'jwt' }
  }))
  sessionHandles.setSessionToken = (token) => {
    session.value = token === undefined ? undefined : { token }
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

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

beforeEach(() => {
  sessionHandles.setSessionToken!(undefined)
  sessionHandles.remint!.mockClear()
  sessionHandles.remint!.mockImplementation(async () => ({
    status: 'ok',
    session: { token: 'jwt' }
  }))
})

describe('microsToCredits', () => {
  it('agrees with the shared creditsUtil rounding', () => {
    // $1 = 1,000,000 micros = 100 cents.
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
    sessionHandles.setSessionToken!('jwt')
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
    sessionHandles.setSessionToken!('jwt')
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
    sessionHandles.setSessionToken!('stale-jwt')
    sessionHandles.remint!.mockImplementation(async () => {
      sessionHandles.setSessionToken!('fresh-jwt')
      return { status: 'ok', session: { token: 'fresh-jwt' } }
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
    sessionHandles.setSessionToken!('jwt')
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
})
