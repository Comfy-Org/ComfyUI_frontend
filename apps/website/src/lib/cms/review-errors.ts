import { z } from 'astro/zod'

// Private authoring errors: expose field diagnostics, never arbitrary upstream
// bodies, credentials or debug context. The server also bounds bytes before parse.
export const reviewErrors = z.object({
  field_errors: z
    .array(
      z.object({
        path: z.string().max(2000),
        message: z.string().max(1000)
      })
    )
    .max(100)
})

export function reviewFieldErrors(raw: unknown) {
  const result = reviewErrors.safeParse(raw)
  return result.success ? result.data.field_errors : []
}
