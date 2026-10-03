import { zSubscriptionDiscount } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

/**
 * The generated schema coerces every int64 to a `bigint`, which no caller can
 * add to a price or hand to a currency formatter, while the generated type
 * for the same field is a `number`. Money on this route is bounded to cents
 * well inside the JavaScript-safe range, so these amounts remain usable for
 * arithmetic and display.
 */
export const centsSchema = z.number().int().safe()

export const subscriptionDiscountSchema = zSubscriptionDiscount.extend({
  amount_off_cents: centsSchema.optional(),
  duration_in_months: z.number().int().safe().optional()
})
