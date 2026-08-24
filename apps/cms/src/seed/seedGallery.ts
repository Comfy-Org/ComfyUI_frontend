import path from 'node:path'
import type { Payload } from 'payload'

import { galleryItems } from '../../../website/src/data/gallery'
import { extractPoster } from './extractPoster'
import { findOrCreateByField } from './findOrCreate'
import { seedMedia, uploadMediaFile } from './seedMedia'

const mediaExtension = (url: string): string => path.extname(new URL(url).pathname) || '.bin'

// Chinese titles for a subset of gallery items, keyed by slug. Items absent from
// this map keep only `en` values and exercise the CMS fallback (a zh-CN visitor
// sees the English text). The value seeds both the gallery `title` and the
// item's media alt text.
const ZH_CN_TITLES: Record<string, string> = {
  'neon-nights': '霓虹之夜',
  autopoiesis: '自创生',
  fall: '坠落',
  'origami-world': '折纸世界',
  'good-good-summer': '会是一个很棒很棒的夏天',
  'show-you-my-garden': '带你看我的花园',
  'goodbye-beijing': '再见北京',
  'desert-landing': '沙漠降落',
}

// Dummy publish dates, one day apart, ascending with the static gallery order so
// that sorting by publishedAt reproduces the hand-curated sequence on the site.
const PUBLISHED_AT_BASE = Date.UTC(2024, 0, 1)
const ONE_DAY_MS = 86_400_000
const publishedAtForIndex = (index: number): string =>
  new Date(PUBLISHED_AT_BASE + index * ONE_DAY_MS).toISOString()

export const seedGallery = async (payload: Payload, cacheDir: string): Promise<void> => {
  for (const [index, item] of galleryItems.entries()) {
    const creator = await findOrCreateByField(payload, 'creators', 'name', item.userAlias, {
      name: item.userAlias,
    })
    const tool = await findOrCreateByField(payload, 'tools', 'name', item.tool, {
      name: item.tool,
    })
    const team = item.teamAlias
      ? await findOrCreateByField(payload, 'teams', 'name', item.teamAlias, {
          name: item.teamAlias,
        })
      : undefined

    // The item's media reuses the (localized) title as alt text: the en title
    // at the default locale, the Chinese title (when the item has one) at
    // zh-CN.
    const zhTitle = ZH_CN_TITLES[item.id]

    // A video item's thumbnail is a frame extracted from the video; an image
    // item's thumbnail is the image itself. Every item ends up with a thumbnail,
    // satisfying the collection's required field.
    let thumbnail: number
    let video: number | undefined

    if (item.video) {
      const videoFilename = `${item.id}${mediaExtension(item.video)}`
      video = await seedMedia(payload, cacheDir, {
        url: item.video,
        filename: videoFilename,
        alt: item.title,
        zhAlt: zhTitle,
      })

      const posterPath = path.join(cacheDir, `${item.id}-poster.jpg`)
      await extractPoster(path.join(cacheDir, videoFilename), posterPath)
      thumbnail = await uploadMediaFile(payload, posterPath, {
        alt: item.title,
        zhAlt: zhTitle,
      })
    } else if (item.image) {
      thumbnail = await seedMedia(payload, cacheDir, {
        url: item.image,
        filename: `${item.id}${mediaExtension(item.image)}`,
        alt: item.title,
        zhAlt: zhTitle,
      })
    } else {
      throw new Error(`Gallery item ${item.id} has no media URL`)
    }

    const status: 'draft' | 'published' = item.visible === false ? 'draft' : 'published'

    const data = {
      title: item.title,
      slug: item.id,
      thumbnail,
      video,
      creator,
      team,
      tool,
      href: item.href,
      publishedAt: publishedAtForIndex(index),
      _status: status,
    }

    const existing = await payload.find({
      collection: 'gallery',
      where: { slug: { equals: item.id } },
      limit: 1,
    })
    // The base write targets the default (`en`) locale, so existing titles land
    // as the English value.
    const docId =
      existing.docs.length > 0
        ? (await payload.update({ collection: 'gallery', id: existing.docs[0].id, data })).id
        : (await payload.create({ collection: 'gallery', data })).id

    // Add a Chinese title for the subset with one; a second locale-scoped update
    // writes only the zh-CN `title`, leaving every other (unlocalized) field as
    // set above.
    if (zhTitle) {
      await payload.update({
        collection: 'gallery',
        id: docId,
        locale: 'zh-CN',
        data: { title: zhTitle },
      })
    }

    payload.logger.info(`Seeded gallery item: ${item.id}${zhTitle ? ' (+zh-CN)' : ''}`)
  }

  payload.logger.info(`Gallery seed complete: ${galleryItems.length} items`)
}
