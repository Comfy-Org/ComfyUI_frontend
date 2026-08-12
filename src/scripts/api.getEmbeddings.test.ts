import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EmbeddingsApiError, api } from '@/scripts/api'

describe('api.getEmbeddings', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns the parsed embeddings', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify(['embedding-a', 'embedding-b']), {
        status: 200
      })
    )

    await expect(api.getEmbeddings()).resolves.toEqual([
      'embedding-a',
      'embedding-b'
    ])
  })

  it('throws EmbeddingsApiError for a failed JSON response', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500
      })
    )

    const request = api.getEmbeddings()

    await expect(request).rejects.toBeInstanceOf(EmbeddingsApiError)
    await expect(request).rejects.toHaveProperty('status', 500)
  })

  it('throws EmbeddingsApiError for a failed HTML response', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('<html>Internal Server Error</html>', {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      })
    )

    const request = api.getEmbeddings()

    await expect(request).rejects.toBeInstanceOf(EmbeddingsApiError)
    await expect(request).rejects.toHaveProperty('status', 500)
  })
})
