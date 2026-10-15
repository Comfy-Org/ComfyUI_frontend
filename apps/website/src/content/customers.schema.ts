import { z } from 'astro/zod'

// strictObject so a misspelled frontmatter key (e.g. readMoreHref) fails the
// content build instead of being silently dropped.
export const customerStorySchema = z.strictObject({
  title: z.string(),
  category: z.string(),
  description: z.string(),
  cover: z.url(),
  hideHeroImage: z.boolean().optional(),
  readMore: z.url().optional(),
  order: z.number().int().nonnegative(),
  dateAdded: z.iso.date(),
  sections: z.array(z.object({ id: z.string(), label: z.string() }))
})

export type CustomerStoryFrontmatter = z.infer<typeof customerStorySchema>
