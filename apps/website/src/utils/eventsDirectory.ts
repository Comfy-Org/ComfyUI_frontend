import type { ComfyEvent, EventCategory, EventOrganizer } from '../data/events'
import type { Locale } from '../i18n/translations'
import type { CalendarEvent } from './calendar'

import { localizeHref } from '../config/routes'
import {
  eventPath,
  eventStatus,
  eventVideoId,
  toCalendarEvent
} from '../data/events'
import { t } from '../i18n/translations'

/** Sentinel for the "no filter" option in the type and organizer selects. */
export const DIRECTORY_FILTER_ALL = 'all'

export const EVENT_CATEGORIES: readonly EventCategory[] = [
  'livestream',
  'hackathon',
  'workshop',
  'meetup',
  'conference'
]

export const EVENT_ORGANIZERS: readonly EventOrganizer[] = [
  'comfy',
  'community',
  'partner'
]

export type EventsDirectoryView = 'map' | 'cards' | 'calendar'

export type EventsDirectoryFilters = {
  query: string
  category: EventCategory | typeof DIRECTORY_FILTER_ALL
  organizer: EventOrganizer | typeof DIRECTORY_FILTER_ALL
}

export function defaultDirectoryFilters(): EventsDirectoryFilters {
  return {
    query: '',
    category: DIRECTORY_FILTER_ALL,
    organizer: DIRECTORY_FILTER_ALL
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
    event.title[locale] || event.title.en,
    event.description[locale] || event.description.en,
    event.location?.[locale] || event.location?.en || ''
  ].some((field) => field.toLocaleLowerCase(locale).includes(needle))
}

/** Search, type and organizer, applied to an already-ordered event list. The
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
      (filters.organizer === DIRECTORY_FILTER_ALL ||
        event.organizer === filters.organizer) &&
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
  const written = event.dateLabel?.[locale] || event.dateLabel?.en
  if (written) return written
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(inEventOffset(event.startDateTime))
}

/** Everything the map, list, and cards views need about one event, resolved
 * once so the views stay presentational and agree on the CTA rules. */
export type DirectoryRow = {
  event: ComfyEvent
  /** Set once here so no view needs its own clock to classify a row. */
  upcoming: boolean
  category: string
  /** Resolved here, with the site's English fallback, so views never reach
   * back into the event for localized text. */
  title: string
  description: string
  date: string
  location: string
  media?: { src: string; alt: string; poster?: string; isVideo: boolean }
  /** Past rows link out; upcoming rows offer the calendar menu instead. */
  watch?: { href: string; newTab: boolean }
  calendar?: CalendarEvent
}

function mediaOf(event: ComfyEvent, locale: Locale): DirectoryRow['media'] {
  // Events that became past before dedicated card art existed fall back to
  // their carousel art, the same way the past gallery does.
  const media = event.media ?? event.featured?.media
  if (!media) return undefined
  const isVideo = media.type === 'video'
  return {
    src: media.src,
    alt: media.alt[locale] || media.alt.en,
    poster: isVideo ? media.poster : undefined,
    isVideo
  }
}

/** Mirrors the past-gallery cards: a recording opens its own /events/[slug]
 * page, anything else links out to the event's own page. An event with
 * neither gets no CTA rather than a link to a page that does not exist. */
function watchOf(event: ComfyEvent, locale: Locale): DirectoryRow['watch'] {
  if (eventVideoId(event)) {
    return { href: localizeHref(eventPath(event), locale), newTab: false }
  }
  if (!event.link) return undefined
  return {
    href: event.link.href[locale] || event.link.href.en,
    newTab: event.link.newTab ?? false
  }
}

export function directoryRows(
  events: readonly ComfyEvent[],
  locale: Locale,
  now: Date
): DirectoryRow[] {
  return events.map((event) => {
    const upcoming = eventStatus(event, now) === 'upcoming'
    return {
      event,
      upcoming,
      category: t(`events.category.${event.category}`, locale),
      title: event.title[locale] || event.title.en,
      description: event.description[locale] || event.description.en,
      date: eventDateLabel(event, locale),
      location:
        event.location?.[locale] ||
        event.location?.en ||
        t('events.directory.virtual', locale),
      media: mediaOf(event, locale),
      watch: upcoming ? undefined : watchOf(event, locale),
      calendar: upcoming ? toCalendarEvent(event, locale) : undefined
    }
  })
}

export type DirectoryMonth = {
  /** `YYYY-MM` in the event's own offset — stable across locales. Pass it to
   * `monthLabel` for the heading. */
  key: string
  upcoming: boolean
  rows: DirectoryRow[]
}

function monthKey(startDateTime: string): string {
  return inEventOffset(startDateTime).toISOString().slice(0, 7)
}

/** Group the agenda by calendar month: upcoming months ascending, then past
 * months descending, mirroring the list's upcoming-first rule. A month counts
 * as upcoming when any event in it still lies ahead, so the current month sits
 * with the upcoming ones even once some of its events have passed.
 *
 * Takes rows rather than events and a clock: `DirectoryRow.upcoming` already
 * carries the one classification, so the agenda cannot disagree with the list
 * about where the boundary falls. */
export function groupRowsByMonth(
  rows: readonly DirectoryRow[]
): DirectoryMonth[] {
  const months = new Map<string, DirectoryMonth>()
  for (const row of rows) {
    const key = monthKey(row.event.startDateTime)
    const month = months.get(key)
    if (month) {
      month.rows.push(row)
      month.upcoming ||= row.upcoming
    } else {
      months.set(key, { key, upcoming: row.upcoming, rows: [row] })
    }
  }

  const byStart = (a: DirectoryRow, b: DirectoryRow) =>
    Date.parse(a.event.startDateTime) - Date.parse(b.event.startDateTime)

  const ordered = [...months.values()]
  for (const month of ordered) {
    // An agenda counts forward through what is coming and backward through
    // what already happened.
    month.rows.sort(month.upcoming ? byStart : (a, b) => byStart(b, a))
  }

  const upcoming = ordered
    .filter((month) => month.upcoming)
    .sort((a, b) => a.key.localeCompare(b.key))
  const past = ordered
    .filter((month) => !month.upcoming)
    .sort((a, b) => b.key.localeCompare(a.key))

  return [...upcoming, ...past]
}

/** Month headings come from `Intl`, so no month names enter the i18n table. */
export function monthLabel(key: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${key}-01T00:00:00Z`))
}
