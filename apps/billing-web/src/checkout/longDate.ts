/** A server's billing boundary as the checkout spells it: "July 28, 2026", in UTC like the boundary itself. */
export function longDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(iso))
}
