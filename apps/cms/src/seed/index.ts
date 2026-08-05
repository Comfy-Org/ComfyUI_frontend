import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'

import { galleryItems } from '../../../website/src/data/gallery'
import config from '../payload.config'
import { findOrCreateByField } from './findOrCreate'
import { seedMedia } from './seedMedia'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const cacheDir = path.resolve(dirname, '../../.media-cache')

const mediaExtension = (url: string): string => path.extname(new URL(url).pathname) || '.bin'

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

    const url = item.video ?? item.image
    if (!url) {
      throw new Error(`Gallery item ${item.id} has no media URL`)
    }
    const media = await seedMedia(payload, cacheDir, {
      url,
      filename: `${item.id}${mediaExtension(url)}`,
      alt: item.title,
    })

    const status: 'draft' | 'published' = item.visible === false ? 'draft' : 'published'

    const data = {
      title: item.title,
      slug: item.id,
      media,
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
    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'gallery',
        id: existing.docs[0].id,
        data,
      })
    } else {
      await payload.create({ collection: 'gallery', data })
    }

    payload.logger.info(`Seeded gallery item: ${item.id}`)
  }

  payload.logger.info(`Seed complete: ${galleryItems.length} gallery items`)
  await payload.destroy()
}

// Top-level await so `payload run` (which awaits module evaluation, then exits)
// does not kill the process before the async seed work completes.
await seed()
process.exit(0)
