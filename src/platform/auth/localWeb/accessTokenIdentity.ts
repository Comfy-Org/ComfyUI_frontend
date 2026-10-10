import { z } from 'zod'

const zClaims = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
  workspace_id: z.string().optional()
})

export interface AccessTokenIdentity {
  userId: string
  email?: string
  workspaceId?: string
}

function decodeSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

/**
 * The account and workspace the Cloud access token was issued for, read from
 * its claims as Desktop does. Nothing here grants access: Cloud verifies the
 * signature on every request.
 */
export function readAccessTokenIdentity(
  accessToken: string
): AccessTokenIdentity | undefined {
  const payload = accessToken.split('.').at(1)
  if (payload === undefined) return undefined
  let decoded: unknown
  try {
    decoded = decodeSegment(payload)
  } catch {
    return undefined
  }
  const claims = zClaims.safeParse(decoded)
  if (!claims.success) return undefined
  const { sub, email, workspace_id } = claims.data
  return { userId: sub, email, workspaceId: workspace_id }
}
