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

export const galleryItemTypeSchema = z.enum(['image', 'video'])

export const galleryItemSchema = z.object({
  type: galleryItemTypeSchema,
  url: z.string().url(),
  caption: z.string().optional(),
  isBefore: z.boolean().optional()
})

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
  // todo: should have a template schema under workflow/templates/schemas
  (value) => value != null && typeof value === 'object' && 'name' in value
)

export const marketplaceTemplateSchema = z.object({
  id: z.string().min(1),
  template: templateInfoSchema,
  shortDescription: z.string().max(200),
  author: authorInfoSchema,
  difficulty: difficultySchema,
  categories: z.array(z.string()).min(1),

  gallery: z.array(galleryItemSchema).max(6),
  videoPreview: z.string().url().optional(),
  workflowPreview: z.string(),

  version: z.string().min(1),
  changelog: z.string().optional(),
  status: templateStatusSchema,
  reviewFeedback: z.string().optional(),
  publishedAt: z.string().optional(),
  updatedAt: z.string(),
  createdAt: z.string(),

  stats: templateStatsSchema
})

export const createTemplateRequestSchema = z.object({
  template: templateInfoSchema,
  shortDescription: z.string().min(1).max(200),
  difficulty: difficultySchema,
  categories: z.array(z.string()).min(1),
  gallery: z.array(galleryItemSchema).max(6),
  videoPreview: z.string().url().optional(),
  workflowPreview: z.string().min(1),
  version: z.string().min(1),
  changelog: z.string().optional()
})

export const updateTemplateRequestSchema = createTemplateRequestSchema.partial()
