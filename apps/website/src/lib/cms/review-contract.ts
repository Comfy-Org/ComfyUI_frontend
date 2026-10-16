import { z } from 'zod'
import { zContentCatalogProjection } from '@comfyorg/ingest-types/zod'
import type { ContentCatalogProjection } from '@comfyorg/ingest-types'

// Private saved-checkpoint review contract, mirrored from ingest/openapi.yaml.
// Admin-only definitions must not be added to the public SDK projection.
const publicationEvent = z.object({
  id: z.string(),
  action: z.enum(['PUBLISH', 'REVERT', 'APPROVE', 'REJECT']),
  target_id: z.string(),
  previous_id: z.string().optional(),
  actor_uid: z.string(),
  created_at: z.string().datetime({ offset: true })
})

export const zContentCatalogReview = z.object({
  draft: zContentCatalogProjection,
  live: zContentCatalogProjection,
  previous_live_id: z.number().int().min(1).optional(),
  can_edit: z.boolean(),
  can_apply: z.boolean(),
  history: z.array(publicationEvent)
})

// verifySiteSession normalizes wire int64 values to checked safe integers.
export type ContentCatalogReview = Omit<
  z.infer<typeof zContentCatalogReview>,
  'draft' | 'live'
> & {
  draft: ContentCatalogProjection
  live: ContentCatalogProjection
}

export const zSiteSubmission = z.object({
  uid: z.string(),
  share_id: z.string(),
  version_id: z.string(),
  title: z.string(),
  owner_uid: z.string(),
  description: z.string(),
  listed: z.boolean(),
  submitted_at: z.string().datetime({ offset: true })
})

export type SiteSubmission = z.infer<typeof zSiteSubmission>
