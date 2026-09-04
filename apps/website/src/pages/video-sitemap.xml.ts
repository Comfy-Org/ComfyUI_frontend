import type { APIRoute } from 'astro'

import { customerVideoPath, customerVideoStories } from '../data/customerVideos'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Google video sitemap for the dedicated customer-story watch pages, built
 * from the same shared data as the pages themselves so a new video only
 * needs adding once, in src/data/customerVideos.ts.
 */
export const GET: APIRoute = ({ site }) => {
  const origin = (site?.href ?? 'https://comfy.org/').replace(/\/$/, '')

  const urls = customerVideoStories
    .map((story) => {
      const pageUrl = `${origin}${customerVideoPath(story.slug)}/`
      // Video sitemap duration is a plain integer count of seconds, not the
      // ISO 8601 duration used in schema.org JSON-LD.
      const durationSeconds = story.durationSeconds
        ? Math.round(story.durationSeconds)
        : undefined

      const lines = [
        `  <url>`,
        `    <loc>${escapeXml(pageUrl)}</loc>`,
        `    <video:video>`,
        `      <video:thumbnail_loc>${escapeXml(story.poster)}</video:thumbnail_loc>`,
        `      <video:title>${escapeXml(story.title)}</video:title>`,
        `      <video:description>${escapeXml(story.description)}</video:description>`,
        `      <video:content_loc>${escapeXml(story.videoSrc)}</video:content_loc>`,
        durationSeconds
          ? `      <video:duration>${durationSeconds}</video:duration>`
          : undefined,
        story.uploadDate
          ? `      <video:publication_date>${escapeXml(story.uploadDate)}</video:publication_date>`
          : undefined,
        `      <video:family_friendly>yes</video:family_friendly>`,
        `      <video:live>no</video:live>`,
        `    </video:video>`,
        `  </url>`
      ]
      return lines.filter((line) => line !== undefined).join('\n')
    })
    .join('\n')

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls}
</urlset>
`

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml' }
  })
}
