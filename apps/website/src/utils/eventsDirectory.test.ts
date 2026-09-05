import { describe, expect, it } from 'vitest'

import type { ComfyEvent } from '../data/events'

import {
  DIRECTORY_FILTER_ALL,
  defaultDirectoryFilters,
  directoryRows,
  eventDateLabel,
  filterDirectoryEvents,
  groupRowsByMonth,
  monthLabel
} from './eventsDirectory'

function makeEvent(
  overrides: Partial<ComfyEvent> & { id: string }
): ComfyEvent {
  return {
    category: 'meetup',
    title: { en: 'Untitled', 'zh-CN': '未命名' },
    description: { en: 'A description.', 'zh-CN': '描述。' },
    startDateTime: '2026-09-01T18:00:00-07:00',
    ...overrides
  }
}

const paris = makeEvent({
  id: 'paris',
  category: 'hackathon',
  organizer: 'partner',
  title: { en: 'ComfyUI Hack Night', 'zh-CN': 'ComfyUI 黑客之夜' },
  description: { en: 'Fifty builders, one night.', 'zh-CN': '五十位创作者。' },
  location: { en: 'Paris, France', 'zh-CN': '法国巴黎' }
})

const sanFrancisco = makeEvent({
  id: 'sf',
  category: 'meetup',
  organizer: 'comfy',
  title: { en: 'Nodes & Noodles', 'zh-CN': '节点与面条' },
  description: { en: 'Monthly meetup.', 'zh-CN': '每月见面会。' },
  location: { en: 'San Francisco, USA', 'zh-CN': '美国旧金山' }
})

const virtual = makeEvent({
  id: 'virtual',
  category: 'workshop',
  organizer: 'community',
  title: { en: 'Build Your First Custom Node', 'zh-CN': '构建你的第一个节点' },
  description: { en: 'From empty folder to node.', 'zh-CN': '从空文件夹开始。' }
})

const events = [paris, sanFrancisco, virtual]
const ids = (result: ComfyEvent[]) => result.map((event) => event.id)

describe('filterDirectoryEvents', () => {
  it('passes every event through the default filters', () => {
    expect(
      ids(filterDirectoryEvents(events, defaultDirectoryFilters(), 'en'))
    ).toEqual(['paris', 'sf', 'virtual'])
  })

  it('preserves the order it was given', () => {
    const reversed = [...events].reverse()
    expect(
      ids(filterDirectoryEvents(reversed, defaultDirectoryFilters(), 'en'))
    ).toEqual(['virtual', 'sf', 'paris'])
  })

  it('matches the query against title, description, and location', () => {
    const search = (query: string) =>
      ids(
        filterDirectoryEvents(
          events,
          { ...defaultDirectoryFilters(), query },
          'en'
        )
      )
    expect(search('noodles')).toEqual(['sf'])
    expect(search('Paris')).toEqual(['paris'])
    expect(search('fifty builders')).toEqual(['paris'])
  })

  it('ignores case and surrounding whitespace in the query', () => {
    expect(
      ids(
        filterDirectoryEvents(
          events,
          { ...defaultDirectoryFilters(), query: '  PARIS  ' },
          'en'
        )
      )
    ).toEqual(['paris'])
  })

  it('searches the active locale, not the other one', () => {
    const filters = { ...defaultDirectoryFilters(), query: '法国巴黎' }
    expect(ids(filterDirectoryEvents(events, filters, 'zh-CN'))).toEqual([
      'paris'
    ])
    expect(filterDirectoryEvents(events, filters, 'en')).toEqual([])
  })

  it('filters by category', () => {
    expect(
      ids(
        filterDirectoryEvents(
          events,
          { ...defaultDirectoryFilters(), category: 'workshop' },
          'en'
        )
      )
    ).toEqual(['virtual'])
  })

  it('filters by organizer', () => {
    expect(
      ids(
        filterDirectoryEvents(
          events,
          { ...defaultDirectoryFilters(), organizer: 'comfy' },
          'en'
        )
      )
    ).toEqual(['sf'])
  })

  it('drops events with no organizer when an organizer is selected', () => {
    const unlabelled = makeEvent({ id: 'unlabelled' })
    expect(
      filterDirectoryEvents(
        [unlabelled],
        { ...defaultDirectoryFilters(), organizer: 'community' },
        'en'
      )
    ).toEqual([])
  })

  it('composes search, category, and organizer', () => {
    expect(
      ids(
        filterDirectoryEvents(
          events,
          { query: 'meetup', category: 'meetup', organizer: 'comfy' },
          'en'
        )
      )
    ).toEqual(['sf'])
    // Same search, a category that excludes the only match.
    expect(
      filterDirectoryEvents(
        events,
        { query: 'meetup', category: 'hackathon', organizer: 'comfy' },
        'en'
      )
    ).toEqual([])
  })

  it('treats the ALL sentinel as no constraint', () => {
    expect(
      ids(
        filterDirectoryEvents(
          events,
          {
            query: '',
            category: DIRECTORY_FILTER_ALL,
            organizer: DIRECTORY_FILTER_ALL
          },
          'en'
        )
      )
    ).toEqual(['paris', 'sf', 'virtual'])
  })
})

describe('eventDateLabel', () => {
  it('prefers the hand-written label', () => {
    const event = makeEvent({
      id: 'written',
      dateLabel: { en: 'August 26, 2026 · 6–9 PM PT', 'zh-CN': '2026年8月26日' }
    })
    expect(eventDateLabel(event, 'en')).toBe('August 26, 2026 · 6–9 PM PT')
    expect(eventDateLabel(event, 'zh-CN')).toBe('2026年8月26日')
  })

  it('formats the start date in the offset the event was written in', () => {
    // 18:00-07:00 is the next day in UTC; the label must stay on the 26th.
    const event = makeEvent({
      id: 'evening',
      startDateTime: '2026-08-26T18:00:00-07:00'
    })
    expect(eventDateLabel(event, 'en')).toBe('Aug 26, 2026')
  })

  it('formats a UTC instant', () => {
    const event = makeEvent({
      id: 'utc',
      startDateTime: '2026-08-26T09:00:00Z'
    })
    expect(eventDateLabel(event, 'en')).toBe('Aug 26, 2026')
  })

  it('localizes the fallback', () => {
    const event = makeEvent({
      id: 'zh',
      startDateTime: '2026-08-26T09:00:00Z'
    })
    expect(eventDateLabel(event, 'zh-CN')).toBe('2026年8月26日')
  })
})

describe('directoryRows', () => {
  const past = new Date('2027-01-01T00:00:00Z')
  const future = new Date('2020-01-01T00:00:00Z')

  it('offers the calendar menu on upcoming events and no watch link', () => {
    const [row] = directoryRows([paris], 'en', future)
    expect(row.calendar).toBeDefined()
    expect(row.calendar?.title).toBe('ComfyUI Hack Night')
    expect(row.watch).toBeUndefined()
  })

  it('sends a past event with a recording to its own page', () => {
    const recorded = makeEvent({ id: 'recorded', recordingVideoId: 'abc123' })
    const [row] = directoryRows([recorded], 'en', past)
    expect(row.calendar).toBeUndefined()
    expect(row.watch).toEqual({ href: '/events/recorded', newTab: false })
  })

  it('localizes the page link for a past recording', () => {
    const recorded = makeEvent({ id: 'recorded', recordingVideoId: 'abc123' })
    const [row] = directoryRows([recorded], 'zh-CN', past)
    expect(row.watch?.href).toBe('/zh-CN/events/recorded')
  })

  it('sends a past event without a recording to its external link', () => {
    const external = makeEvent({
      id: 'external',
      link: {
        href: {
          en: 'https://example.com/en',
          'zh-CN': 'https://example.com/zh'
        },
        newTab: true
      }
    })
    const [row] = directoryRows([external], 'zh-CN', past)
    expect(row.watch).toEqual({
      href: 'https://example.com/zh',
      newTab: true
    })
  })

  it('gives a past event with neither recording nor link no CTA at all', () => {
    const [row] = directoryRows([paris], 'en', past)
    expect(row.calendar).toBeUndefined()
    expect(row.watch).toBeUndefined()
  })

  it('falls back to the carousel art when an event has no card media', () => {
    const featuredOnly = makeEvent({
      id: 'featured-only',
      featured: {
        order: 0,
        media: {
          type: 'image',
          src: 'carousel.avif',
          alt: { en: 'Carousel art', 'zh-CN': '轮播图' }
        }
      }
    })
    const [row] = directoryRows([featuredOnly], 'en', past)
    expect(row.media).toEqual({
      src: 'carousel.avif',
      alt: 'Carousel art',
      poster: undefined,
      isVideo: false
    })
  })

  it('marks video media and carries its poster', () => {
    const video = makeEvent({
      id: 'video',
      media: {
        type: 'video',
        src: 'clip.mp4',
        alt: { en: 'Clip', 'zh-CN': '片段' },
        poster: 'clip.avif'
      }
    })
    const [row] = directoryRows([video], 'en', past)
    expect(row.media).toEqual({
      src: 'clip.mp4',
      alt: 'Clip',
      poster: 'clip.avif',
      isVideo: true
    })
  })

  it('leaves media undefined when the event has none', () => {
    expect(directoryRows([paris], 'en', past)[0].media).toBeUndefined()
  })

  it('labels an event with no location as virtual', () => {
    const [row] = directoryRows([virtual], 'en', past)
    expect(row.location).toBe('Virtual event')
  })

  it('localizes the category and the location', () => {
    const [row] = directoryRows([paris], 'zh-CN', past)
    expect(row.category).toBe('黑客松')
    expect(row.location).toBe('法国巴黎')
  })

  it('preserves the order it was given', () => {
    expect(
      directoryRows(events, 'en', past).map((row) => row.event.id)
    ).toEqual(['paris', 'sf', 'virtual'])
  })
})

describe('groupRowsByMonth', () => {
  // Fixed clock: mid-September 2026. August is past, September straddles,
  // October is ahead.
  const NOW = new Date('2026-09-15T12:00:00Z')

  const at = (id: string, startDateTime: string) =>
    makeEvent({ id, startDateTime })

  const group = (events: ReturnType<typeof at>[]) =>
    groupRowsByMonth(directoryRows(events, 'en', NOW))

  it('returns nothing for no rows', () => {
    expect(groupRowsByMonth([])).toEqual([])
  })

  it('buckets events into their calendar month', () => {
    const months = group([
      at('oct-1', '2026-10-01T10:00:00Z'),
      at('oct-2', '2026-10-20T10:00:00Z'),
      at('nov', '2026-11-03T10:00:00Z')
    ])
    expect(months.map((month) => month.key)).toEqual(['2026-10', '2026-11'])
    expect(months[0].rows.map((row) => row.event.id)).toEqual([
      'oct-1',
      'oct-2'
    ])
  })

  it('skips months with no events rather than filling gaps', () => {
    const months = group([
      at('sep', '2026-09-20T10:00:00Z'),
      at('dec', '2026-12-01T10:00:00Z')
    ])
    expect(months.map((month) => month.key)).toEqual(['2026-09', '2026-12'])
  })

  it('puts upcoming months ascending ahead of past months descending', () => {
    const months = group([
      at('july', '2026-07-10T10:00:00Z'),
      at('nov', '2026-11-10T10:00:00Z'),
      at('june', '2026-06-10T10:00:00Z'),
      at('oct', '2026-10-10T10:00:00Z')
    ])
    expect(months.map((month) => month.key)).toEqual([
      '2026-10',
      '2026-11',
      '2026-07',
      '2026-06'
    ])
  })

  it('counts a straddling month as upcoming and sorts it ascending', () => {
    // September holds one event that has passed and two still ahead.
    const months = group([
      at('sep-late', '2026-09-28T10:00:00Z'),
      at('sep-past', '2026-09-02T10:00:00Z'),
      at('sep-soon', '2026-09-20T10:00:00Z')
    ])
    expect(months).toHaveLength(1)
    expect(months[0].upcoming).toBe(true)
    expect(months[0].rows.map((row) => row.event.id)).toEqual([
      'sep-past',
      'sep-soon',
      'sep-late'
    ])
  })

  it('orders a fully past month newest first', () => {
    const months = group([
      at('aug-early', '2026-08-02T10:00:00Z'),
      at('aug-late', '2026-08-27T10:00:00Z')
    ])
    expect(months[0].upcoming).toBe(false)
    expect(months[0].rows.map((row) => row.event.id)).toEqual([
      'aug-late',
      'aug-early'
    ])
  })

  it('keeps a late-evening event in its own month, not the next one in UTC', () => {
    // 23:30-07:00 on Sep 30 is Oct 1 in UTC; the agenda must still say
    // September, matching the date the row displays.
    const months = group([at('boundary', '2026-09-30T23:30:00-07:00')])
    expect(months[0].key).toBe('2026-09')
    expect(eventDateLabel(months[0].rows[0].event, 'en')).toBe('Sep 30, 2026')
  })

  it('keeps an early-morning event east of UTC in its own month', () => {
    // 00:30+09:00 on Oct 1 is Sep 30 in UTC; the agenda must say October.
    const months = group([at('boundary', '2026-10-01T00:30:00+09:00')])
    expect(months[0].key).toBe('2026-10')
  })
})

describe('monthLabel', () => {
  it('names the month in the page locale without an i18n key', () => {
    expect(monthLabel('2026-10', 'en')).toBe('October 2026')
    expect(monthLabel('2026-10', 'zh-CN')).toBe('2026年10月')
  })
})
