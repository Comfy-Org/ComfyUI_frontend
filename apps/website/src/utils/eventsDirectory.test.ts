import { describe, expect, it } from 'vitest'

import type { ComfyEvent } from '../data/events'

import {
  DIRECTORY_FILTER_ALL,
  defaultDirectoryFilters,
  eventDateLabel,
  filterDirectoryEvents
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
  program: 'partner',
  title: { en: 'ComfyUI Buildathon', 'zh-CN': 'ComfyUI 共创马拉松' },
  description: { en: 'Fifty builders, one night.', 'zh-CN': '五十位创作者。' },
  location: { en: 'Paris, France', 'zh-CN': '法国巴黎' }
})

const sanFrancisco = makeEvent({
  id: 'sf',
  category: 'meetup',
  program: 'official',
  title: { en: 'Nodes & Noodles', 'zh-CN': '节点与面条' },
  description: { en: 'Monthly meetup.', 'zh-CN': '每月见面会。' },
  location: { en: 'San Francisco, USA', 'zh-CN': '美国旧金山' }
})

const virtual = makeEvent({
  id: 'virtual',
  category: 'workshop',
  program: 'student',
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

  it('filters by program', () => {
    expect(
      ids(
        filterDirectoryEvents(
          events,
          { ...defaultDirectoryFilters(), program: 'official' },
          'en'
        )
      )
    ).toEqual(['sf'])
  })

  it('drops events with no program when a program is selected', () => {
    const unlabelled = makeEvent({ id: 'unlabelled' })
    expect(
      filterDirectoryEvents(
        [unlabelled],
        { ...defaultDirectoryFilters(), program: 'student' },
        'en'
      )
    ).toEqual([])
  })

  it('composes search, category, and program', () => {
    expect(
      ids(
        filterDirectoryEvents(
          events,
          { query: 'meetup', category: 'meetup', program: 'official' },
          'en'
        )
      )
    ).toEqual(['sf'])
    // Same search, a category that excludes the only match.
    expect(
      filterDirectoryEvents(
        events,
        { query: 'meetup', category: 'hackathon', program: 'official' },
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
            program: DIRECTORY_FILTER_ALL
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
