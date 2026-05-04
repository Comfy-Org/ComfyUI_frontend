/**
 * Format a number with the given BCP-47 locale.
 * Returns an em-dash for non-numeric inputs.
 */
export function formatNumber(
  value: number | undefined,
  locale: string
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(locale).format(value)
}

/**
 * Format an ISO 8601 date string with the given BCP-47 locale using the
 * `medium` date style (e.g. "Apr 19, 2026"). Returns an em-dash for missing
 * or unparseable inputs.
 */
export function formatMediumDate(
  value: string | undefined,
  locale: string
): string {
  if (!value) return '—'
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    timestamp
  )
}
