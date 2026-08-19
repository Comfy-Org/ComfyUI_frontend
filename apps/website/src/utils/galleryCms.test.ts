import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_CMS_URL, loadList } from './cmsContent'
import { galleryCollection } from './galleryCms'

const CMS_URL = 'https://cms.test'

const GALLERY_QUERY =
  'depth=1&limit=100&sort=-publishedAt&select[title]=true&select[slug]=true&select[href]=true&select[thumbnail]=true&select[video]=true&select[creator]=true&select[team]=true&select[tool]=true&populate[thumbnail][url]=true&populate[video][url]=true&populate[creators][name]=true&populate[teams][name]=true&populate[tools][name]=true'

// Generic loader behaviour (drafts, error paths, URL resolution) is covered in
// cmsContent.test.ts. These tests pin the gallery-specific query and flatten.

describe('galleryCollection', () => {
  it('requests the trimmed newest-first query and flattens docs into GalleryItem', async () => {
    const body = {
      docs: [
        {
          slug: 'neon-nights',
          title: 'Neon Nights',
          href: 'https://example.com/neon',
          thumbnail: { url: '/api/media/file/neon-poster.webp' },
          video: { url: '/api/media/file/neon.webm' },
          creator: { name: 'ShaneF Motion Design' },
          team: { name: 'DOGSTUDIO/DEPT®' },
          tool: { name: 'ComfyUI' }
        },
        {
          slug: 'amber-astronaut',
          title: 'Amber Astronaut',
          thumbnail: { url: '/api/media/file/amber.webp' },
          video: null,
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

    const items = await loadList(galleryCollection, {
      cmsUrl: CMS_URL,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      `${CMS_URL}/api/gallery?${GALLERY_QUERY}`,
      { headers: undefined }
    )
    expect(items).toEqual([
      {
        id: 'neon-nights',
        title: 'Neon Nights',
        thumbnail: 'https://cms.test/api/media/file/neon-poster.webp',
        video: 'https://cms.test/api/media/file/neon.webm',
        userAlias: 'ShaneF Motion Design',
        teamAlias: 'DOGSTUDIO/DEPT®',
        tool: 'ComfyUI',
        href: 'https://example.com/neon'
      },
      {
        id: 'amber-astronaut',
        title: 'Amber Astronaut',
        thumbnail: 'https://cms.test/api/media/file/amber.webp',
        userAlias: 'Yogo',
        teamAlias: '',
        tool: 'ComfyUI'
      }
    ])
  })

  it('rejects a doc that is missing the required thumbnail', async () => {
    const body = {
      docs: [
        {
          slug: 'no-thumb',
          title: 'No Thumb',
          video: { url: '/api/media/file/clip.webm' },
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

    await expect(
      loadList(galleryCollection, {
        cmsUrl: CMS_URL,
        fetchImpl: fetchImpl as unknown as typeof fetch
      })
    ).rejects.toThrow(/schema validation/)
  })

  it('falls back to the committed default CMS URL when none is configured', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ docs: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    )

    await loadList(galleryCollection, {
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      `${DEFAULT_CMS_URL}/api/gallery?${GALLERY_QUERY}`,
      { headers: undefined }
    )
  })
})
