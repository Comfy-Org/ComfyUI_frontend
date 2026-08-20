import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'

import { galleryItems } from '../../../website/src/data/gallery'
import config from '../payload.config'
import { extractPoster } from './extractPoster'
import { findOrCreateByField } from './findOrCreate'
import { seedMedia, uploadMediaFile } from './seedMedia'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const cacheDir = path.resolve(dirname, '../../.media-cache')

const mediaExtension = (url: string): string => path.extname(new URL(url).pathname) || '.bin'

// Chinese titles for a subset of gallery items, keyed by slug. Items absent from
// this map keep only an `en` title and exercise the CMS fallback (a zh-CN visitor
// sees the English title). Only `title` is localized — see the gallery spec.
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

const seed = async (): Promise<void> => {
  const payload = await getPayload({ config })

  const email = process.env.PAYLOAD_ADMIN_EMAIL
  const password = process.env.PAYLOAD_ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error('PAYLOAD_ADMIN_EMAIL and PAYLOAD_ADMIN_PASSWORD must be set')
  }
  await findOrCreateByField(payload, 'users', 'email', email, {
    email,
    password,
  })

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
      })

      const posterPath = path.join(cacheDir, `${item.id}-poster.jpg`)
      await extractPoster(path.join(cacheDir, videoFilename), posterPath)
      thumbnail = await uploadMediaFile(payload, posterPath, { alt: item.title })
    } else if (item.image) {
      thumbnail = await seedMedia(payload, cacheDir, {
        url: item.image,
        filename: `${item.id}${mediaExtension(item.image)}`,
        alt: item.title,
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
    const zhTitle = ZH_CN_TITLES[item.id]
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

  payload.logger.info(`Seed complete: ${galleryItems.length} gallery items`)
  await payload.destroy()
}

// Top-level await so `payload run` (which awaits module evaluation, then exits)
// does not kill the process before the async seed work completes.
await seed()
process.exit(0)
