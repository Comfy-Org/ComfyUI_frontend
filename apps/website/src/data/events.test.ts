import { describe, expect, it } from 'vitest'

import type { ComfyEvent } from './events'
import {
  deriveFeaturedEvents,
  derivePastEvents,
  deriveUpcomingEvents,
  eventStatus,
  pastEvents,
  toCalendarEvent,
  upcomingEvents
} from './events'

const baseEvent: ComfyEvent = {
  id: 'test-event',
  category: 'livestream',
  title: { en: 'Test Event', 'zh-CN': '测试活动' },
  description: { en: 'A livestream.', 'zh-CN': '直播。' },
  location: { en: 'Online', 'zh-CN': '线上' },
  dateLabel: { en: 'August 5, 2026', 'zh-CN': '2026年8月5日' },
  startDateTime: '2026-08-05T13:00:00-07:00',
  link: { href: { en: '/launches', 'zh-CN': '/zh-CN/launches' } }
}

describe('toCalendarEvent', () => {
  it('maps localized fields and appends an absolute event link', () => {
    expect(toCalendarEvent(baseEvent, 'en')).toMatchObject({
      title: 'Test Event',
      description: 'A livestream.\n\nhttps://comfy.org/launches',
      location: 'Online'
    })
  })

  it('uses the requested locale', () => {
    expect(toCalendarEvent(baseEvent, 'zh-CN')).toMatchObject({
      title: '测试活动',
      description: '直播。\n\nhttps://comfy.org/zh-CN/launches',
      location: '线上'
    })
  })

  it('links events that have their own page to that page', () => {
    const event: ComfyEvent = { ...baseEvent, liveVideoId: 'abc123' }

    expect(toCalendarEvent(event, 'en').description).toBe(
      'A livestream.\n\nhttps://comfy.org/events/test-event'
    )
    expect(toCalendarEvent(event, 'zh-CN').description).toBe(
      '直播。\n\nhttps://comfy.org/zh-CN/events/test-event'
    )
  })

  it('keeps absolute links untouched', () => {
    const event: ComfyEvent = {
      ...baseEvent,
      link: {
        href: {
          en: 'https://www.youtube.com/live/abc',
          'zh-CN': 'https://www.youtube.com/live/abc'
        }
      }
    }

    expect(toCalendarEvent(event, 'en').description).toBe(
      'A livestream.\n\nhttps://www.youtube.com/live/abc'
    )
  })

  it('schedules a one-hour slot starting at the event start', () => {
    const calendarEvent = toCalendarEvent(baseEvent, 'en')

    expect(calendarEvent.start.toISOString()).toBe('2026-08-05T20:00:00.000Z')
    expect(calendarEvent.end.toISOString()).toBe('2026-08-05T21:00:00.000Z')
  })

  it('honors an explicit end', () => {
    const event: ComfyEvent = {
      ...baseEvent,
      endDateTime: '2026-08-05T16:00:00-07:00'
    }

    expect(toCalendarEvent(event, 'en').end.toISOString()).toBe(
      '2026-08-05T23:00:00.000Z'
    )
  })
})

describe('eventStatus', () => {
  it('is upcoming while the event is mid-window', () => {
    expect(eventStatus(baseEvent, new Date('2026-08-05T13:30:00-07:00'))).toBe(
      'upcoming'
    )
  })

  it('is past from one hour after the start by default', () => {
    expect(eventStatus(baseEvent, new Date('2026-08-05T14:00:00-07:00'))).toBe(
      'past'
    )
  })

  it('honors an explicit end past the one-hour default', () => {
    const event: ComfyEvent = {
      ...baseEvent,
      endDateTime: '2026-08-05T16:00:00-07:00'
    }

    expect(eventStatus(event, new Date('2026-08-05T15:00:00-07:00'))).toBe(
      'upcoming'
    )
    expect(eventStatus(event, new Date('2026-08-05T16:00:00-07:00'))).toBe(
      'past'
    )
  })
})

const eventAt = (id: string, overrides: Partial<ComfyEvent>): ComfyEvent => ({
  ...baseEvent,
  id,
  ...overrides
})

describe('event list derivation', () => {
  const now = new Date('2026-08-01T00:00:00Z')
  const list: readonly ComfyEvent[] = [
    eventAt('later', { startDateTime: '2026-08-12T10:00:00-07:00' }),
    eventAt('done', { startDateTime: '2026-07-01' }),
    eventAt('sooner', { startDateTime: '2026-08-05T10:00:00-07:00' }),
    eventAt('older', { startDateTime: '2026-06-20' })
  ]

  it('splits and orders upcoming events by start ascending', () => {
    expect(deriveUpcomingEvents(list, now).map((event) => event.id)).toEqual([
      'sooner',
      'later'
    ])
  })

  it('orders past events newest first by start', () => {
    expect(derivePastEvents(list, now).map((event) => event.id)).toEqual([
      'done',
      'older'
    ])
  })
})

describe('deriveFeaturedEvents', () => {
  const now = new Date('2026-08-01T00:00:00Z')
  const media = {
    type: 'image' as const,
    src: 'https://media.comfy.org/a.jpg',
    alt: { en: 'a', 'zh-CN': 'a' }
  }
  const list: readonly ComfyEvent[] = [
    eventAt('plain', { startDateTime: '2026-08-05T10:00:00-07:00' }),
    eventAt('second-slide', {
      startDateTime: '2026-08-05T10:00:00-07:00',
      liveVideoId: 'live1',
      featured: { order: 2, media, autoplayMs: 5000 }
    }),
    eventAt('first-slide', {
      startDateTime: '2026-06-24',
      recordingVideoId: 'rec1',
      featured: { order: 1, media }
    })
  ]

  it('includes only featured events, ordered by featured.order', () => {
    expect(deriveFeaturedEvents(list, now).map((slide) => slide.id)).toEqual([
      'first-slide',
      'second-slide'
    ])
  })

  it('shows the upcoming eyebrow only on upcoming events', () => {
    const [past, upcoming] = deriveFeaturedEvents(list, now)

    expect(past.eyebrow).toBeUndefined()
    expect(upcoming.eyebrow?.en).toBe('UPCOMING LIVESTREAM')
  })

  it('links slides to the event page when the event has one', () => {
    const [past, upcoming] = deriveFeaturedEvents(list, now)

    expect(past.href?.en).toBe('/events/first-slide')
    expect(upcoming.href?.en).toBe('/events/second-slide')
    expect(upcoming.autoplayMs).toBe(5000)
    expect(upcoming.showTitle).toBe(false)
  })
})

describe('site event data', () => {
  it('has unique event ids', () => {
    const ids = [...upcomingEvents, ...pastEvents].map((event) => event.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})
