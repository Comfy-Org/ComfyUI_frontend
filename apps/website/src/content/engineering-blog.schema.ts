import { z } from 'astro/zod'

// strictObject so a misspelled frontmatter key fails the content build
// instead of being silently dropped (same convention as customers.schema.ts).
export const engineeringBlogPostSchema = z.strictObject({
  title: z.string(),
  description: z.string(),
  author: z.string(),
  date: z.coerce.date(),
  // Key into the diagram registry (src/components/engineering-blog/diagrams/
  // registry.ts). Used as the card/thumbnail image on the listing page; the
  // same diagram is also embedded inline in the post body via its MDX tag.
  heroDiagram: z.enum(['architecture', 'stamp', 'feedback-loop', 'two-doors']),
  // Which chapter of the internal "Understand This System" primer this post
  // was adapted from, kept for provenance. Not rendered on the page today.
  sourceSection: z.string().optional()
})
