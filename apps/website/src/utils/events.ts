import type { Locale } from '../i18n/translations'
import type { CalendarEvent } from './calendar'
import type { JsonLdNode } from './jsonLd'

import { localizeHref } from '../config/routes'
import { t } from '../i18n/translations'
import { absoluteUrl, eventNode, jsonLdId } from './jsonLd'

export type EventCategory = 'livestream' | 'hackathon' | 'community'

export type LocationMode = 'online' | 'in-person'

export type EventMedia =
  | { type: 'image'; src: string; alt: string }
  | { type: 'video'; src: string; alt: string; poster?: string }

/**
 * The flat, per-locale events render model: every text field is already the
 * requested locale's string, and `href` is already localized. Produced by
 * flattening a source document (static today, CMS later) at the data boundary.
 */
export type ComfyEvent = {
  id: string
  category: EventCategory
  title: string
  description: string
  locationMode: LocationMode
  /** Physical venue name; unused when `locationMode` is `online`. */
  locationName?: string
  /** ISO start; drives upcoming/past classification, past-section sort order,
   * and VideoObject uploadDate. Approximate (set to the recording's publish
   * date) for events that predate this field. */
  startDateTime: string
  /** Defaults to one hour after the start. */
  endDateTime?: string
  /** IANA zone the display date renders in. Defaults to Pacific. */
  timeZone?: string
  /** External target used when the event has no /events/[slug] page. */
  href?: string
  newTab?: boolean
  /** Overrides the default "Livestream" label on the upcoming-list CTA. */
  ctaLabel?: string
  /** Past-gallery card art. */
  media?: EventMedia
  liveVideoId?: string
  /** Supersedes liveVideoId once the recording is published. */
  recordingVideoId?: string
  featured?: {
    order: number
    media: EventMedia
    autoplayMs?: number
    showTitle?: boolean
  }
}

export type FeaturedEvent = {
  id: string
  eyebrow?: string
  title: string
  showTitle: boolean
  media: EventMedia
  href?: string
  newTab?: boolean
  autoplayMs?: number
}

export const eventPath = (event: { id: string }): string =>
  `/events/${event.id}`

const eventPageHref = (id: string, locale: Locale): string =>
  localizeHref(eventPath({ id }), locale)

export const youtubeWatchHref = (videoId: string): string =>
  `https://www.youtube.com/watch?v=${videoId}`

export const eventVideoId = (event: ComfyEvent): string | undefined =>
  event.recordingVideoId ?? event.liveVideoId

const EVENT_DURATION_MS = 60 * 60 * 1000
const SITE_ORIGIN = 'https://comfy.org'

/** The location a visitor sees: the localized Online label, or the venue. */
export const eventLocationLabel = (
  event: ComfyEvent,
  locale: Locale
): string | undefined =>
  event.locationMode === 'online'
    ? t('events.location.online', locale)
    : event.locationName

export function toCalendarEvent(
  event: ComfyEvent,
  locale: Locale
): CalendarEvent {
  const target = eventVideoId(event)
    ? eventPageHref(event.id, locale)
    : (event.href ?? eventPageHref(event.id, locale))
  const href = new URL(target, SITE_ORIGIN).href
  const start = new Date(event.startDateTime)
  return {
    title: event.title,
    description: `${event.description}\n\n${href}`,
    location: eventLocationLabel(event, locale) ?? '',
    start,
    end: eventEnd(event)
  }
}

export function eventJsonLdNode(
  event: ComfyEvent,
  input: {
    siteUrl: string
    site: URL | undefined
    pageUrl: string
    locale: Locale
  }
): JsonLdNode {
  const { siteUrl, site, pageUrl, locale } = input
  const href = event.href ?? localizeHref(eventPath(event), locale)
  const online = event.locationMode === 'online'
  return eventNode({
    siteUrl,
    id: jsonLdId(pageUrl, `event-${event.id}`),
    name: event.title,
    description: event.description,
    startDate: event.startDateTime,
    ...(online
      ? { virtualUrl: href.startsWith('/') ? absoluteUrl(site, href) : href }
      : { placeName: event.locationName }),
    locale
  })
}

function eventEnd(event: ComfyEvent): Date {
  if (event.endDateTime) return new Date(event.endDateTime)
  return new Date(new Date(event.startDateTime).getTime() + EVENT_DURATION_MS)
}

export type EventStatus = 'upcoming' | 'past'

export function eventStatus(event: ComfyEvent, now: Date): EventStatus {
  return now.getTime() >= eventEnd(event).getTime() ? 'past' : 'upcoming'
}

export function deriveUpcomingEvents(
  events: readonly ComfyEvent[],
  now: Date
): readonly ComfyEvent[] {
  return events
    .filter((event) => eventStatus(event, now) === 'upcoming')
    .sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime))
}

export function derivePastEvents(
  events: readonly ComfyEvent[],
  now: Date
): readonly ComfyEvent[] {
  return events
    .filter((event) => eventStatus(event, now) === 'past')
    .sort((a, b) => Date.parse(b.startDateTime) - Date.parse(a.startDateTime))
}

export function deriveFeaturedEvents(
  events: readonly ComfyEvent[],
  now: Date,
  locale: Locale
): readonly FeaturedEvent[] {
  return events
    .flatMap((event) =>
      event.featured ? [{ event, featured: event.featured }] : []
    )
    .sort((a, b) => a.featured.order - b.featured.order)
    .map(({ event, featured }) => ({
      id: event.id,
      eyebrow:
        eventStatus(event, now) === 'upcoming' &&
        event.category === 'livestream'
          ? t('events.hero.upcomingLivestream', locale)
          : undefined,
      title: event.title,
      showTitle: featured.showTitle ?? false,
      media: featured.media,
      href: eventVideoId(event) ? eventPageHref(event.id, locale) : event.href,
      newTab: eventVideoId(event) ? false : event.newTab,
      autoplayMs: featured.autoplayMs
    }))
}
