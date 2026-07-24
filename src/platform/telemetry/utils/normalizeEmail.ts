export function normalizeEmail(
  email: string | null | undefined
): string | null {
  return email?.trim().toLowerCase() || null
}
