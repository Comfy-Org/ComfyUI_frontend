import { z } from 'zod'

import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

export const difficultySchema = z.enum(['beginner', 'intermediate', 'advanced'])

export const licenseTypeSchema = z.enum([
  'cc-by',
  'cc-by-sa',
  'cc-by-nc',
  'mit',
  'apache',
  'custom'
])

export const templateStatusSchema = z.enum([
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'unpublished'
])

export const templateStatsSchema = z.object({
  downloads: z.number().nonnegative(),
  favorites: z.number().nonnegative(),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().nonnegative(),
  weeklyTrend: z.number()
})

export const authorInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  isVerified: z.boolean(),
  profileUrl: z.string()
})

export const templateInfoSchema = z.custom<TemplateInfo>(
  (value) => value != null && typeof value === 'object' && 'name' in value
)

export const thumbnailVariantSchema = z.enum([
  'default',
  'compareSlider',
  'hoverDissolve'
])

export const metadataSchema = z.object({
  shortDescription: z.string().min(1).max(200),
  difficulty: difficultySchema
})

export const mediaStepSchema = z
  .object({
    mediaType: z.string().min(1, 'Select a media type'),
    thumbnailVariant: thumbnailVariantSchema,
    fileCount: z.number().min(1, 'Upload at least one file')
  })
  .refine(
    (data) => data.thumbnailVariant !== 'compareSlider' || data.fileCount === 2,
    {
      message: 'Before/after comparison requires exactly 2 images',
      path: ['fileCount']
    }
  )

export const marketplaceTemplateSchema = z.object({
  id: z.string().min(1),
  template: templateInfoSchema,
  shortDescription: z.string().max(200),
  author: authorInfoSchema,
  difficulty: difficultySchema,
  categories: z.array(z.string()).optional(),
  gallery: z.array(z.string()).optional(),
  changelog: z.string().optional(),
  version: z.string().min(1),
  status: templateStatusSchema,
  reviewFeedback: z.string().optional(),
  publishedAt: z.string().optional(),
  updatedAt: z.string(),
  createdAt: z.string(),
  stats: templateStatsSchema
})

// Create request (what the wizard submits)
export const createTemplateRequestSchema = z.object({
  template: templateInfoSchema,
  shortDescription: z.string().min(1).max(200),
  difficulty: difficultySchema,
  categories: z.array(z.string()).optional(),
  gallery: z.array(z.string()).optional(),
  version: z.string().min(1),
  changelog: z.string().optional()
})

export const updateTemplateRequestSchema = createTemplateRequestSchema.partial()
