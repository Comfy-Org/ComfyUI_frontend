import { z } from 'zod'

/**
 * The generated schemas coerce every int64 to a `bigint`, which no caller can
 * add to a price or hand to a currency formatter, while the generated *type*
 * for the same field is a `number`. Billing amounts and credit counts sit well
 * inside the JavaScript-safe range, so they are read as safe integers.
 */
export const wireCents = z.number().int().safe()
