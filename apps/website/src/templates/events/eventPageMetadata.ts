import type { ComfyEvent } from '../../data/events'
import { eventMediaThumbnail, youtubeWatchHref } from '../../data/events'
import type { Locale } from '../../i18n/translations'
import type { JsonLdNode } from '../../utils/jsonLd'
import { jsonLdId, videoObjectNode } from '../../utils/jsonLd'

/**
 * Social image and VideoObject thumbnail for an event page. Video media
 * resolves to its poster: a video's own src is not a usable image, so feeding
 * it to og:image advertises an .mp4 as the social card.
 */
export const eventPageThumbnail = (event: ComfyEvent): string | undefined =>
  eventMediaThumbnail(event.media)

/**
 * VideoObject node for a past event's recording, or undefined when the event
 * is not eligible. Eligibility needs a published recording *and* a usable
 * thumbnail — videoObjectNode requires a thumbnailUrl, so a posterless video
 * event drops the node rather than emitting one with a broken image.
 */
export function eventVideoJsonLd(input: {
  event: ComfyEvent
  isPast: boolean
  siteUrl: string
  url: string
  title: string
  description: string
  locale: Locale
}): JsonLdNode | undefined {
  const { event, isPast, siteUrl, url, title, description, locale } = input
  const thumbnailUrl = eventPageThumbnail(event)
  if (!isPast || !event.recordingVideoId || !thumbnailUrl) return undefined

  const watchHref = youtubeWatchHref(event.recordingVideoId)
  return videoObjectNode({
    siteUrl,
    id: jsonLdId(url, 'video'),
    pageUrl: url,
    name: title,
    description,
    thumbnailUrl,
    contentUrl: watchHref[locale] || watchHref.en,
    embedUrl: `https://www.youtube-nocookie.com/embed/${event.recordingVideoId}`,
    uploadDate: event.startDateTime,
    locale
  })
}
