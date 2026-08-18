import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { DEFAULT_CMS_URL, loadList } from './cmsContent'

const TestSchema = z.object({
  docs: z.array(z.object({ id: z.string(), name: z.string() }))
})

const testCollection = {
  slug: 'things',
  list: {
    query: 'limit=10',
    schema: TestSchema,
    toItem: (doc: { id: string; name: string }, base: string) => ({
      id: doc.id,
      label: doc.name,
      base
    })
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

describe('loadList', () => {
  it('fetches from DEFAULT_CMS_URL when nothing is configured', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ docs: [] }))

    await loadList(testCollection, {
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      `${DEFAULT_CMS_URL}/api/things?limit=10`,
      expect.objectContaining({ headers: undefined })
    )
  })

  it('uses an explicit cmsUrl and trims a trailing slash', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ docs: [] }))

    await loadList(testCollection, {
      cmsUrl: 'https://cms.test/',
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://cms.test/api/things?limit=10',
      expect.anything()
    )
  })

  it('flattens docs through the collection transform', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ docs: [{ id: 'a', name: 'Alpha' }] })
    )

    const items = await loadList(testCollection, {
      cmsUrl: 'https://cms.test',
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(items).toEqual([
      { id: 'a', label: 'Alpha', base: 'https://cms.test' }
    ])
  })

  it('requests drafts with the API-key header when draft + apiKey are set', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ docs: [] }))

    await loadList(testCollection, {
      cmsUrl: 'https://cms.test',
      draft: true,
      apiKey: 'secret-key',
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://cms.test/api/things?limit=10&draft=true',
      { headers: { Authorization: 'users API-Key secret-key' } }
    )
  })

  it('requests drafts without an auth header when no apiKey is provided', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ docs: [] }))

    await loadList(testCollection, {
      cmsUrl: 'https://cms.test',
      draft: true,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://cms.test/api/things?limit=10&draft=true',
      expect.objectContaining({ headers: undefined })
    )
  })

  it('throws on a non-OK response, naming the collection', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 }))

    await expect(
      loadList(testCollection, {
        cmsUrl: 'https://cms.test',
        fetchImpl: fetchImpl as unknown as typeof fetch
      })
    ).rejects.toThrow('[things] CMS responded 500')
  })

  it('propagates a fetch/network rejection', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })

    await expect(
      loadList(testCollection, {
        cmsUrl: 'https://cms.test',
        fetchImpl: fetchImpl as unknown as typeof fetch
      })
    ).rejects.toThrow('ECONNREFUSED')
  })

  it('throws when the response fails schema validation', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ docs: [{ id: 'a' }] }))

    await expect(
      loadList(testCollection, {
        cmsUrl: 'https://cms.test',
        fetchImpl: fetchImpl as unknown as typeof fetch
      })
    ).rejects.toThrow('[things] CMS response failed schema validation')
  })
})
