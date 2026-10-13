import { z } from 'astro/zod'

export const workflowCatalogDetailsSchema = z.object({
  locale: z.enum(['en', 'zh-CN', 'ja']),
  longDescription: z.string().optional(),
  faqs: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      answer: z.string()
    })
  ),
  worksOnCloud: z.boolean().optional(),
  outputType: z
    .enum(['image', 'video', 'audio', '3d', 'text', 'mixed'])
    .optional(),
  models: z.array(
    z.object({ uid: z.string(), name: z.string(), href: z.string().optional() })
  ),
  author: z.string().optional(),
  runs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  downloads: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .optional()
})

export type WorkflowCatalogDetails = z.output<
  typeof workflowCatalogDetailsSchema
>
