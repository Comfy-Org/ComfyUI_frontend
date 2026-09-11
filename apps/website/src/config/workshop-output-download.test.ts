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
    const clicks = recordClicks()
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
  })

  it('opens output from a host without CORS in a new tab instead of leaving the page', async () => {
    const clicks = recordClicks()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof globalThis.fetch>(async () => {
        throw new TypeError('Failed to fetch')
      })
    )
    const open = vi.spyOn(window, 'open').mockReturnValue(null)

    await downloadOutput('https://gen.krea.ai/images/a.png', 'krea.png')

    expect(clicks).toEqual([])
    expect(open).toHaveBeenCalledWith(
      'https://gen.krea.ai/images/a.png',
      '_blank',
      'noopener'
    )
  })
})
