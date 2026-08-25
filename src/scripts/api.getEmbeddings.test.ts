import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

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

  it('rejects a non-OK response with the route and status', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500
      })
    )

    await expect(api.getEmbeddings()).rejects.toThrow(
      'Failed to fetch /embeddings: 500'
    )
  })

  it('rejects a successful response with a non-JSON body', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('<html>Internal Server Error</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    )

    await expect(api.getEmbeddings()).rejects.toBeInstanceOf(SyntaxError)
  })

  it('rejects a successful response with the wrong shape', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ embeddings: ['embedding-a'] }), {
        status: 200
      })
    )

    await expect(api.getEmbeddings()).rejects.toMatchObject({
      name: 'ZodError'
    })
  })
})
