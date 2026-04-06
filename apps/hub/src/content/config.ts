import { defineCollection, z } from 'astro:content'

// Base schema for template data
const templateSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  description: z.string(),
  mediaType: z.enum(['image', 'video', 'audio', '3d']),
  mediaSubtype: z.string().optional(),
  thumbnailVariant: z
    .enum(['compareSlider', 'hoverDissolve', 'hoverZoom', 'zoomHover'])
    .optional(),
  estimatedTime: z.string().optional(),
  tutorialUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
  models: z.array(z.string()).optional(),
  date: z.string().optional(),
  openSource: z.boolean().optional(),
  requiresCustomNodes: z.array(z.string()).optional(),
  requiredNodes: z
    .array(
      z.object({
        nodeType: z.string(),
        package: z.string(),
        url: z.string(),
        description: z.string().optional()
      })
    )
    .optional(),
  usage: z.number().optional(),
  username: z.string().optional(),
  includeOnDistributions: z.array(z.string()).optional(),

  // Synced assets
  thumbnails: z.array(z.string()).default([]),
  detailImages: z.array(z.string()).optional(),
  size: z.number().optional(),
  vram: z.number().optional(),
  authorNotes: z.string().optional(),

  workflowModels: z
    .array(
      z.object({
        kind: z.enum([
          'checkpoint',
          'unet',
          'vae',
          'clip',
          'lora',
          'controlnet',
          'upscaler',
          'other'
        ]),
        filename: z.string(),
        nodeType: z.string()
      })
    )
    .optional(),

  // AI-generated content
  extendedDescription: z.string(),
  howToUse: z.array(z.string()),
  metaDescription: z.string(),
  suggestedUseCases: z.array(z.string()),
  faqItems: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string()
      })
    )
    .optional(),

  // Generated assets
  workflowPreviewPath: z.string().optional(),

  // Logos
  logos: z
    .array(
      z.object({
        provider: z.union([z.string(), z.array(z.string())])
      })
    )
    .optional(),

  // Search ranking
  searchRank: z.number().optional(),

  // Workflow type
  isApp: z.boolean().default(false),

  // Override tracking
  humanEdited: z.boolean().default(false),
  lastAIGeneration: z.string().optional(),

  // i18n
  locale: z.string().optional() // undefined = default locale (en)
})

// English templates (default locale, at root)
const templates = defineCollection({
  type: 'data',
  schema: templateSchema
})

// Localized content is stored in subdirectories (templates/zh/, templates/ja/, etc.)
// and is handled automatically by the main templates collection.

export const collections = {
  templates
}
