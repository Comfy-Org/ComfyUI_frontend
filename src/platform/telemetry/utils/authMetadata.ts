import type { AuthMetadata } from '../types'

async function hashSha256(value: string): Promise<string | undefined> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return
  if (typeof TextEncoder === 'undefined') return
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function buildAuthMetadata(
  method: 'email' | 'google' | 'github',
  isNewUser: boolean,
  userId?: string
): Promise<AuthMetadata> {
  const metadata: AuthMetadata = { method, is_new_user: isNewUser }

  if (isNewUser && userId) {
    try {
      const userIdHash = await hashSha256(userId)
      if (userIdHash) {
        metadata.user_id_hash = userIdHash
      }
    } catch (error) {
      console.warn('Failed to hash user id for telemetry', error)
    }
  }

  return metadata
}
