import type { z } from 'zod'

import type {
  authorInfoSchema,
  createTemplateDraftRequestSchema,
  difficultySchema,
  marketplaceTemplateSchema,
  submitTemplateRequestSchema,
  templateStatsSchema,
  templateStatusSchema,
  updateTemplateRequestSchema
} from '../schemas/templateSchema'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import type { StatusBadgeVariants } from '@/components/common/statusBadge.variants'

// todo: use symbol when we aren't relying on JSON for storage
// export const MARKETPLACE_TEMPLATE_KEY = Symbol('MarketplaceTemplate')
export const MARKETPLACE_TEMPLATE_KEY = '__is_marketplace'

export type Difficulty = z.infer<typeof difficultySchema>
export type TemplateStatus = z.infer<typeof templateStatusSchema>

export type AuthorInfo = z.infer<typeof authorInfoSchema>
export type TemplateStats = z.infer<typeof templateStatsSchema>
export type MarketplaceTemplate = z.infer<typeof marketplaceTemplateSchema> & {
  [MARKETPLACE_TEMPLATE_KEY]: true
}

export type CreateTemplateDraftRequest = z.infer<
  typeof createTemplateDraftRequestSchema
>
export type UpdateTemplateRequest = z.infer<typeof updateTemplateRequestSchema>
export type SubmitTemplateRequest = z.infer<typeof submitTemplateRequestSchema>

export function isMarketplaceTemplate(
  template: Partial<TemplateInfo>
): template is MarketplaceTemplate {
  return (
    MARKETPLACE_TEMPLATE_KEY in template && !!template[MARKETPLACE_TEMPLATE_KEY]
  )
}

export const STATUS_SEVERITY: Record<
  TemplateStatus,
  StatusBadgeVariants['severity']
> = {
  draft: 'muted',
  pending_review: 'warn',
  approved: 'default',
  rejected: 'danger',
  unpublished: 'secondary'
}

export const DIFFICULTY_SPRITES: Record<string, string> = {
  beginner: '/assets/images/DOOM-beginner.png',
  intermediate: '/assets/images/DOOM-intermediate.png',
  advanced: '/assets/images/DOOM-advanced.png'
}
