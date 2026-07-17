const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Split pasted/typed input on commas and newlines only, so addresses with
 *  surrounding whitespace (e.g. Outlook `"Alice B" <a@b.com>`) stay intact. */
export const EMAIL_DELIMITER = /[,\n]+/

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
