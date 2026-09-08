import { describe, expect, it } from 'vitest'

import {
  customerVideoStories,
  getCustomerVideoStory
} from '../data/customerVideos'
import { GET, buildVideoSitemap } from './video-sitemap.xml'

function render(site?: URL): Response {
  return GET({ site } as unknown as Parameters<typeof GET>[0]) as Response
}

describe('video-sitemap.xml', () => {
  it('lists one <url> per customer video story with the required Google video sitemap fields', async () => {
    const xml = await render(new URL('https://comfy.org/')).text()
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">'
    )
    for (const story of customerVideoStories) {
      expect(xml).toContain(`https://comfy.org/customers/videos/${story.slug}/`)
      expect(xml).toContain(
        `<video:thumbnail_loc>${story.poster}</video:thumbnail_loc>`
      )
      expect(xml).toContain(
        `<video:content_loc>${story.videoSrc}</video:content_loc>`
      )
    }
  })

  it('omits video:duration and video:publication_date rather than fabricating them', async () => {
    const xml = await render(new URL('https://comfy.org/')).text()
    expect(xml).not.toContain('<video:duration>')
    expect(xml).not.toContain('<video:publication_date>')
  })

  it('escapes an apostrophe in the description', async () => {
    const xml = await render(new URL('https://comfy.org/')).text()
    expect(xml).not.toMatch(/<video:description>[^<]*'/)
  })

  it('includes video:duration and video:publication_date once a story has them', () => {
    const story = {
      ...getCustomerVideoStory('black-math'),
      durationSeconds: 272.4,
      uploadDate: '2026-08-01'
    }

    const xml = buildVideoSitemap([story], 'https://comfy.org')

    expect(xml).toContain('<video:duration>272</video:duration>')
    expect(xml).toContain(
      '<video:publication_date>2026-08-01</video:publication_date>'
    )
  })

  it('falls back to the default origin when the site is not configured', () => {
    const xml = GET({ site: undefined } as unknown as Parameters<typeof GET>[0])
    expect(xml).toBeInstanceOf(Response)
  })
})
