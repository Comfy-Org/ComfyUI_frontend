import { z } from 'astro/zod'

export const faqSchema = z.strictObject({
  question: z.string(),
  order: z.number().int().nonnegative(),
  /**
   * Present only on answers the translation pipeline generated.
   *
   * Generated and hand-written answers share a `<category>/<locale>/` folder,
   * so the file itself has to say which it is — otherwise a run could not tell
   * reviewed Chinese from its own earlier output, and would be free to
   * overwrite it. Absent means a person wrote it, and the pipeline leaves it
   * alone.
   */
  translatedBy: z.literal('machine').optional()
})
