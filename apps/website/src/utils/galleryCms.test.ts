import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { visibleGalleryItems } from '../data/gallery'
import { loadGalleryItemsForBuild } from './galleryCms'

const CMS_URL = 'https://cms.test'

describe('loadGalleryItemsForBuild', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the static fallback when no CMS url is configured', async () => {
    const fetchImpl = vi.fn()

    const items = await loadGalleryItemsForBuild({
      cmsUrl: undefined,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(items).toEqual(visibleGalleryItems)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns the static fallback when the CMS is unreachable', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })

    const items = await loadGalleryItemsForBuild({
      cmsUrl: CMS_URL,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(items).toEqual(visibleGalleryItems)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('returns the static fallback on a non-OK response', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 }))

    const items = await loadGalleryItemsForBuild({
      cmsUrl: CMS_URL,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(items).toEqual(visibleGalleryItems)
  })

  it('requests only published docs and flattens them into GalleryItem', async () => {
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
      'https://cms.test/api/gallery?depth=1&limit=100&where[_status][equals]=published'
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

  it('returns the static fallback when the response fails schema validation', async () => {
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

    const items = await loadGalleryItemsForBuild({
      cmsUrl: CMS_URL,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(items).toEqual(visibleGalleryItems)
  })
})
