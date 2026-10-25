import { respondToFetch } from '@comfyorg/test-utils/fetch'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getClientCountry, isInChina } from './regionProbe'

const TRACE_URL = 'https://cloud.comfy.org/cdn-cgi/trace'
const GOOGLE_URL = 'https://www.google.com'
const BAIDU_URL = 'https://www.baidu.com'

const traceResponse = (body: string, ok = true) =>
  new Response(body, { status: ok ? 200 : 503 })

const TRACE_BODY = (loc: string) =>
  `fl=1187f27\nh=cloud.comfy.org\nloc=${loc}\ntls=TLSv1.3\n`

/** Blackholes: never settles and ignores the abort signal. */
const neverSettles = () => new Promise<Response>(() => {})

/** Resolves to the settled value, or to `PENDING` if the promise has not. */
const settlementOf = <T>(promise: Promise<T>) =>
  Promise.race([promise, Promise.resolve().then(() => 'PENDING' as const)])

beforeEach(() => {
  vi.stubGlobal('navigator', { language: 'en-US' })
})

describe('getClientCountry', () => {
  it('returns the uppercased loc value from the edge trace', async () => {
    respondToFetch(TRACE_URL, () => traceResponse(TRACE_BODY('cn')))

    await expect(getClientCountry()).resolves.toBe('CN')
  })

  it.for([
    [
      'a non-200 response',
      () => Promise.resolve(traceResponse('loc=CN', false))
    ],
    [
      'a body with no loc line',
      () => Promise.resolve(traceResponse('h=x\nts=1'))
    ],
    ['an empty loc value', () => Promise.resolve(traceResponse('loc=\n'))],
    [
      'an unknown-country sentinel',
      () => Promise.resolve(traceResponse(TRACE_BODY('XX')))
    ],
    ['a Tor sentinel', () => Promise.resolve(traceResponse(TRACE_BODY('T1')))],
    ['a network error', () => Promise.reject(new Error('offline'))]
  ] as const)('returns undefined for %s', async ([, respond]) => {
    respondToFetch(TRACE_URL, respond)

    await expect(getClientCountry()).resolves.toBeUndefined()
  })

  it('gives up rather than hanging when the edge never answers', async () => {
    vi.useFakeTimers()
    respondToFetch(TRACE_URL, neverSettles)

    const country = getClientCountry()
    expect(await settlementOf(country)).toBe('PENDING')

    await vi.advanceTimersByTimeAsync(2000)

    expect(await settlementOf(country)).toBeUndefined()
  })

  it('gives up when the edge sends headers and then stalls the body', async () => {
    vi.useFakeTimers()
    respondToFetch(
      TRACE_URL,
      () => new Response(new ReadableStream({ start() {} }))
    )

    const country = getClientCountry()
    expect(await settlementOf(country)).toBe('PENDING')

    await vi.advanceTimersByTimeAsync(2000)

    expect(await settlementOf(country)).toBeUndefined()
  })
})

describe('isInChina', () => {
  it('trusts the edge answer over the reachability heuristic', async () => {
    respondToFetch(TRACE_URL, () => traceResponse(TRACE_BODY('CN')))

    await expect(isInChina()).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reports outside China when the edge names another country', async () => {
    respondToFetch(TRACE_URL, () => traceResponse(TRACE_BODY('IN')))

    await expect(isInChina()).resolves.toBe(false)
  })

  it('reports inside China when only Baidu answers, and fast', async () => {
    respondToFetch(TRACE_URL, () => Promise.reject(new Error('blocked')))
    respondToFetch(GOOGLE_URL, () => Promise.reject(new Error('blocked')))
    respondToFetch(BAIDU_URL, () => new Response())

    await expect(
      isInChina(),
      'a China-routed client on a non-zh locale is only detectable by Baidu latency'
    ).resolves.toBe(true)
  })

  it.for(['XX', 'T1'] as const)(
    'falls back to the heuristic when the edge answers %s',
    async (sentinel) => {
      vi.stubGlobal('navigator', { language: 'zh-CN' })
      respondToFetch({}, () => Promise.reject(new Error('blocked')))
      respondToFetch(TRACE_URL, () => traceResponse(TRACE_BODY(sentinel)))

      await expect(
        isInChina(),
        'a sentinel names no country, so treating it as "not China" would wave through Tor and unknown-IP clients'
      ).resolves.toBe(true)
    }
  )

  it('reports outside China when the edge is down but Google answers', async () => {
    respondToFetch(TRACE_URL, () => Promise.reject(new Error('edge down')))
    respondToFetch(GOOGLE_URL, () => new Response())

    await expect(isInChina()).resolves.toBe(false)
  })

  it('falls back to the locale when neither probe answers', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('blocked'))

    await expect(isInChina()).resolves.toBe(false)
  })

  it('falls back to the reachability heuristic when the edge cannot answer', async () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' })
    respondToFetch({}, () => Promise.reject(new Error('blocked')))
    respondToFetch(TRACE_URL, () => Promise.reject(new Error('edge down')))

    await expect(isInChina()).resolves.toBe(true)
  })

  it('settles even when every probe hangs forever', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementation(neverSettles)

    const verdict = isInChina()
    for (const _ of [0, 1, 2]) await vi.advanceTimersByTimeAsync(2000)

    expect(await settlementOf(verdict)).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
