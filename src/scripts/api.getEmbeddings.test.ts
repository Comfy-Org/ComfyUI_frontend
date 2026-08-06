import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

// Tests for api.getEmbeddings; fetchApi is stubbed.
const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body))
  }) as unknown as Response

const htmlResponse = (status: number, body: string) =>
  ({
    ok: false,
    status,
    json: () => Promise.reject(new SyntaxError('Unexpected token <')),
    text: () => Promise.resolve(body)
  }) as unknown as Response

describe('api.getEmbeddings', () => {
  let fetchApiSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchApiSpy = vi.spyOn(api, 'fetchApi')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves the embeddings list on success', async () => {
    fetchApiSpy.mockResolvedValueOnce(jsonResponse(200, ['emb-a', 'emb-b']))

    await expect(api.getEmbeddings()).resolves.toEqual(['emb-a', 'emb-b'])
    expect(fetchApiSpy).toHaveBeenCalledWith('/embeddings', {
      cache: 'no-store'
    })
  })

  it('rejects identifiably on a non-ok response with a JSON body', async () => {
    fetchApiSpy.mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }))

    await expect(api.getEmbeddings()).rejects.toSatisfy(
      (e) =>
        e instanceof Error &&
        e.name === 'ApiHttpError' &&
        e.message.includes('/embeddings') &&
        e.message.includes('500')
    )
  })

  it('keeps the status even when reading the failure body itself rejects', async () => {
    fetchApiSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      text: () => Promise.reject(new Error('body stream lost'))
    } as unknown as Response)

    await expect(api.getEmbeddings()).rejects.toSatisfy(
      (e) =>
        e instanceof Error &&
        e.name === 'ApiHttpError' &&
        e.message.includes('/embeddings') &&
        e.message.includes('500')
    )
  })

  it('rejects identifiably when the fetch itself fails (backend down)', async () => {
    fetchApiSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(api.getEmbeddings()).rejects.toSatisfy(
      (e) =>
        e instanceof Error &&
        e.name === 'ApiHttpError' &&
        e.message.includes('/embeddings') &&
        e.message.includes('Failed to fetch')
    )
  })

  it('rejects identifiably on a non-ok response with an HTML body', async () => {
    fetchApiSpy.mockResolvedValueOnce(
      htmlResponse(502, '<html>bad gateway</html>')
    )

    await expect(api.getEmbeddings()).rejects.toSatisfy(
      (e) =>
        e instanceof Error &&
        e.name === 'ApiHttpError' &&
        e.message.includes('/embeddings') &&
        e.message.includes('502')
    )
  })
})
