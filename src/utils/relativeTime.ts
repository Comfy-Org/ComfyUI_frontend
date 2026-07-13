const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS
const MONTH_MS = 30 * DAY_MS
const YEAR_MS = 365 * DAY_MS

const UNITS: readonly [number, string][] = [
  [YEAR_MS, 'yearsAgo'],
  [MONTH_MS, 'monthsAgo'],
  [WEEK_MS, 'weeksAgo'],
  [DAY_MS, 'daysAgo'],
  [HOUR_MS, 'hoursAgo'],
  [MINUTE_MS, 'minutesAgo']
]

type Translator = (key: string, named?: { count: number }) => string

export function formatRelativeTime(t: Translator, diffMs: number): string {
  for (const [ms, suffix] of UNITS) {
    const value = Math.floor(diffMs / ms)
    if (value > 0) return t(`g.relativeTime.${suffix}`, { count: value })
  }
  return t('g.relativeTime.now')
}
