import { describe, expect, it } from 'vitest'

import type { CalendarEvent } from './calendar'
import {
  toGoogleCalendarUrl,
  toIcsDataUri,
  toOutlookCalendarUrl
} from './calendar'

const event: CalendarEvent = {
  title: 'The Future of AI Post Production',
  description: 'Custom LoRAs, motion graphics.\nWatch: https://example.com',
  location: 'https://www.youtube.com/live/4xS4LOn3CTE',
  // 1PM PT (UTC-7) → 20:00 UTC, one hour long.
  start: new Date('2026-08-05T13:00:00-07:00'),
  end: new Date('2026-08-05T14:00:00-07:00')
}

describe('toGoogleCalendarUrl', () => {
  it('encodes the event as a Google Calendar template with UTC timestamps', () => {
    const url = new URL(toGoogleCalendarUrl(event))
    expect(url.origin + url.pathname).toBe(
      'https://calendar.google.com/calendar/render'
    )
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe(event.title)
    expect(url.searchParams.get('dates')).toBe(
      '20260805T200000Z/20260805T210000Z'
    )
    expect(url.searchParams.get('location')).toBe(event.location)
    expect(url.searchParams.get('details')).toBe(event.description)
  })
})

describe('toOutlookCalendarUrl', () => {
  it('encodes the event with ISO start/end for the Outlook compose deeplink', () => {
    const url = new URL(toOutlookCalendarUrl(event))
    expect(url.origin + url.pathname).toBe(
      'https://outlook.live.com/calendar/0/deeplink/compose'
    )
    expect(url.searchParams.get('rru')).toBe('addevent')
    expect(url.searchParams.get('subject')).toBe(event.title)
    expect(url.searchParams.get('startdt')).toBe('2026-08-05T20:00:00.000Z')
    expect(url.searchParams.get('enddt')).toBe('2026-08-05T21:00:00.000Z')
    expect(url.searchParams.get('body')).toBe(event.description)
    expect(url.searchParams.get('location')).toBe(event.location)
  })
})

describe('toIcsDataUri', () => {
  const decodeIcs = (uri: string) =>
    decodeURIComponent(uri.replace(/^data:text\/calendar;charset=utf-8,/, ''))

  it('produces a downloadable calendar with UTC DTSTART/DTEND', () => {
    const uri = toIcsDataUri(event)
    expect(uri.startsWith('data:text/calendar;charset=utf-8,')).toBe(true)

    const ics = decodeIcs(uri)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('DTSTART:20260805T200000Z')
    expect(ics).toContain('DTEND:20260805T210000Z')
    expect(ics).toContain('SUMMARY:The Future of AI Post Production')
    expect(ics).toContain(`LOCATION:${event.location}`)
    expect(ics).toContain('END:VCALENDAR')
  })

  it('escapes commas and newlines in free-text fields', () => {
    const ics = decodeIcs(toIcsDataUri(event))
    expect(ics).toContain(
      'DESCRIPTION:Custom LoRAs\\, motion graphics.\\nWatch: https://example.com'
    )
  })
})
