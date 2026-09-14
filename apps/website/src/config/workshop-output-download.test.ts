// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

import { attachmentUrl, downloadOutput } from './workshop-output-download'

const signed =
  'https://storage.googleapis.com/gemini-images-dev/xai-videos/a.mp4?Expires=1&GoogleAccessId=sa%40p.iam&Signature=ab%2Bc%3D'

function recordClicks() {
  const clicks: { href: string; download: string; target: string }[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
    function (this: HTMLAnchorElement) {
      clicks.push({
        href: this.href,
        download: this.download,
        target: this.target
      })
    }
  )
  return clicks
}

describe('attachmentUrl', () => {
  it('asks Cloud Storage for an attachment without disturbing a V2 signature', () => {
    expect(attachmentUrl(signed, 'grok video.mp4')).toBe(
      `${signed}&response-content-disposition=attachment%3B%20filename%3D%22grok_video.mp4%22`
    )
  })

  it('adds the only query parameter to a public object', () => {
    expect(
      attachmentUrl('https://storage.googleapis.com/bucket/image.png', 'a.png')
    ).toBe(
      'https://storage.googleapis.com/bucket/image.png?response-content-disposition=attachment%3B%20filename%3D%22a.png%22'
    )
  })

  it.for([
    'https://storage.googleapis.com/bucket/image.png?X-Goog-Signature=abc',
    'https://cdn.example.com/image.png',
    'http://storage.googleapis.com/bucket/image.png',
    'not a url'
  ])('leaves %s unchanged', (url) => {
    expect(attachmentUrl(url, 'a.png')).toBeUndefined()
  })
})

describe('downloadOutput', () => {
  it('downloads Cloud Storage output through an attachment URL without fetching it', async () => {
    const clicks = recordClicks()
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.stubGlobal('fetch', fetch)

    await downloadOutput(signed, 'grok.mp4')

    expect(fetch).not.toHaveBeenCalled()
    expect(clicks).toEqual([
      {
        href: attachmentUrl(signed, 'grok.mp4'),
        download: 'grok.mp4',
        target: '_blank'
      }
    ])
  })

  it('downloads a slow body without opening a tab or timing out after headers', async () => {
    vi.useFakeTimers()
    const clicks = recordClicks()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const body = Promise.withResolvers<void>()
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        new ReadableStream({
          async start(controller) {
            await body.promise
            controller.enqueue(new TextEncoder().encode('video'))
            controller.close()
          }
        }),
        { headers: { 'Content-Type': 'video/mp4' } }
      )
    )
    vi.stubGlobal('fetch', fetch)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(
      'blob:https://comfy.org/output'
    )

    const result = downloadOutput(
      'https://cdn.example.com/render.mp4',
      'wan-video.mp4'
    )
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetch.mock.lastCall?.[1]?.signal?.aborted).toBe(false)
    expect(open).not.toHaveBeenCalled()
    expect(clicks).toEqual([])
    body.resolve()
    await expect(result).resolves.toBe(true)

    expect(clicks).toEqual([
      {
        href: 'blob:https://comfy.org/output',
        download: 'wan-video.mp4',
        target: ''
      }
    ])
    expect(open).not.toHaveBeenCalled()
    expect(revoke).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(revoke).toHaveBeenCalledWith('blob:https://comfy.org/output')
  })

  it.for(['network', 403, 500])(
    'keeps the output reachable after %s download failure',
    async (failure) => {
      const clicks = recordClicks()
      const response = Promise.withResolvers<Response>()
      const fetch = vi.fn<typeof globalThis.fetch>(() => response.promise)
      vi.stubGlobal('fetch', fetch)
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      const blob = vi.spyOn(URL, 'createObjectURL')
      const result = downloadOutput(
        'https://gen.krea.ai/images/a.png',
        'krea.png'
      )

      expect(open).not.toHaveBeenCalled()
      if (typeof failure === 'string')
        response.reject(new TypeError('Failed to fetch'))
      else response.resolve(new Response('Access denied', { status: failure }))
      await expect(result).resolves.toBe(false)

      expect(open).toHaveBeenCalledWith(
        'https://gen.krea.ai/images/a.png',
        '_blank',
        'noopener'
      )
      expect(open).toHaveBeenCalledOnce()
      expect(blob).not.toHaveBeenCalled()
      expect(clicks).toEqual([])
    }
  )

  it('bounds only the header wait before attempting the fallback', async () => {
    vi.useFakeTimers()
    const clicks = recordClicks()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const fetch = vi.fn<typeof globalThis.fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(init.signal?.reason),
            { once: true }
          )
        })
    )
    vi.stubGlobal('fetch', fetch)
    const result = downloadOutput('https://cdn.example.com/a.png', 'a.png')
    await vi.advanceTimersByTimeAsync(3_999)
    expect(open).not.toHaveBeenCalled()
    expect(fetch.mock.lastCall?.[1]?.signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expect(result).resolves.toBe(false)
    expect(fetch.mock.lastCall?.[1]?.signal?.aborted).toBe(true)
    expect(open).toHaveBeenCalledWith(
      'https://cdn.example.com/a.png',
      '_blank',
      'noopener'
    )
    expect(clicks).toEqual([])
  })

  it('reports a late body failure without navigating away from the Models page', async () => {
    vi.useFakeTimers()
    const body = Promise.withResolvers<void>()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(
          new ReadableStream({
            async start() {
              await body.promise
              throw new TypeError('Connection lost')
            }
          })
        )
      )
    )
    const clicks = recordClicks()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const result = downloadOutput('https://cdn.example.com/a.png', 'a.png')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(open).not.toHaveBeenCalled()
    body.resolve()
    await expect(result).resolves.toBe(false)
    expect(open).toHaveBeenCalledOnce()
    expect(clicks).toEqual([])
  })

  it.for(['blob:https://comfy.org/output', 'data:image/png;base64,AA=='])(
    'downloads local output without a network request or popup: %s',
    async (url) => {
      const clicks = recordClicks()
      const fetch = vi.fn<typeof globalThis.fetch>()
      vi.stubGlobal('fetch', fetch)
      const open = vi.spyOn(window, 'open')
      await downloadOutput(url, 'output.png')
      expect(clicks).toEqual([
        { href: url, download: 'output.png', target: '' }
      ])
      expect(fetch).not.toHaveBeenCalled()
      expect(open).not.toHaveBeenCalled()
    }
  )

  it('preserves a fragment and sanitizes an empty download filename', () => {
    expect(attachmentUrl(`${signed}#frame`, '')).toBe(
      `${signed}&response-content-disposition=attachment%3B%20filename%3D%22output%22#frame`
    )
    expect(
      attachmentUrl(`${signed}&response-content-disposition=inline`, 'a.mp4')
    ).toBeUndefined()
  })
})
