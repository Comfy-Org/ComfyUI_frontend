import { z } from 'zod'

/**
 * The stored order of the catalogue, kept apart from the file it validates so
 * that a browser test can hold the page to the same contract the site is built
 * from.
 */
export const workshopModelOrderSchema = z.object({
  measuredOn: z.string().date(),
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
