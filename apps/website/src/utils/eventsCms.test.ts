import { describe, expect, it, vi } from 'vitest'

import { loadList } from './cmsContent'
import { eventsCollection } from './eventsCms'

const CMS_URL = 'https://cms.test'

const EVENTS_QUERY =
  'depth=1&limit=100&sort=-startDateTime&select[slug]=true&select[title]=true&select[category]=true&select[description]=true&select[startDateTime]=true&select[endDateTime]=true&select[timeZone]=true&select[locationMode]=true&select[locationName]=true&select[href]=true&select[newTab]=true&select[ctaLabel]=true&select[liveVideoId]=true&select[recordingVideoId]=true&select[cardMedia]=true&select[isFeatured]=true&select[featured]=true&populate[media][url]=true&populate[media][mimeType]=true&populate[media][alt]=true'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

// Generic loader behaviour (drafts, error paths, URL resolution) is covered in
// cmsContent.test.ts. These tests pin the events-specific query and flatten.

describe('eventsCollection', () => {
  it('requests the events query and flattens a doc into the render model', async () => {
    const body = {
      docs: [
        {
          slug: 'future-ai-post-production',
          title: 'The Future of AI Post Production',
          category: 'livestream',
          description: 'Ingi Erlingsson explores the future of AI post.',
          startDateTime: '2026-08-05T10:00:00-07:00',
          endDateTime: '2026-08-05T11:30:00-07:00',
          timeZone: 'America/New_York',
          locationMode: 'online',
          locationName: null,
          href: 'https://luma.com/nd0u29u8',
          newTab: true,
          ctaLabel: 'Register',
          liveVideoId: '4xS4LOn3CTE',
          recordingVideoId: null,
          cardMedia: {
            file: {
              url: '/api/media/file/card.png',
              mimeType: 'image/png',
              alt: 'Card art'
            },
            poster: null
          },
          isFeatured: true,
          featured: {
            order: 3,
            autoplayMs: 12000,
            showTitle: false,
            media: {
              file: {
                url: 'https://media.comfy.org/website/cms/hero.mp4',
                mimeType: 'video/mp4',
                alt: 'Hero clip'
              },
              poster: {
                url: '/api/media/file/hero-poster.jpg',
                mimeType: 'image/jpeg',
                alt: 'Hero poster'
              }
            }
          }
        }
      ]
    }
    const fetchImpl = vi.fn(async () => jsonResponse(body))

    const events = await loadList(eventsCollection, {
      cmsUrl: CMS_URL,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      `${CMS_URL}/api/events?${EVENTS_QUERY}`,
      { headers: undefined }
    )
    expect(events).toEqual([
      {
        id: 'future-ai-post-production',
        title: 'The Future of AI Post Production',
        category: 'livestream',
        description: 'Ingi Erlingsson explores the future of AI post.',
        startDateTime: '2026-08-05T10:00:00-07:00',
        endDateTime: '2026-08-05T11:30:00-07:00',
        timeZone: 'America/New_York',
        locationMode: 'online',
        href: 'https://luma.com/nd0u29u8',
        newTab: true,
        ctaLabel: 'Register',
        liveVideoId: '4xS4LOn3CTE',
        media: {
          type: 'image',
          src: 'https://cms.test/api/media/file/card.png',
          alt: 'Card art'
        },
        featured: {
          order: 3,
          autoplayMs: 12000,
          showTitle: false,
          media: {
            type: 'video',
            src: 'https://media.comfy.org/website/cms/hero.mp4',
            alt: 'Hero clip',
            poster: 'https://cms.test/api/media/file/hero-poster.jpg'
          }
        }
      }
    ])
  })

  it('requests the zh-CN locale and localizes a site-relative href', async () => {
    const body = {
      docs: [
        {
          slug: 'la-august-meetup',
          title: 'ComfyUI 官方洛杉矶八月见面会',
          category: 'community',
          description: '欢迎参加在洛杉矶举办的官方 ComfyUI 见面会。',
          startDateTime: '2026-08-20T18:00:00-07:00',
          locationMode: 'in-person',
          locationName: '美国加州洛杉矶',
          href: '/launches',
          cardMedia: {
            file: {
              url: '/api/media/file/meetup.png',
              mimeType: 'image/png',
              alt: '见面会照片'
            },
            poster: null
          },
          isFeatured: false,
          featured: null
        }
      ]
    }
    const fetchImpl = vi.fn(async () => jsonResponse(body))

    const events = await loadList(eventsCollection, {
      cmsUrl: CMS_URL,
      locale: 'zh-CN',
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      `${CMS_URL}/api/events?${EVENTS_QUERY}&locale=zh-CN`,
      { headers: undefined }
    )
    expect(events[0]).toMatchObject({
      title: 'ComfyUI 官方洛杉矶八月见面会',
      locationName: '美国加州洛杉矶',
      href: '/zh-CN/launches',
      media: { alt: '见面会照片' }
    })
  })

  it('leaves an event with no artwork unillustrated', async () => {
    const body = {
      docs: [
        {
          slug: 'link-only',
          title: 'Link Only',
          category: 'community',
          description: 'An event with no artwork.',
          startDateTime: '2026-09-01T18:00:00-07:00',
          locationMode: 'online',
          cardMedia: { file: null, poster: null },
          isFeatured: false,
          featured: { order: null, showTitle: false, media: { file: null } }
        }
      ]
    }
    const fetchImpl = vi.fn(async () => jsonResponse(body))

    const events = await loadList(eventsCollection, {
      cmsUrl: CMS_URL,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(events[0].media).toBeUndefined()
    expect(events[0].featured).toBeUndefined()
  })

  it('rejects a doc that is missing locationMode', async () => {
    const body = {
      docs: [
        {
          slug: 'no-location-mode',
          title: 'No Location Mode',
          category: 'community',
          description: 'Missing the online/in-person switch.',
          startDateTime: '2026-09-01T18:00:00-07:00'
        }
      ]
    }
    const fetchImpl = vi.fn(async () => jsonResponse(body))

    await expect(
      loadList(eventsCollection, {
        cmsUrl: CMS_URL,
        fetchImpl: fetchImpl as unknown as typeof fetch
      })
    ).rejects.toThrow(/schema validation/)
  })

  it('fails the build on a featured doc with no carousel artwork or order', async () => {
    const body = {
      docs: [
        {
          slug: 'featured-without-art',
          title: 'Featured Without Art',
          category: 'livestream',
          description: 'Flagged featured but never given a slide.',
          startDateTime: '2026-09-01T18:00:00-07:00',
          locationMode: 'online',
          isFeatured: true,
          featured: { order: null, showTitle: false, media: { file: null } }
        }
      ]
    }
    const fetchImpl = vi.fn(async () => jsonResponse(body))

    await expect(
      loadList(eventsCollection, {
        cmsUrl: CMS_URL,
        fetchImpl: fetchImpl as unknown as typeof fetch
      })
    ).rejects.toThrow(/no carousel order or artwork/)
  })
})
