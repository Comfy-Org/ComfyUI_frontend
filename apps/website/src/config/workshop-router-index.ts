import { z } from 'astro/zod'

export const workshopRouterIndexSchema = z.array(
  z.object({
    id: z.string(),
    catalogId: z.string(),
    description: z.string().optional(),
    incompleteReason: z.literal('missing-input-schema').optional()
  })
)
