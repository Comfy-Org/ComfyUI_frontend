import type { GalleryDoc } from './galleryCms.schema'
import type { GalleryItem } from '../data/gallery'

import { GalleryListResponseSchema } from './galleryCms.schema'

interface LoadGalleryItemsOptions {
  cmsUrl?: string
  fetchImpl?: typeof fetch
}

const GALLERY_QUERY = [
  'depth=1',
  'limit=100',
  'sort=-publishedAt',
  'select[title]=true',
  'select[slug]=true',
  'select[href]=true',
  'select[media]=true',
  'select[creator]=true',
  'select[team]=true',
  'select[tool]=true',
  'populate[media][url]=true',
  'populate[media][mimeType]=true',
  'populate[creators][name]=true',
  'populate[teams][name]=true',
  'populate[tools][name]=true'
].join('&')

export async function loadGalleryItemsForBuild(
  options: LoadGalleryItemsOptions = {}
): Promise<GalleryItem[]> {
  const cmsUrl =
    options.cmsUrl ??
    import.meta.env.WEBSITE_CMS_URL ??
    process.env.WEBSITE_CMS_URL
  if (!cmsUrl) {
    throw new Error(
      '[gallery] WEBSITE_CMS_URL is not set; the gallery builds from the CMS'
    )
  }

  const base = cmsUrl.replace(/\/$/, '')
  const fetchImpl = options.fetchImpl ?? fetch

  const response = await fetchImpl(`${base}/api/gallery?${GALLERY_QUERY}`)
  if (!response.ok) {
    throw new Error(`[gallery] CMS responded ${response.status}`)
  }

  const parsed = GalleryListResponseSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error(
      `[gallery] CMS response failed schema validation: ${parsed.error.message}`
    )
  }

  return parsed.data.docs.map((doc) => toGalleryItem(doc, base))
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
