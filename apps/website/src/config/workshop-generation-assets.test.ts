import { describe, expect, it, vi } from 'vitest'

import {
  WORKSHOP_CLOUD_BASE_URL,
  WORKSHOP_ROUTER_BASE_URL
} from './workshop-env'
import {
  GenerationAccessError,
  accessWorkshopAsset,
  cancelWorkshopGeneration,
  generationPending,
  getWorkshopGeneration,
  listWorkshopGenerations
} from './workshop-generation-assets'
import type { SavedGeneration } from './workshop-generation-assets'

const REQUEST_ID = '18655193-3f73-4abf-b49c-1c6a058355bc'
const ASSET_ID = '0b5a1f2c-7e2b-4a19-9f2e-1a6c3f9d8e77'
const TOKEN = 'test-token'

function generation(over: Partial<SavedGeneration> = {}): SavedGeneration {
  return {
    request_id: REQUEST_ID,
    provider: 'black-forest-labs',
    model: 'flux-2-pro',
    created_at: '2026-09-20T12:00:00Z',
    status: 'COMPLETED',
    asset_save_status: 'saved',
    asset_outputs: [
      { index: 0, asset_id: ASSET_ID, kind: 'image', status: 'saved' }
    ],
    ...over
  }
}

function stubFetch(...responses: Response[]) {
  const calls = vi.fn<typeof fetch>()
  for (const response of responses) calls.mockResolvedValueOnce(response)
  vi.stubGlobal('fetch', calls)
  return calls
}

const signal = () => new AbortController().signal
const requestedUrl = (calls: ReturnType<typeof stubFetch>, index = 0) =>
  String(calls.mock.calls[index][0])

describe('listWorkshopGenerations', () => {
  it('asks only for the runs this site started', async () => {
    const calls = stubFetch(Response.json({ requests: [] }))

    await listWorkshopGenerations(TOKEN, signal())

    const url = new URL(requestedUrl(calls))
    expect(url.origin + url.pathname).toBe(
      `${WORKSHOP_ROUTER_BASE_URL}/v2/models/requests`
    )
    expect(url.searchParams.get('usage_source')).toBe('comfy-models')
    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.get('provider')).toBeNull()
    expect(
      new Headers(calls.mock.calls[0][1]?.headers).get('Authorization')
    ).toBe(`Bearer ${TOKEN}`)
  })

  // A model id is one string carrying two, split on its first slash, and each
  // half reaches the query as a value rather than as more path.
  it.for([
    {
      modelId: 'black-forest-labs/flux-2-pro',
      provider: 'black-forest-labs',
      model: 'flux-2-pro'
    },
    { modelId: 'fal/flux/dev', provider: 'fal', model: 'flux/dev' },
    { modelId: 'a b&c/d=e', provider: 'a b&c', model: 'd=e' }
  ])(
    'splits $modelId into $provider and $model',
    async ({ modelId, provider, model }) => {
      const calls = stubFetch(Response.json({ requests: [] }))

      await listWorkshopGenerations(TOKEN, signal(), modelId, 'page-2')

      const url = new URL(requestedUrl(calls))
      expect(url.searchParams.get('provider')).toBe(provider)
      expect(url.searchParams.get('model')).toBe(model)
      expect(url.searchParams.get('cursor')).toBe('page-2')
    }
  )

  it('refuses a history that does not match the contract', async () => {
    stubFetch(Response.json({ requests: [{ request_id: 'not-a-uuid' }] }))

    await expect(listWorkshopGenerations(TOKEN, signal())).rejects.toThrow()
  })

  it('reports the status when the router refuses', async () => {
    stubFetch(Response.json({}, { status: 403 }))

    await expect(
      listWorkshopGenerations(TOKEN, signal())
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe('accessWorkshopAsset', () => {
  it('asks Cloud for one asset and takes back an https address', async () => {
    const calls = stubFetch(
      Response.json({
        content_url: 'https://assets.example/one.png',
        expires_at: '2026-09-20T13:00:00Z'
      })
    )

    const access = await accessWorkshopAsset(ASSET_ID, TOKEN, signal())

    expect(requestedUrl(calls)).toBe(
      `${WORKSHOP_CLOUD_BASE_URL}/api/assets/${ASSET_ID}/access`
    )
    expect(calls.mock.calls[0][1]?.method).toBe('POST')
    expect(access.content_url).toBe('https://assets.example/one.png')
  })

  // A result is media the browser will load, so an address that is not https
  // is one this page must not hand to an element.
  it.for([
    { url: 'http://assets.example/one.png', named: 'plain http' },
    { url: 'javascript:alert(1)', named: 'a script address' },
    { url: 'not a url at all', named: 'no address at all' }
  ])('refuses $named', async ({ url }) => {
    stubFetch(
      Response.json({ content_url: url, expires_at: '2026-09-20T13:00:00Z' })
    )

    await expect(
      accessWorkshopAsset(ASSET_ID, TOKEN, signal())
    ).rejects.toThrow()
  })
})

describe('getWorkshopGeneration', () => {
  it('puts the model back onto a status that does not carry it', async () => {
    const { provider, model, ...status } = generation()
    const calls = stubFetch(Response.json(status))

    const found = await getWorkshopGeneration(
      `${provider}/${model}`,
      REQUEST_ID,
      TOKEN,
      signal()
    )

    expect(requestedUrl(calls)).toBe(
      `${WORKSHOP_ROUTER_BASE_URL}/v2/models/${provider}/${model}/requests/${REQUEST_ID}/status`
    )
    expect(found).toEqual({ ...status, provider, model })
  })

  // A run the router has forgotten is not an error: the address it came from
  // may simply be older than the history the router keeps.
  it('answers with nothing when the router has no such run', async () => {
    stubFetch(Response.json({}, { status: 404 }))

    await expect(
      getWorkshopGeneration(
        'black-forest-labs/flux-2-pro',
        REQUEST_ID,
        TOKEN,
        signal()
      )
    ).resolves.toBeUndefined()
  })

  it('does not ask about a request id that cannot be one', async () => {
    const calls = stubFetch()

    await expect(
      getWorkshopGeneration(
        'black-forest-labs/flux-2-pro',
        'yesterday',
        TOKEN,
        signal()
      )
    ).resolves.toBeUndefined()
    expect(calls).not.toHaveBeenCalled()
  })

  it('lets any other refusal through', async () => {
    stubFetch(Response.json({}, { status: 500 }))

    await expect(
      getWorkshopGeneration(
        'black-forest-labs/flux-2-pro',
        REQUEST_ID,
        TOKEN,
        signal()
      )
    ).rejects.toBeInstanceOf(GenerationAccessError)
  })
})

describe('cancelWorkshopGeneration', () => {
  it('names the run in the path it asks to stop', async () => {
    const calls = stubFetch(Response.json({}, { status: 202 }))

    await cancelWorkshopGeneration(generation(), TOKEN, signal())

    expect(requestedUrl(calls)).toBe(
      `${WORKSHOP_ROUTER_BASE_URL}/v2/models/black-forest-labs/flux-2-pro/requests/${REQUEST_ID}/cancel`
    )
    expect(calls.mock.calls[0][1]?.method).toBe('PUT')
  })
})

// The strip keeps asking while a run has somewhere left to get to: the result
// itself, and then the saved copy of it.
describe('generationPending', () => {
  it.for([
    { status: 'IN_QUEUE', save: 'pending', pending: true },
    { status: 'IN_PROGRESS', save: 'saving', pending: true },
    { status: 'COMPLETED', save: 'pending', pending: true },
    { status: 'COMPLETED', save: 'saving', pending: true },
    { status: 'COMPLETED', save: 'saved', pending: false },
    { status: 'COMPLETED', save: 'partial', pending: false },
    { status: 'COMPLETED', save: 'failed', pending: false },
    { status: 'COMPLETED', save: 'not_applicable', pending: false }
  ] as const)(
    '$status and $save is pending: $pending',
    ({ status, save, pending }) => {
      expect(
        generationPending(generation({ status, asset_save_status: save }))
      ).toBe(pending)
    }
  )
})
