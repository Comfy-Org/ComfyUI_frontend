import type { CmsCollection } from './cmsContent'
import type { ComfyEvent, EventMedia } from './events'
import type { EventDoc, EventMediaGroup } from './eventsCms.schema'
import type { Locale } from '../i18n/locales'

import { localizeHref } from '../config/routes'
import { EventsListResponseSchema } from './eventsCms.schema'

const EVENTS_QUERY = [
  'depth=1',
  'limit=100',
  'sort=-startDateTime',
  'select[slug]=true',
  'select[title]=true',
  'select[category]=true',
  'select[description]=true',
  'select[startDateTime]=true',
  'select[endDateTime]=true',
  'select[timeZone]=true',
  'select[locationMode]=true',
  'select[locationName]=true',
  'select[href]=true',
  'select[newTab]=true',
  'select[ctaLabel]=true',
  'select[liveVideoId]=true',
  'select[recordingVideoId]=true',
  'select[cardMedia]=true',
  'select[isFeatured]=true',
  'select[featured]=true',
  'populate[media][url]=true',
  'populate[media][mimeType]=true',
  'populate[media][alt]=true'
].join('&')

// Image vs video is derived from the upload's mime type — the collection has no
// explicit media-kind field. A poster only ever applies to a video.
function toMedia(
  group: EventMediaGroup | undefined,
  base: string
): EventMedia | undefined {
  const { file, poster } = group ?? {}
  if (!file) return undefined

  const src = new URL(file.url, base).toString()
  return file.mimeType.startsWith('video/')
    ? {
        type: 'video',
        src,
        alt: file.alt,
        poster: poster && new URL(poster.url, base).toString()
      }
    : { type: 'image', src, alt: file.alt }
}

// Payload keeps the group's stored values when the isFeatured toggle is
// cleared, so featuredness is the flag, not the presence of data. A flagged
// event with no slide to render is bad data and fails the build.
function toFeatured(doc: EventDoc, base: string): ComfyEvent['featured'] {
  if (!doc.isFeatured) return undefined

  const { featured } = doc
  const media = toMedia(featured?.media, base)
  if (!media || featured?.order === undefined) {
    throw new Error(
      `[events] Featured event "${doc.slug}" has no carousel order or artwork`
    )
  }

  return {
    order: featured.order,
    autoplayMs: featured.autoplayMs,
    showTitle: featured.showTitle ?? false,
    media
  }
}

function toEvent(doc: EventDoc, base: string, locale: Locale): ComfyEvent {
  return {
    id: doc.slug,
    category: doc.category,
    title: doc.title,
    description: doc.description,
    locationMode: doc.locationMode,
    locationName: doc.locationName,
    startDateTime: doc.startDateTime,
    endDateTime: doc.endDateTime,
    timeZone: doc.timeZone,
    href: doc.href ? localizeHref(doc.href, locale) : undefined,
    newTab: doc.newTab,
    ctaLabel: doc.ctaLabel,
    liveVideoId: doc.liveVideoId,
    recordingVideoId: doc.recordingVideoId,
    media: toMedia(doc.cardMedia, base),
    featured: toFeatured(doc, base)
  }
}

/** Events as a CMS-backed collection (list view). */
export const eventsCollection: CmsCollection<EventDoc, ComfyEvent> = {
  slug: 'events',
  list: {
    query: EVENTS_QUERY,
    schema: EventsListResponseSchema,
    toItem: toEvent
  }
}
