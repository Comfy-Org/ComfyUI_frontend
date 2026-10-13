import { z } from 'astro/zod'

/**
 * Where each draft change stands in review. It mirrors the catalog API's
 * editorial staging (NEW, APPROVED, DEFERRED): only approved changes go out
 * with a publish, and editing an approved change sends it back to review.
 */
export const STAGE_STATUSES = ['NEW', 'APPROVED', 'DEFERRED'] as const
export type StageStatus = (typeof STAGE_STATUSES)[number]

export const stageEntrySchema = z.object({
  status: z.enum(STAGE_STATUSES),
  /** Approved once, then edited again, so it needs a second look. */
  reapproval: z.boolean().optional()
})
export type StageEntry = z.infer<typeof stageEntrySchema>
export type Staging = Record<string, StageEntry>

/** Every change starts out waiting for review. */
export const stageOf = (staging: Staging, id: string): StageEntry =>
  staging[id] ?? { status: 'NEW' }
