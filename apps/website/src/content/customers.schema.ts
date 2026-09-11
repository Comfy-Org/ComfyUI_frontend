import { z } from 'astro/zod'

// strictObject so a misspelled frontmatter key (e.g. readMoreHref) fails the
// content build instead of being silently dropped.
export const customerStorySchema = z.strictObject({
  title: z.string(),
  category: z.string(),
  description: z.string(),
  cover: z.url(),
  readMore: z.url().optional(),
  order: z.number().int().nonnegative(),
  sections: z.array(z.object({ id: z.string(), label: z.string() })),
  /**
   * Present only on stories the translation pipeline generated.
   *
   * Generated and hand-written stories share a `<locale>/` folder, so the file
   * itself has to say which it is — otherwise a run could not tell reviewed
   * Chinese from its own earlier output, and would be free to overwrite it.
   * Absent means a person wrote it, and the pipeline leaves it alone.
   */
  translatedBy: z.literal('machine').optional()
})

export type CustomerStoryFrontmatter = z.infer<typeof customerStorySchema>
