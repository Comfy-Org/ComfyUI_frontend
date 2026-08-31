import type { ComfyEvent, EventCategory, EventProgram } from '../data/events'
import type { Locale } from '../i18n/translations'

/** Sentinel for the "no filter" option in the type and program selects. */
export const DIRECTORY_FILTER_ALL = 'all'

export const EVENT_CATEGORIES: readonly EventCategory[] = [
  'livestream',
  'hackathon',
  'workshop',
  'meetup',
  'buildathon',
  'conference'
]

export const EVENT_PROGRAMS: readonly EventProgram[] = [
  'student',
  'communityHosts',
  'official',
  'partner'
]

export type EventsDirectoryView = 'map' | 'cards' | 'calendar'

export type EventsDirectoryFilters = {
  query: string
  category: EventCategory | typeof DIRECTORY_FILTER_ALL
  program: EventProgram | typeof DIRECTORY_FILTER_ALL
}

export function defaultDirectoryFilters(): EventsDirectoryFilters {
  return {
    query: '',
    category: DIRECTORY_FILTER_ALL,
    program: DIRECTORY_FILTER_ALL
  }
}

/** Free text matches the strings the visitor can actually read: the localized
 * title, description, and location. */
function matchesQuery(
  event: ComfyEvent,
  query: string,
  locale: Locale
): boolean {
  const needle = query.trim().toLocaleLowerCase(locale)
  if (!needle) return true
  return [
    event.title[locale],
    event.description[locale],
    event.location?.[locale] ?? ''
  ].some((field) => field.toLocaleLowerCase(locale).includes(needle))
}

/** Search ∧ type ∧ program, applied to an already-ordered event list — the
 * caller's order (upcoming first, then past) is preserved. */
export function filterDirectoryEvents(
  events: readonly ComfyEvent[],
  filters: EventsDirectoryFilters,
  locale: Locale
): ComfyEvent[] {
  return events.filter(
    (event) =>
      (filters.category === DIRECTORY_FILTER_ALL ||
        event.category === filters.category) &&
      (filters.program === DIRECTORY_FILTER_ALL ||
        event.program === filters.program) &&
      matchesQuery(event, filters.query, locale)
  )
}

const ISO_OFFSET = /([+-])(\d{2}):(\d{2})$/

/** Shift an ISO instant into its own written offset so `Intl` can format it as
 * UTC. Formatting in the server's or visitor's zone would move an evening event
 * onto the neighbouring day, and would differ between SSR and hydration. */
function inEventOffset(startDateTime: string): Date {
  const instant = new Date(startDateTime)
  const match = ISO_OFFSET.exec(startDateTime)
  if (!match) return instant
  const [, sign, hours, minutes] = match
  const offsetMinutes =
    (sign === '-' ? -1 : 1) * (Number(hours) * 60 + Number(minutes))
  return new Date(instant.getTime() + offsetMinutes * 60_000)
}

/** The hand-written label when the event has one, else the start date. */
export function eventDateLabel(event: ComfyEvent, locale: Locale): string {
  const written = event.dateLabel?.[locale]
  if (written) return written
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(inEventOffset(event.startDateTime))
}
