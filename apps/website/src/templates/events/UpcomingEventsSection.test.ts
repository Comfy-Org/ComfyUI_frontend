// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as EventsData from '../../data/events'

import UpcomingEventsSection from './UpcomingEventsSection.vue'

// `upcomingEvents` is derived from the wall clock, so it empties out once the
// newest configured event has ended and the e2e coverage of these rows goes
// quiet with it. Stubbing the list keeps the row markup, localization, and
// link targets covered whatever the date and whatever happens to be scheduled.
const { streamedEvent, externalEvent, stub } = vi.hoisted(() => {
  const streamedEvent = {
    id: 'streamed-event',
    category: 'livestream',
    title: { en: 'Streamed Event', 'zh-CN': '直播活动' },
    description: { en: 'Watch it live.', 'zh-CN': '在线观看。' },
    location: { en: 'Online', 'zh-CN': '线上' },
    dateLabel: {
      en: 'September 1, 2026 · 10AM PT',
      'zh-CN': '2026年9月1日 · 上午10点（PT）'
    },
    startDateTime: '2026-09-01T10:00:00-07:00',
    liveVideoId: 'live123'
  } satisfies EventsData.ComfyEvent
  const externalEvent = {
    id: 'external-event',
    category: 'community',
    title: { en: 'External Event', 'zh-CN': '外部活动' },
    description: { en: 'Hosted elsewhere.', 'zh-CN': '由他方举办。' },
    location: { en: 'San Francisco', 'zh-CN': '旧金山' },
    dateLabel: { en: 'September 8, 2026', 'zh-CN': '2026年9月8日' },
    startDateTime: '2026-09-08T10:00:00-07:00',
    link: {
      href: { en: 'https://lu.ma/comfy-sf', 'zh-CN': 'https://lu.ma/comfy-sf' },
      newTab: true
    }
  } satisfies EventsData.ComfyEvent
  const upcomingEvents: readonly EventsData.ComfyEvent[] = [
    streamedEvent,
    externalEvent
  ]
  return { streamedEvent, externalEvent, stub: { upcomingEvents } }
})

vi.mock('../../data/events', async (importOriginal) => {
  const actual = await importOriginal<typeof EventsData>()
  return {
    ...actual,
    get upcomingEvents() {
      return stub.upcomingEvents
    }
  }
})

beforeEach(() => {
  stub.upcomingEvents = [streamedEvent, externalEvent]
})

describe('UpcomingEventsSection', () => {
  it('renders a row per upcoming event with its title, blurb, location and date', () => {
    render(UpcomingEventsSection)

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)

    for (const [index, event] of [streamedEvent, externalEvent].entries()) {
      const row = rows[index]
      expect(row.textContent).toContain(event.title.en)
      expect(row.textContent).toContain(event.description.en)
      expect(row.textContent).toContain(event.location.en)
      expect(row.textContent).toContain(event.dateLabel.en)
    }
  })

  it('links streamed events to their own page and the rest straight out', () => {
    render(UpcomingEventsSection)

    const streamedLink = screen.getByRole('link', {
      name: `${streamedEvent.title.en} — Livestream`
    })
    expect(streamedLink.getAttribute('href')).toBe('/events/streamed-event')
    expect(streamedLink.getAttribute('target')).toBeNull()

    const externalLink = screen.getByRole('link', {
      name: `${externalEvent.title.en} — Livestream`
    })
    expect(externalLink.getAttribute('href')).toBe(externalEvent.link.href.en)
    expect(externalLink.getAttribute('target')).toBe('_blank')
    expect(externalLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  // The live page sits in this state whenever the schedule runs dry, so the
  // list has to survive an empty derivation rather than disappear with it.
  it('keeps the list in place when nothing is upcoming', () => {
    stub.upcomingEvents = []

    render(UpcomingEventsSection)

    expect(screen.getByRole('list')).toBeTruthy()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('localizes rows and event-page links for the zh-CN page', () => {
    render(UpcomingEventsSection, { props: { locale: 'zh-CN' } })

    expect(screen.getByText(streamedEvent.title['zh-CN'])).toBeTruthy()
    expect(screen.getByText(streamedEvent.dateLabel['zh-CN'])).toBeTruthy()
    expect(screen.queryByText(streamedEvent.title.en)).toBeNull()

    const streamedLink = screen.getByRole('link', {
      name: `${streamedEvent.title['zh-CN']} — 直播`
    })
    expect(streamedLink.getAttribute('href')).toBe(
      '/zh-CN/events/streamed-event'
    )
  })
})
