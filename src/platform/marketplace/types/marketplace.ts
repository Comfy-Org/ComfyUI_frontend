import type { z } from 'zod'

import type {
  authorDashboardStatsSchema,
  periodDataPointSchema,
  statsPeriodSchema
} from '../schemas/authorStatsSchema'
import type {
  authorInfoSchema,
  createTemplateRequestSchema,
  difficultySchema,
  licenseTypeSchema,
  marketplaceTemplateSchema,
  templateStatsSchema,
  templateStatusSchema,
  updateTemplateRequestSchema
} from '../schemas/templateSchema'

export type Difficulty = z.infer<typeof difficultySchema>
export type LicenseType = z.infer<typeof licenseTypeSchema>
export type TemplateStatus = z.infer<typeof templateStatusSchema>
export type StatsPeriod = z.infer<typeof statsPeriodSchema>

export type AuthorInfo = z.infer<typeof authorInfoSchema>
export type TemplateStats = z.infer<typeof templateStatsSchema>
export type MarketplaceTemplate = z.infer<typeof marketplaceTemplateSchema>

export type CreateTemplateRequest = z.infer<typeof createTemplateRequestSchema>
export type UpdateTemplateRequest = z.infer<typeof updateTemplateRequestSchema>

export function isUpdateTemplateRequest(
  request: Partial<CreateTemplateRequest> | UpdateTemplateRequest
): request is UpdateTemplateRequest {
  return 'id' in request
}

export type AuthorDashboardStats = z.infer<typeof authorDashboardStatsSchema>
export type PeriodDataPoint = z.infer<typeof periodDataPointSchema>
