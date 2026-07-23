import { z } from 'zod'

export const churnkeyAuthResponseSchema = z.object({
  customer_id: z.string().min(1),
  auth_hash: z.string().min(1),
  mode: z.enum(['live', 'test', 'sandbox'])
})

export type ChurnkeyAuthResponse = z.infer<typeof churnkeyAuthResponseSchema>
