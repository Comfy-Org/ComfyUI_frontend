import { z } from 'zod'

export const churnkeySessionResponseSchema = z.object({
  customer_id: z.string().min(1),
  auth_hash: z.string().min(1),
  mode: z.enum(['live', 'test']),
  subscription: z.object({
    id: z.string().min(1),
    started_at: z.string().datetime(),
    status: z.literal('active'),
    current_period_start: z.string().datetime(),
    current_period_end: z.string().datetime(),
    plan: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      amount_cents: z.number().int().positive(),
      currency: z.literal('usd'),
      interval: z.enum(['month', 'year']),
      interval_count: z.literal(1)
    }),
    quantity: z.number().int().positive()
  })
})

export type ChurnkeySessionResponse = z.infer<
  typeof churnkeySessionResponseSchema
>
