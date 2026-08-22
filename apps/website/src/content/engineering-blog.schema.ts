import { z } from 'astro/zod'

// strictObject so a misspelled frontmatter key fails the content build
// instead of being silently dropped (same convention as customers.schema.ts).
export const engineeringBlogPostSchema = z.strictObject({
  title: z.string(),
  description: z.string(),
  author: z.string(),
  date: z.coerce.date(),
  // Which chapter of the internal "Understand This System" primer this post
  // was adapted from, kept for provenance. Not rendered on the page today.
  sourceSection: z.string().optional()
})

export type EngineeringBlogPostFrontmatter = z.infer<
  typeof engineeringBlogPostSchema
>
