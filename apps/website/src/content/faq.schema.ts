import { z } from 'astro/zod'

export const faqSchema = z.strictObject({
  question: z.string(),
  order: z.number().int().nonnegative()
})
