import { describe, expect, it, vi } from 'vitest'

import { loadGalleryItemsForBuild } from './galleryCms'

const CMS_URL = 'https://cms.test'

describe('loadGalleryItemsForBuild', () => {
  it('throws when no CMS url is configured', async () => {
    const fetchImpl = vi.fn()

    await expect(
      loadGalleryItemsForBuild({
        cmsUrl: undefined,
        fetchImpl: fetchImpl as unknown as typeof fetch
      })
    ).rejects.toThrow('WEBSITE_CMS_URL is not set')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('throws when the CMS is unreachable', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })

    await expect(
      loadGalleryItemsForBuild({
        cmsUrl: CMS_URL,
        fetchImpl: fetchImpl as unknown as typeof fetch
      })
    ).rejects.toThrow('ECONNREFUSED')
  })

  it('throws on a non-OK response', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 }))

    await expect(
      loadGalleryItemsForBuild({
        cmsUrl: CMS_URL,
        fetchImpl: fetchImpl as unknown as typeof fetch
      })
    ).rejects.toThrow('CMS responded 500')
  })

  it('requests trimmed newest-first docs and flattens them into GalleryItem', async () => {
    const body = {
      docs: [
        {
          slug: 'neon-nights',
          title: 'Neon Nights',
          href: 'https://example.com/neon',
          media: {
            url: '/api/media/file/neon.webm',
            mimeType: 'video/webm'
          },
          creator: { name: 'ShaneF Motion Design' },
          team: { name: 'DOGSTUDIO/DEPT®' },
          tool: { name: 'ComfyUI' }
        },
        {
          slug: 'amber-astronaut',
          title: 'Amber Astronaut',
          media: {
            url: '/api/media/file/amber.webp',
            mimeType: 'image/webp'
          },
          creator: { name: 'Yogo' },
          tool: { name: 'ComfyUI' }
        }
      ]
    }
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    )

    const items = await loadGalleryItemsForBuild({
      cmsUrl: CMS_URL,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://cms.test/api/gallery?depth=1&limit=100&sort=-publishedAt&select[title]=true&select[slug]=true&select[href]=true&select[media]=true&select[creator]=true&select[team]=true&select[tool]=true&populate[media][url]=true&populate[media][mimeType]=true&populate[creators][name]=true&populate[teams][name]=true&populate[tools][name]=true'
    )
    expect(items).toEqual([
      {
        id: 'neon-nights',
        title: 'Neon Nights',
        video: 'https://cms.test/api/media/file/neon.webm',
        userAlias: 'ShaneF Motion Design',
        teamAlias: 'DOGSTUDIO/DEPT®',
        tool: 'ComfyUI',
        href: 'https://example.com/neon'
      },
      {
        id: 'amber-astronaut',
        title: 'Amber Astronaut',
        image: 'https://cms.test/api/media/file/amber.webp',
        userAlias: 'Yogo',
        teamAlias: '',
        tool: 'ComfyUI'
      }
    ])
  })

  it('throws when the response fails schema validation', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ docs: [{ title: 'missing everything' }] }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
    )

    await expect(
      loadGalleryItemsForBuild({
        cmsUrl: CMS_URL,
        fetchImpl: fetchImpl as unknown as typeof fetch
      })
    ).rejects.toThrow('failed schema validation')
  })
})
