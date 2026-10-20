import type { ContentCatalogRecord } from '@comfyorg/ingest-types'
import type { ReviewItem } from './staging-review'
import type { ReadinessGap } from './readiness'

export type QueueChange = 'new' | 'updated' | 'removed'

interface FieldGroup {
  field: string
  before?: unknown
  after?: unknown
  added: unknown[]
  removed: unknown[]
}

interface QueueBase {
  id: string
  title: string
  change: QueueChange
  thumbnail?: string
}

export interface CatalogQueueItem extends QueueBase {
  source: 'catalog'
  kind: ContentCatalogRecord['kind'] | 'MEDIA' | 'TEMPLATE_SET'
  canonical?: ReviewItem
  changeID?: string
  slug: string
  provider?: string
  /** Canonical account ID of the credited author; shown as its profile. */
  authorUID?: string
  visibleFrom?: string
  /** Turned off in the draft, so the page only exists on the live site. */
  hidden: boolean
  fields: FieldGroup[]
  /** What the item still lacks; empty when removed or ready. */
  gaps: ReadinessGap[]
}

export interface SubmissionQueueItem extends QueueBase {
  source: 'submission'
  kind: 'WORKFLOW'
  author: string
  submittedAt: string
  shareId: string
  versionId: string
  description: string
  listed: boolean
}

export type QueueItem = CatalogQueueItem | SubmissionQueueItem
