import { zSubscriptionDiscount } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

export const centsSchema = z.coerce.number().int().safe()

export const subscriptionDiscountSchema = zSubscriptionDiscount.extend({
  amount_off_cents: centsSchema.optional(),
  duration_in_months: z.coerce.number().int().safe().optional()
})
