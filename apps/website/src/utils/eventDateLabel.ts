import type { Locale } from '../i18n/translations'

export interface EventDateInput {
  startDateTime: string
  endDateTime?: string
  timeZone?: string
}

const DEFAULT_EVENT_TIME_ZONE = 'America/Los_Angeles'

interface WallClockTime {
  hour12: number
  minute: number
  isAm: boolean
}

function wallClockTime(date: Date, timeZone: string): WallClockTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(date)
  const numeric = (type: 'hour' | 'minute'): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  const hour = numeric('hour')
  return {
    hour12: hour % 12 === 0 ? 12 : hour % 12,
    minute: numeric('minute'),
    isAm: hour < 12
  }
}

// Generic zone abbreviation (PT/ET rather than PDT/PST), always in English —
// the hand-written zh labels also used the Latin abbreviation (（PT）).
function zoneAbbreviation(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortGeneric'
  }).formatToParts(date)
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
}

function clockDigits(time: WallClockTime, withMinutes: boolean): string {
  return withMinutes
    ? `${time.hour12}:${String(time.minute).padStart(2, '0')}`
    : `${time.hour12}`
}

function enTimeSpan(
  start: WallClockTime,
  end: WallClockTime | undefined,
  withMinutes: boolean
): string {
  const period = (time: WallClockTime): string => (time.isAm ? 'AM' : 'PM')
  if (!end) return `${clockDigits(start, withMinutes)} ${period(start)}`
  if (start.isAm === end.isAm) {
    return `${clockDigits(start, withMinutes)}–${clockDigits(end, withMinutes)} ${period(start)}`
  }
  return `${clockDigits(start, withMinutes)} ${period(start)}–${clockDigits(end, withMinutes)} ${period(end)}`
}

function zhTimeSpan(
  start: WallClockTime,
  end: WallClockTime | undefined,
  withMinutes: boolean
): string {
  const period = (time: WallClockTime): string => (time.isAm ? '上午' : '下午')
  // On-the-hour times read as 6点; times with minutes as 1:30.
  const digits = (time: WallClockTime): string =>
    withMinutes ? clockDigits(time, true) : `${clockDigits(time, false)}点`
  if (!end) return `${period(start)}${digits(start)}`
  const endPrefix = start.isAm === end.isAm ? '' : period(end)
  return `${period(start)}${digits(start)}至${endPrefix}${digits(end)}`
}

/**
 * Localized display date derived from the event's datetimes, rendered in the
 * event's own time zone — e.g. `August 26, 2026 · 6–9 PM PT` /
 * `2026年8月26日 · 下午6点至9点（PT）`.
 */
export function formatEventDateLabel(
  event: EventDateInput,
  locale: Locale
): string {
  const timeZone = event.timeZone ?? DEFAULT_EVENT_TIME_ZONE
  const start = new Date(event.startDateTime)
  const end = event.endDateTime ? new Date(event.endDateTime) : undefined
  const startTime = wallClockTime(start, timeZone)
  const endTime = end ? wallClockTime(end, timeZone) : undefined
  const withMinutes = startTime.minute !== 0 || (endTime?.minute ?? 0) !== 0
  const zone = zoneAbbreviation(start, timeZone)

  const date = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(start)

  return locale === 'zh-CN'
    ? `${date} · ${zhTimeSpan(startTime, endTime, withMinutes)}（${zone}）`
    : `${date} · ${enTimeSpan(startTime, endTime, withMinutes)} ${zone}`
}
