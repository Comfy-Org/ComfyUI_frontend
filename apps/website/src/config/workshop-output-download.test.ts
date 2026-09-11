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

  it('saves output from a host that allows CORS under its file name', async () => {
    vi.useFakeTimers()
    const clicks = recordClicks()
    vi.spyOn(window, 'open').mockReturnValue(window)
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof globalThis.fetch>(
        async () => new Response(new Blob(['video'], { type: 'video/mp4' }))
      )
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(
      'blob:https://comfy.org/output'
    )

    await downloadOutput('https://cdn.example.com/render.mp4', 'wan-video.mp4')

    expect(clicks).toEqual([
      {
        href: 'blob:https://comfy.org/output',
        download: 'wan-video.mp4',
        target: ''
      }
    ])
    expect(close).toHaveBeenCalledOnce()
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
      const open = vi.spyOn(window, 'open').mockReturnValue(window)
      const navigate = vi
        .spyOn(window.location, 'replace')
        .mockImplementation(() => {})
      const close = vi.spyOn(window, 'close').mockImplementation(() => {})
      const blob = vi.spyOn(URL, 'createObjectURL')
      const result = downloadOutput(
        'https://gen.krea.ai/images/a.png',
        'krea.png'
      )

      expect(open).toHaveBeenCalledWith('about:blank', '_blank')
      expect(open.mock.invocationCallOrder[0]).toBeLessThan(
        fetch.mock.invocationCallOrder[0]
      )
      expect(window.opener).toBeNull()
      expect(navigate).not.toHaveBeenCalled()
      if (typeof failure === 'string')
        response.reject(new TypeError('Failed to fetch'))
      else response.resolve(new Response('Access denied', { status: failure }))
      await result

      expect(navigate).toHaveBeenCalledWith('https://gen.krea.ai/images/a.png')
      expect(open).toHaveBeenCalledOnce()
      expect(close).not.toHaveBeenCalled()
      expect(blob).not.toHaveBeenCalled()
      expect(clicks).toEqual([])
    }
  )

  it('does not reopen a fallback the user closed while the download was pending', async () => {
    const response = Promise.withResolvers<Response>()
    vi.stubGlobal('fetch', () => response.promise)
    const open = vi.spyOn(window, 'open').mockReturnValue(window)
    vi.spyOn(window, 'closed', 'get').mockReturnValue(true)
    const navigate = vi
      .spyOn(window.location, 'replace')
      .mockImplementation(() => {})
    const result = downloadOutput('https://cdn.example.com/a.png', 'a.png')
    response.resolve(new Response(null, { status: 403 }))
    await result
    expect(navigate).not.toHaveBeenCalled()
    expect(open).toHaveBeenCalledOnce()
  })

  it('retains a native download when the browser refused the fallback window', async () => {
    const clicks = recordClicks()
    vi.spyOn(window, 'open').mockReturnValue(null)
    vi.stubGlobal('fetch', async () => new Response(null, { status: 500 }))
    await downloadOutput('https://cdn.example.com/a.png', 'a.png')
    expect(clicks).toEqual([
      { href: 'https://cdn.example.com/a.png', download: 'a.png', target: '' }
    ])
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
