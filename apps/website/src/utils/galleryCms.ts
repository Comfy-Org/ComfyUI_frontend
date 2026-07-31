import type { GalleryDoc } from './galleryCms.schema'
import type { GalleryItem } from '../data/gallery'

import { visibleGalleryItems } from '../data/gallery'
import { GalleryListResponseSchema } from './galleryCms.schema'

interface LoadGalleryItemsOptions {
  cmsUrl?: string
  fetchImpl?: typeof fetch
}

const PUBLISHED_QUERY = 'depth=1&limit=100&where[_status][equals]=published'

export async function loadGalleryItemsForBuild(
  options: LoadGalleryItemsOptions = {}
): Promise<GalleryItem[]> {
  const cmsUrl = options.cmsUrl ?? process.env.WEBSITE_CMS_URL
  if (!cmsUrl) return visibleGalleryItems

  const base = cmsUrl.replace(/\/$/, '')
  const fetchImpl = options.fetchImpl ?? fetch

  try {
    const response = await fetchImpl(`${base}/api/gallery?${PUBLISHED_QUERY}`)
    if (!response.ok) {
      return warnAndFallback(`CMS responded ${response.status}`)
    }

    const parsed = GalleryListResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
      return warnAndFallback('CMS response failed schema validation')
    }

    return parsed.data.docs.map((doc) => toGalleryItem(doc, base))
  } catch (error) {
    return warnAndFallback(`could not reach CMS: ${String(error)}`)
  }
}

function warnAndFallback(reason: string): GalleryItem[] {
  console.warn(
    `[gallery] WEBSITE_CMS_URL is set but ${reason}; using static gallery data.`
  )
  return visibleGalleryItems
}

function toGalleryItem(doc: GalleryDoc, base: string): GalleryItem {
  const mediaUrl = new URL(doc.media.url, base).toString()
  const isVideo = doc.media.mimeType?.startsWith('video/') ?? false

  return {
    id: doc.slug,
    title: doc.title,
    ...(isVideo ? { video: mediaUrl } : { image: mediaUrl }),
    userAlias: doc.creator.name,
    teamAlias: doc.team?.name ?? '',
    tool: doc.tool.name,
    ...(doc.href ? { href: doc.href } : {})
  }
}
