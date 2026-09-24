/** Mirrors GET /api/auth/session from cloud#10549; replace with `@comfyorg/ingest-types/zod` once BE-17063 is generated. */
import { z } from 'zod'

const zWebSessionUser = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().optional(),
  email_verified: z.boolean(),
  sign_in_provider: z.string().optional()
})

export const zWebSessionResponse = z.object({
  user: zWebSessionUser,
  csrf_token: z.string(),
  expires_at: z.string().datetime(),
  absolute_expires_at: z.string().datetime()
})
