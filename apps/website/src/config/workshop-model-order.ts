import { z } from 'astro/zod'

import orderJson from '../content/workshop-model-order.json'

export const workshopModelOrderSchema = z.object({
  measuredOn: z.string(),
  windowDays: z.number().int().positive(),
  note: z.string(),
  // A slug listed twice would quietly take its last position and rank one model
  // wrong, with nothing to show for it.
  slugs: z
    .array(z.string())
    .refine((slugs) => new Set(slugs).size === slugs.length, {
      message: 'workshop-model-order.json lists a slug more than once'
    })
})

const order = workshopModelOrderSchema.parse(orderJson)

/**
 * How often each model was actually run, as an order rather than a number.
 *
 * The figures behind it are partner usage and stay out of this repository; what
 * the catalogue needs is only the sequence, which is what a visitor sees anyway.
 * A model the window never saw is absent, and falls in behind the ones it did.
 */
export const modelOrderRank = new Map(
  order.slugs.map((slug, index) => [slug, index])
)
