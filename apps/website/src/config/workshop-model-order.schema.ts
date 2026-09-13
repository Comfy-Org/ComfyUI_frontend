import { z } from 'zod'

/** The validated stored order of the catalogue. */
export const workshopModelOrderSchema = z.object({
  measuredOn: z.string().date(),
  windowDays: z.number().int().positive(),
  note: z.string(),
  // A slug listed twice would quietly take its last position and rank one model
  // wrong, with nothing to show for it.
  slugs: z
    .array(z.string().trim().min(1))
    .min(1)
    .refine((slugs) => new Set(slugs).size === slugs.length, {
      message: 'workshop-model-order.json lists a slug more than once'
    })
})
