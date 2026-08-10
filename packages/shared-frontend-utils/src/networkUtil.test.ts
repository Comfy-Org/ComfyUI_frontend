import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isInChina } from './networkUtil'

/** Blackholes: never settles and ignores the abort signal. */
const neverSettles = () => new Promise<Response>(() => {})

/** Resolves to the settled value, or to `PENDING` if the promise has not. */
const settlementOf = <T>(promise: Promise<T>) =>
  Promise.race([promise, Promise.resolve().then(() => 'PENDING' as const)])

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('navigator', { language: 'en-US' })
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('isInChina', () => {
  it('reports outside China when Google is reachable', async () => {
    fetchMock.mockResolvedValue({ ok: true } as Response)

    await expect(isInChina()).resolves.toBe(false)
  })

  it('reports inside China for a zh-CN client that cannot reach Google', async () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' })
    fetchMock.mockRejectedValue(new Error('blocked'))

    await expect(isInChina()).resolves.toBe(true)
  })

  it('falls back to the locale when neither probe answers', async () => {
    fetchMock.mockRejectedValue(new Error('blocked'))

    await expect(isInChina()).resolves.toBe(false)
  })

  it('settles even when every probe hangs forever', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(neverSettles)

    const verdict = isInChina()
    for (const _ of [0, 1]) await vi.advanceTimersByTimeAsync(2000)

    expect(
      await settlementOf(verdict),
      'an unbounded probe would pin the sign-up form on a skeleton forever'
    ).toBe(false)
  })
})
