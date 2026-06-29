import { z } from 'astro/zod'

export const customerStorySchema = z.object({
  title: z.string(),
  category: z.string(),
  description: z.string(),
  cover: z.url(),
  coverAlt: z.string().optional(),
  readMore: z.url().optional(),
  order: z.number().int().nonnegative(),
  sections: z.array(z.object({ id: z.string(), label: z.string() }))
})

export type CustomerStoryFrontmatter = z.infer<typeof customerStorySchema>
