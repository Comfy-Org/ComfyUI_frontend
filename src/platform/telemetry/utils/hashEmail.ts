export type EmailHashAlgorithm = 'SHA-1' | 'SHA-256'

export function normalizeEmail(email?: string): string | undefined {
  const normalizedEmail = email?.trim().toLowerCase()
  return normalizedEmail || undefined
}

export async function hashEmail(
  email: string | undefined,
  algorithm: EmailHashAlgorithm
): Promise<string | undefined> {
  const normalizedEmail = normalizeEmail(email)
  if (
    !normalizedEmail ||
    !globalThis.crypto?.subtle ||
    typeof TextEncoder === 'undefined'
  ) {
    return undefined
  }

  try {
    const digestBuffer = await globalThis.crypto.subtle.digest(
      algorithm,
      new TextEncoder().encode(normalizedEmail)
    )

    return Array.from(new Uint8Array(digestBuffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return undefined
  }
}
