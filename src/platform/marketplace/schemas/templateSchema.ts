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

export const templateInfoSchema = z.custom<Partial<TemplateInfo>>(
  (value) => value != null && typeof value === 'object' && 'name' in value
)

export const thumbnailVariantSchema = z.enum([
  'default',
  'compareSlider',
  'hoverDissolve'
])

export const requiredModelSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1)
})

export const metadataSchema = z.object({
  shortDescription: z.string().min(1).max(200),
  difficulty: difficultySchema
})

export const mediaStepSchema = z
  .object({
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

export const marketplaceTemplateSchema = templateInfoSchema.and(
  z.object({
    id: z.string().min(1),
    shortDescription: z.string().optional(),
    author: authorInfoSchema,
    difficulty: difficultySchema.optional(),
    categories: z.array(z.string()),
    gallery: z.array(z.string()),
    changelog: z.string().optional(),
    reviewFeedback: z.string().optional(),
    version: z.string().optional(),
    status: templateStatusSchema,
    publishedAt: z.string().optional(),
    updatedAt: z.string().optional(),
    createdAt: z.string(),
    stats: templateStatsSchema,
    customNodes: z.array(z.string()).optional(),
    requiredModels: z.array(requiredModelSchema).optional(),
    vramEstimate: z.number().positive().optional()
  })
)

const templateInfoCreateSchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  mediaType: z.string().optional(),
  mediaSubtype: z.string().optional(),
  thumbnailVariant: thumbnailVariantSchema.optional(),
  tags: z.array(z.string()).optional(),
  license: z.string().optional(),
  tutorialUrl: z.string().optional()
})

export const createTemplateDraftRequestSchema = templateInfoCreateSchema.extend(
  {
    shortDescription: z.string().min(1).max(200).optional(),
    difficulty: difficultySchema.optional(),
    categories: z.array(z.string()).optional(),
    gallery: z.array(z.string()).optional(),
    version: z.string().min(1).optional(),
    changelog: z.string().optional(),
    customNodes: z.array(z.string()).optional(),
    requiredModels: z.array(requiredModelSchema).optional(),
    vramEstimate: z.number().positive().optional()
  }
)

export const updateTemplateRequestSchema = templateInfoCreateSchema.extend({
  id: z.string().min(1),
  shortDescription: z.string().min(1).max(200).optional(),
  difficulty: difficultySchema.optional(),
  categories: z.array(z.string()).optional(),
  gallery: z.array(z.string()).optional(),
  version: z.string().min(1).optional(),
  changelog: z.string().optional(),
  status: templateStatusSchema.optional(),
  customNodes: z.array(z.string()).optional(),
  requiredModels: z.array(requiredModelSchema).optional(),
  vramEstimate: z.number().positive().optional()
})

export const submitTemplateRequestSchema = templateInfoCreateSchema.extend({
  id: z.string().min(1).optional(),
  shortDescription: z.string().min(1).max(200),
  difficulty: difficultySchema,
  categories: z.array(z.string()).default([]),
  gallery: z.array(z.string()).min(1),
  version: z.string().default('1.0.0'),
  changelog: z.string().optional(),
  customNodes: z.array(z.string()).optional(),
  requiredModels: z.array(requiredModelSchema).optional(),
  vramEstimate: z.number().positive().optional()
})
