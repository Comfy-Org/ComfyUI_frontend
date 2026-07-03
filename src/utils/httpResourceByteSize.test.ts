import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchHttpResourceByteSize } from './httpResourceByteSize'

describe('fetchHttpResourceByteSize', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns Content-Length from a plausible HEAD response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: { 'Content-Length': '5242880' }
      })
    )

    await expect(
      fetchHttpResourceByteSize('https://example.com/video.mp4')
    ).resolves.toBe(5242880)
  })

  it('ignores implausible HEAD Content-Length and falls back to Range', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'Content-Length': '53' }
        })
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 206,
          headers: { 'Content-Range': 'bytes 0-0/5242880' }
        })
      )

    await expect(
      fetchHttpResourceByteSize('https://example.com/video.mp4')
    ).resolves.toBe(5242880)
  })

  it('returns undefined when neither HEAD nor Range expose a total size', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))

    await expect(
      fetchHttpResourceByteSize('https://example.com/video.mp4')
    ).resolves.toBeUndefined()
  })

  it('uses Content-Length from a full-body Range fallback response', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'Content-Length': '5242880' }
        })
      )

    await expect(
      fetchHttpResourceByteSize('https://example.com/video.mp4')
    ).resolves.toBe(5242880)
  })
})
