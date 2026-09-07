const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

interface RelativeTimeLabels {
  justNow: string
  minutesAgo: (n: number) => string
  hoursAgo: (n: number) => string
  daysAgo: (n: number) => string
}

/**
 * Abbreviated "time ago" label (e.g. "6 min ago", "2 hr ago", "3 days ago"),
 * matching the member-list activity column. Copy is injected so callers can
 * supply localized, pluralized strings.
 */
export function formatRelativeTime(
  date: Date,
  now: Date,
  labels: RelativeTimeLabels
): string {
  const elapsed = Math.max(0, now.getTime() - date.getTime())

  if (elapsed < MINUTE_MS) return labels.justNow
  if (elapsed < HOUR_MS)
    return labels.minutesAgo(Math.floor(elapsed / MINUTE_MS))
  if (elapsed < DAY_MS) return labels.hoursAgo(Math.floor(elapsed / HOUR_MS))
  return labels.daysAgo(Math.floor(elapsed / DAY_MS))
}
