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
  'select[thumbnail]=true',
  'select[video]=true',
  'select[creator]=true',
  'select[team]=true',
  'select[tool]=true',
  'populate[thumbnail][url]=true',
  'populate[video][url]=true',
  'populate[creators][name]=true',
  'populate[teams][name]=true',
  'populate[tools][name]=true'
].join('&')

function toGalleryItem(doc: GalleryDoc, base: string): GalleryItem {
  const thumbnail = new URL(doc.thumbnail.url, base).toString()

  return {
    id: doc.slug,
    title: doc.title,
    thumbnail,
    ...(doc.video ? { video: new URL(doc.video.url, base).toString() } : {}),
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
