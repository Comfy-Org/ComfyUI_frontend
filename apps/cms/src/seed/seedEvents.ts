import path from 'node:path'
import type { Payload } from 'payload'

import { events } from '../../../website/src/data/events'
import { seedMedia } from './seedMedia'

// A localized media asset from the seed source: a file URL plus per-locale alt,
// and (for videos) a poster URL.
type SourceMedia = (typeof events)[number]['media']

const mediaFilename = (url: string): string => path.basename(new URL(url).pathname)

// Upload a source media asset (and its poster, if any) and return the ids for a
// collection media group `{ file, poster }`. Videos are guaranteed faststart
// (remuxed on upload if needed); the filename-keyed idempotency dedups an asset
// reused across card and featured slots to a single media doc.
const seedEventMedia = async (
  payload: Payload,
  cacheDir: string,
  media: NonNullable<SourceMedia>,
): Promise<{ file: number; poster?: number }> => {
  const alt = media.alt.en
  const zhAlt = media.alt['zh-CN']

  const file = await seedMedia(payload, cacheDir, {
    url: media.src,
    filename: mediaFilename(media.src),
    alt,
    zhAlt,
    faststart: media.type === 'video',
  })

  const poster =
    media.type === 'video' && media.poster
      ? await seedMedia(payload, cacheDir, {
          url: media.poster,
          filename: mediaFilename(media.poster),
          alt,
          zhAlt,
        })
      : undefined

  return { file, poster }
}

export const seedEvents = async (payload: Payload, cacheDir: string): Promise<void> => {
  for (const source of events) {
    const cardMedia = source.media
      ? await seedEventMedia(payload, cacheDir, source.media)
      : undefined

    const featured = source.featured
      ? {
          order: source.featured.order,
          ...(source.featured.autoplayMs !== undefined && {
            autoplayMs: source.featured.autoplayMs,
          }),
          showTitle: source.featured.showTitle ?? false,
          media: await seedEventMedia(payload, cacheDir, source.featured.media),
        }
      : undefined

    // Optional fields pass through as `undefined` when the source omits them —
    // Payload leaves them unset (matching the gallery seed). A seed re-run is
    // authoritative, so reconciling a doc back to the source is intended.
    const data = {
      title: source.title.en,
      slug: source.id,
      category: source.category,
      description: source.description.en,
      startDateTime: source.startDateTime,
      endDateTime: source.endDateTime,
      timeZone: source.timeZone,
      locationMode: source.locationMode,
      locationName: source.locationName?.en,
      href: source.href,
      newTab: source.newTab,
      ctaLabel: source.ctaLabel?.en,
      liveVideoId: source.liveVideoId,
      recordingVideoId: source.recordingVideoId,
      cardMedia,
      isFeatured: Boolean(featured),
      featured,
      _status: 'published' as const,
    }

    const existing = await payload.find({
      collection: 'events',
      where: { slug: { equals: source.id } },
      limit: 1,
    })
    // The base write targets the default (`en`) locale.
    const docId =
      existing.docs.length > 0
        ? (await payload.update({ collection: 'events', id: existing.docs[0].id, data })).id
        : (await payload.create({ collection: 'events', data })).id

    // A locale-scoped update writes only the zh-CN values for the localized
    // fields, leaving every unlocalized field as set above. (Media alt is
    // localized on the media docs themselves, inside seedEventMedia.)
    await payload.update({
      collection: 'events',
      id: docId,
      locale: 'zh-CN',
      data: {
        title: source.title['zh-CN'],
        description: source.description['zh-CN'],
        locationName: source.locationName?.['zh-CN'],
        ctaLabel: source.ctaLabel?.['zh-CN'],
      },
    })

    payload.logger.info(`Seeded event: ${source.id} (+zh-CN)`)
  }

  payload.logger.info(`Events seed complete: ${events.length} events`)
}
