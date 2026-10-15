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

export function canonicalQueue(items: ReviewItem[]): CatalogQueueItem[] {
  return items.map((item) => {
    const document = item.content.document
    return {
      source: 'catalog',
      id: item.content.uid,
      kind: kinds[item.content.type],
      canonical: item,
      title: itemTitle(item),
      change: item.content.is_deleted
        ? 'removed'
        : !item.before || item.before.is_deleted
          ? 'new'
          : 'updated',
      slug: typeof document.slug === 'string' ? document.slug : '',
      provider:
        typeof document.provider === 'string'
          ? document.provider
          : item.content.author_uid,
      thumbnail: item.presentation?.preview?.src,
      visibleFrom:
        typeof document.visible_from === 'string'
          ? document.visible_from
          : undefined,
      hidden: document.enabled === false,
      fields: [],
      gaps: []
    }
  })
}
