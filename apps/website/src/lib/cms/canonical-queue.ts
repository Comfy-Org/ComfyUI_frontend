import type { CatalogQueueItem } from './queue'
import type { ReviewItem } from './staging-review'
import { itemTitle } from './staging-review'

const kinds = {
  model: 'MODEL',
  workflow: 'WORKFLOW',
  app: 'APP',
  media: 'MEDIA',
  template_set: 'TEMPLATE_SET'
} as const

function text(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function changeOf(item: ReviewItem): CatalogQueueItem['change'] {
  if (item.content.is_deleted) return 'removed'
  return !item.before || item.before.is_deleted ? 'new' : 'updated'
}

function queueItem(item: ReviewItem): CatalogQueueItem {
  const document = item.content.document
  const provider = text(document.provider)
  return {
    source: 'catalog',
    id: item.content.uid,
    kind: kinds[item.content.type],
    canonical: item,
    changeID: text(document.change_id),
    title: itemTitle(item),
    change: changeOf(item),
    slug: text(document.slug) ?? '',
    ...(provider === undefined ? {} : { provider }),
    authorUID: item.content.author_uid,
    thumbnail: item.presentation?.preview?.src,
    visibleFrom: text(document.visible_from),
    hidden: document.enabled === false,
    // The staging item carries the save time; older reads put it on content.
    savedAt: item.saved_at ?? item.content.saved_at,
    fields: [],
    gaps: []
  }
}

export function canonicalQueue(items: ReviewItem[]): CatalogQueueItem[] {
  return items.map(queueItem)
}
