import type { GalleryDoc } from './galleryCms.schema'
import type { GalleryItem } from '../data/gallery'
import type { CmsCollection } from './cmsContent'

import { GalleryListResponseSchema } from './galleryCms.schema'

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

/** The gallery as the first CMS-backed collection (list view). */
export const galleryCollection: CmsCollection<GalleryDoc, GalleryItem> = {
  slug: 'gallery',
  list: {
    query: GALLERY_QUERY,
    schema: GalleryListResponseSchema,
    toItem: toGalleryItem
  }
}
