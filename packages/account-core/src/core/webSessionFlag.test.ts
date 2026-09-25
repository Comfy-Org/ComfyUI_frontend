import { describe, expect, it, vi } from 'vitest'

import {
  readWebSessionProbe,
  resolveUnifiedWebSession
} from './webSessionFlag.js'

const CLOUD = 'https://cloud.example'
const FEATURES_URL = `${CLOUD}/api/features`

function jsonFetch(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(body), { status })
  )
}

function neverSettlingFetch() {
  return vi.fn<typeof fetch>(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        })
      })
  )
}

function sentInit(fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>) {
  const [url, init] = fetchImpl.mock.calls[0] ?? []
  const { signal, ...rest } = init ?? {}
  return { url, init: rest, hasSignal: signal instanceof AbortSignal }
}

const FAILURES: ReadonlyArray<{
  name: string
  fetchImpl: () => ReturnType<typeof vi.fn<typeof fetch>>
}> = [
  { name: 'a non-2xx response', fetchImpl: () => jsonFetch({}, 503) },
  {
    name: 'a network failure',
    fetchImpl: () =>
      vi.fn<typeof fetch>(async () => {
        throw new TypeError('Failed to fetch')
      })
  },
  {
    name: 'an unparseable body',
    fetchImpl: () => vi.fn<typeof fetch>(async () => new Response('not json'))
  },
  { name: 'a non-object body', fetchImpl: () => jsonFetch(null) }
]

describe('readWebSessionProbe', () => {
  it('sends a plain anonymous GET: no credentials, headers, or cache mode', async () => {
    const fetchImpl = jsonFetch({})

    await readWebSessionProbe({ cloudBaseUrl: CLOUD, fetchImpl })

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(sentInit(fetchImpl)).toEqual({
      url: FEATURES_URL,
      init: {},
      hasSignal: true
    })
  })

  it.for([
    { body: {}, expected: false },
    { body: { web_session_probe: false }, expected: false },
    { body: { web_session_probe: 'true' }, expected: false },
    { body: { web_session_probe: 1 }, expected: false },
    { body: { unified_web_session: true }, expected: false },
    { body: { web_session_probe: true }, expected: true }
  ])('reads $body as $expected', async ({ body, expected }) => {
    await expect(
      readWebSessionProbe({ cloudBaseUrl: CLOUD, fetchImpl: jsonFetch(body) })
    ).resolves.toBe(expected)
  })

  it.for(FAILURES)('is off on $name', async ({ fetchImpl }) => {
    await expect(
      readWebSessionProbe({ cloudBaseUrl: CLOUD, fetchImpl: fetchImpl() })
    ).resolves.toBe(false)
  })

  it('is off when the read outruns its timeout', async () => {
    vi.useFakeTimers()
    const read = readWebSessionProbe({
      cloudBaseUrl: CLOUD,
      fetchImpl: neverSettlingFetch(),
      timeoutMs: 100
    })

    await vi.advanceTimersByTimeAsync(100)

    await expect(read).resolves.toBe(false)
  })
})

describe('resolveUnifiedWebSession', () => {
  it.for([
    { name: 'off', probe: async () => false },
    {
      name: 'rejected',
      probe: () => Promise.reject(new Error('probe failed'))
    },
    {
      name: 'thrown',
      probe: (): Promise<boolean> => {
        throw new Error('probe failed')
      }
    }
  ])('sends nothing and is off when the probe is $name', async ({ probe }) => {
    const fetchImpl = jsonFetch({ unified_web_session: true })

    await expect(
      resolveUnifiedWebSession({ cloudBaseUrl: CLOUD, fetchImpl, probe })
    ).resolves.toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends one credentialed read with X-Comfy-Client when the probe is on', async () => {
    const fetchImpl = jsonFetch({ unified_web_session: false })

    await resolveUnifiedWebSession({
      cloudBaseUrl: CLOUD,
      fetchImpl,
      probe: async () => true
    })

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(sentInit(fetchImpl)).toEqual({
      url: FEATURES_URL,
      init: {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'X-Comfy-Client': expect.stringMatching(
            /^@comfyorg\/account-core\/\d+\.\d+\.\d+/
          )
        }
      },
      hasSignal: true
    })
  })

  it.for([
    { body: {}, expected: false },
    { body: { unified_web_session: false }, expected: false },
    { body: { unified_web_session: 'true' }, expected: false },
    { body: { web_session_probe: true }, expected: false },
    { body: { unified_web_session: true }, expected: true }
  ])(
    'answers with the per-user value only: $body is $expected',
    async ({ body, expected }) => {
      await expect(
        resolveUnifiedWebSession({
          cloudBaseUrl: CLOUD,
          fetchImpl: jsonFetch(body),
          probe: async () => true
        })
      ).resolves.toBe(expected)
    }
  )

  it.for(FAILURES)(
    'is off when the credentialed read hits $name',
    async ({ fetchImpl }) => {
      await expect(
        resolveUnifiedWebSession({
          cloudBaseUrl: CLOUD,
          fetchImpl: fetchImpl(),
          probe: async () => true
        })
      ).resolves.toBe(false)
    }
  )

  it('is off when the credentialed read outruns its timeout', async () => {
    vi.useFakeTimers()
    const read = resolveUnifiedWebSession({
      cloudBaseUrl: CLOUD,
      fetchImpl: neverSettlingFetch(),
      timeoutMs: 100,
      probe: async () => true
    })

    await vi.advanceTimersByTimeAsync(100)

    await expect(read).resolves.toBe(false)
  })
})
