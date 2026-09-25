import { z } from 'zod'

// Draft of RevokeAllSessionsResponse; retired by the generated schema once cloud#10589 merges.
export const zRevokeAllSessionsResponse = z.object({
  revoked: z.number().int()
})
