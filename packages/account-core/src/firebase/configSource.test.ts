import { describe, expect, it, vi } from 'vitest'

import {
  fetchCloudFeatures,
  fetchFirebaseConfig,
  fetchStripePublishableKey
} from './configSource.js'

const VALID_CONFIG = {
  apiKey: 'api-key',
  authDomain: 'cloud.firebaseapp.com',
  projectId: 'cloud',
  appId: '1:1:web:1'
}

function jsonFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

function neverSettlingFetch(): typeof fetch {
  return vi.fn(
    (_url, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'))
        })
      })
  )
}

describe('fetchFirebaseConfig', () => {
  it('extracts the required and optional fields from a valid response', async () => {
    const fetchImpl = jsonFetch({
      firebase_config: {
        ...VALID_CONFIG,
        databaseURL: 'https://cloud.firebaseio.com',
        storageBucket: 'cloud.appspot.com',
        messagingSenderId: '42',
        measurementId: 'G-1'
      }
    })

    await expect(
      fetchFirebaseConfig('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toEqual({
      ...VALID_CONFIG,
      databaseURL: 'https://cloud.firebaseio.com',
      storageBucket: 'cloud.appspot.com',
      messagingSenderId: '42',
      measurementId: 'G-1'
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://cloud.comfy.org/api/features',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('carries no optional field that the response omits', async () => {
    const fetchImpl = jsonFetch({ firebase_config: VALID_CONFIG })

    await expect(
      fetchFirebaseConfig('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toEqual(VALID_CONFIG)
  })

  it.for(['apiKey', 'authDomain', 'projectId', 'appId'] as const)(
    'offers no configuration when %s is missing',
    async (missing) => {
      const config = { ...VALID_CONFIG, [missing]: undefined }
      const fetchImpl = jsonFetch({ firebase_config: config })

      await expect(
        fetchFirebaseConfig('https://cloud.comfy.org', { fetchImpl })
      ).resolves.toBeUndefined()
    }
  )

  it('offers no configuration when firebase_config is absent', async () => {
    const fetchImpl = jsonFetch({})

    await expect(
      fetchFirebaseConfig('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toBeUndefined()
  })

  it('offers no configuration on a non-OK response', async () => {
    const fetchImpl = jsonFetch({ firebase_config: VALID_CONFIG }, 500)

    await expect(
      fetchFirebaseConfig('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toBeUndefined()
  })

  it('offers no configuration on a malformed body', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('not json', { status: 200 })
    )

    await expect(
      fetchFirebaseConfig('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toBeUndefined()
  })

  it('offers no configuration when the body is not an object', async () => {
    const fetchImpl = jsonFetch('firebase_config')

    await expect(
      fetchFirebaseConfig('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toBeUndefined()
  })

  it('offers no configuration on a network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(
      fetchFirebaseConfig('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toBeUndefined()
  })

  it('offers no configuration when the fetch outruns the timeout', async () => {
    vi.useFakeTimers()
    try {
      const fetchImpl = neverSettlingFetch()
      const result = fetchFirebaseConfig('https://cloud.comfy.org', {
        fetchImpl,
        timeoutMs: 5
      })

      await vi.advanceTimersByTimeAsync(5)

      await expect(result).resolves.toBeUndefined()
      expect(fetchImpl).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('fetchStripePublishableKey', () => {
  it('extracts the key from a valid response', async () => {
    const fetchImpl = jsonFetch({ stripe_publishable_key: 'pk_live_123' })

    await expect(
      fetchStripePublishableKey('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toBe('pk_live_123')
  })

  it('offers no key when the field is absent', async () => {
    const fetchImpl = jsonFetch({})

    await expect(
      fetchStripePublishableKey('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toBeUndefined()
  })

  it('offers no key when the field is an empty string', async () => {
    const fetchImpl = jsonFetch({ stripe_publishable_key: '' })

    await expect(
      fetchStripePublishableKey('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toBeUndefined()
  })

  it('offers no key when the field is not a string', async () => {
    const fetchImpl = jsonFetch({ stripe_publishable_key: 42 })

    await expect(
      fetchStripePublishableKey('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toBeUndefined()
  })

  it('offers no key on a non-OK response', async () => {
    const fetchImpl = jsonFetch({ stripe_publishable_key: 'pk_live_123' }, 500)

    await expect(
      fetchStripePublishableKey('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toBeUndefined()
  })
})

describe('fetchCloudFeatures', () => {
  it('reads the Firebase config and the Stripe key from one fetch', async () => {
    const fetchImpl = jsonFetch({
      firebase_config: VALID_CONFIG,
      stripe_publishable_key: 'pk_live_123'
    })

    await expect(
      fetchCloudFeatures('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toEqual({
      firebaseConfig: VALID_CONFIG,
      stripePublishableKey: 'pk_live_123'
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('offers neither field when the document omits both', async () => {
    const fetchImpl = jsonFetch({})

    await expect(
      fetchCloudFeatures('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toEqual({
      firebaseConfig: undefined,
      stripePublishableKey: undefined
    })
  })

  it.for([
    { webSessionProbe: undefined, body: {} },
    { webSessionProbe: undefined, body: { web_session_probe: false } },
    { webSessionProbe: undefined, body: { web_session_probe: 'true' } },
    { webSessionProbe: true, body: { web_session_probe: true } }
  ])(
    'carries web_session_probe only as a literal true: $body',
    async ({ body, webSessionProbe }) => {
      const features = await fetchCloudFeatures('https://cloud.comfy.org', {
        fetchImpl: jsonFetch(body)
      })

      expect(features.webSessionProbe).toBe(webSessionProbe)
      expect('webSessionProbe' in features).toBe(webSessionProbe === true)
    }
  )

  it('offers neither field on a network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(
      fetchCloudFeatures('https://cloud.comfy.org', { fetchImpl })
    ).resolves.toEqual({})
  })
})
