import { describe, expect, it } from 'vitest'

import type { UpcomingEvent } from './events'
import { toCalendarEvent } from './events'

const baseEvent: UpcomingEvent = {
  id: 'test-event',
  name: { en: 'Test Event', 'zh-CN': '测试活动' },
  description: { en: 'A livestream.', 'zh-CN': '直播。' },
  location: { en: 'Online', 'zh-CN': '线上' },
  dateLabel: { en: 'August 5, 2026', 'zh-CN': '2026年8月5日' },
  dateTime: '2026-08-05T13:00:00-07:00',
  link: { href: { en: '/launches', 'zh-CN': '/zh-CN/launches' } }
}

describe('toCalendarEvent', () => {
  it('returns undefined for events without a dateTime', () => {
    expect(toCalendarEvent({ ...baseEvent, dateTime: undefined }, 'en')).toBe(
      undefined
    )
  })

  it('maps localized fields and appends an absolute event link', () => {
    const calendarEvent = toCalendarEvent(baseEvent, 'en')

    expect(calendarEvent).toMatchObject({
      title: 'Test Event',
      description: 'A livestream.\n\nhttps://comfy.org/launches',
      location: 'Online'
    })
  })

  it('uses the requested locale', () => {
    const calendarEvent = toCalendarEvent(baseEvent, 'zh-CN')

    expect(calendarEvent).toMatchObject({
      title: '测试活动',
      description: '直播。\n\nhttps://comfy.org/zh-CN/launches',
      location: '线上'
    })
  })

  it('keeps absolute links untouched', () => {
    const event: UpcomingEvent = {
      ...baseEvent,
      link: {
        href: {
          en: 'https://www.youtube.com/live/abc',
          'zh-CN': 'https://www.youtube.com/live/abc'
        }
      }
    }

    expect(toCalendarEvent(event, 'en')?.description).toBe(
      'A livestream.\n\nhttps://www.youtube.com/live/abc'
    )
  })

  it('schedules a one-hour slot starting at the event dateTime', () => {
    const calendarEvent = toCalendarEvent(baseEvent, 'en')

    expect(calendarEvent?.start.toISOString()).toBe('2026-08-05T20:00:00.000Z')
    expect(calendarEvent?.end.toISOString()).toBe('2026-08-05T21:00:00.000Z')
  })
})
