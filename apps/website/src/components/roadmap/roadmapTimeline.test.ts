import { describe, expect, it } from 'vitest'

import type { RoadmapArea, RoadmapStage } from '@/content/roadmap.schema'
import {
  areasInUse,
  entriesForLocale,
  shippedEntries,
  upcomingEntries
} from './roadmapTimeline'

function entry(
  id: string,
  stage: RoadmapStage,
  order: number,
  area: RoadmapArea = 'engine'
) {
  return { id, data: { area, stage, order } }
}

const ids = (entries: { id: string }[]) => entries.map((e) => e.id)

describe('entriesForLocale', () => {
  it('keeps only the requested locale', () => {
    const entries = [
      entry('en/a', 'building', 1),
      entry('zh-CN/a', 'building', 1),
      entry('en/b', 'building', 2)
    ]
    expect(ids(entriesForLocale(entries, 'en'))).toEqual(['en/a', 'en/b'])
    expect(ids(entriesForLocale(entries, 'zh-CN'))).toEqual(['zh-CN/a'])
  })

  it('does not let a locale prefix match a longer one', () => {
    // 'zh' would match 'zh-CN/...' on a bare startsWith without the slash.
    const entries = [entry('zh-CN/a', 'building', 1)]
    expect(entriesForLocale(entries, 'en')).toEqual([])
  })
})

describe('shippedEntries', () => {
  it('keeps only shipped, ordered by `order`', () => {
    const entries = [
      entry('en/c', 'shipped', 3),
      entry('en/a', 'shipped', 1),
      entry('en/x', 'building', 1),
      entry('en/b', 'shipped', 2)
    ]
    expect(ids(shippedEntries(entries))).toEqual(['en/a', 'en/b', 'en/c'])
  })

  it('does not mutate the input', () => {
    const entries = [entry('en/b', 'shipped', 2), entry('en/a', 'shipped', 1)]
    shippedEntries(entries)
    expect(ids(entries)).toEqual(['en/b', 'en/a'])
  })
})

describe('upcomingEntries', () => {
  it('orders shipping, then building, then exploring', () => {
    const entries = [
      entry('en/exploring', 'exploring', 1),
      entry('en/building', 'building', 1),
      entry('en/shipping', 'shipping', 1)
    ]
    expect(ids(upcomingEntries(entries))).toEqual([
      'en/shipping',
      'en/building',
      'en/exploring'
    ])
  })

  it('breaks ties within a stage by `order`', () => {
    const entries = [
      entry('en/second', 'building', 2),
      entry('en/first', 'building', 1)
    ]
    expect(ids(upcomingEntries(entries))).toEqual(['en/first', 'en/second'])
  })

  it('excludes shipped entries', () => {
    const entries = [
      entry('en/out', 'shipped', 1),
      entry('en/in', 'building', 1)
    ]
    expect(ids(upcomingEntries(entries))).toEqual(['en/in'])
  })
})

describe('areasInUse', () => {
  it('returns areas in page order, not entry order', () => {
    const entries = [
      entry('en/a', 'building', 1, 'community'),
      entry('en/b', 'building', 2, 'engine'),
      entry('en/c', 'building', 3, 'cloud')
    ]
    expect(areasInUse(entries)).toEqual(['engine', 'cloud', 'community'])
  })

  it('drops areas with no entries and does not repeat one', () => {
    const entries = [
      entry('en/a', 'building', 1, 'engine'),
      entry('en/b', 'building', 2, 'engine')
    ]
    expect(areasInUse(entries)).toEqual(['engine'])
  })
})
