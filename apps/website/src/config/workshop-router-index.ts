import { z } from 'astro/zod'

export const workshopRouterIndexSchema = z.array(
  z.object({
    id: z.string(),
    catalogId: z.string(),
    description: z.string().optional(),
    altProviders: z
      .array(z.object({ provider: z.string(), routerId: z.string() }))
      .optional(),
    unavailableReason: z.literal('router-not-enabled').optional(),
    incompleteReason: z.literal('missing-input-schema').optional()
  })
)
