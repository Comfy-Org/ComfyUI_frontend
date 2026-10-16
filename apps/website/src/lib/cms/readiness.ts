import type { ContentCatalogRecord } from '@comfyorg/ingest-types'

import { modelSchema } from '@/config/models-catalogue-data'
import { detailSchema } from '@/config/models-page-data'

/** What the Hub needs before an item is worth publishing. */
export type ReadinessGap = 'page' | 'name' | 'summary' | 'cover' | 'examples'

type Renderable = Pick<ContentCatalogRecord, 'kind' | 'slug' | 'data'>

const filled = (value: unknown) =>
  typeof value === 'string' && value.trim() !== ''

/** The site renders every draft item, so one it can't read breaks the whole preview. */
export function pageRenders(record: Renderable) {
  if (record.data.href !== `${record.slug}/`) return false
  if (!modelSchema.safeParse(record.data).success) return false
  return record.kind === 'APP' || detailSchema.safeParse(record.data).success
}

/**
 * Checks a draft item the way a reviewer would before publishing. It flags
 * gaps instead of blocking, so the person publishing decides.
 */
export function readinessGaps(record: Renderable): ReadinessGap[] {
  const data = record.data
  const thumbnail = data.thumbnail as { url?: unknown } | undefined
  const examples = Array.isArray(data.examples) ? data.examples : []
  const gaps: Array<[ReadinessGap, boolean]> = [
    ['page', !pageRenders(record)],
    ['name', !filled(data.name)],
    ['summary', !filled(data.summary)],
    ['cover', !filled(thumbnail?.url) && !filled(data.thumbnailUrl)],
    ['examples', record.kind === 'MODEL' && examples.length === 0]
  ]
  return gaps.filter(([, missing]) => missing).map(([gap]) => gap)
}
