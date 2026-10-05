/** A date in copy reads as one unit, so a line never wraps inside it. */
export function unbrokenDate(formatted: string): string {
  return formatted.replace(/\s/g, ' ')
}

function utcDate(
  iso: string,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string {
  return unbrokenDate(
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
      new Date(iso)
    )
  )
}

/** A server's billing boundary as the checkout spells it: "July 28, 2026", in UTC like the boundary itself. */
export function longDate(iso: string, locale: string): string {
  return utcDate(iso, locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

export function monthDay(iso: string, locale: string): string {
  return utcDate(iso, locale, { month: 'long', day: 'numeric' })
}
