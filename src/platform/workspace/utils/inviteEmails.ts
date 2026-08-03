const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const EMAIL_DELIMITER = /[,\s]+/

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

/** Normalize, drop blanks, dedupe (case-insensitive), then clamp to `maxSeats`. */
export function sanitizeInviteEmails(
  values: string[],
  maxSeats: number
): string[] {
  const unique = [...new Set(values.map(normalizeEmail).filter(Boolean))]
  return unique.length > maxSeats ? unique.slice(0, maxSeats) : unique
}
