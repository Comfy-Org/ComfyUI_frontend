import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCollection } from 'astro:content'

import {
  getEventsByLocale,
  getGalleryByIds,
  getTutorialsByLocale,
  getVisibleGalleryByLocale,
  slugOf
} from './queries'

vi.mock('astro:content', () => ({
  getCollection: vi.fn()
}))

const getCollectionMock = vi.mocked(getCollection)

interface FixtureEntry {
  id: string
  collection: 'gallery'
  data: {
    order: number
    title: string
    userAlias: string
    teamAlias: string
    tool: string
    image?: string
    video?: string
    href?: string
    objectPosition?: string
    objectFit?: string
    visible: boolean
  }
}

function entry(
  id: string,
  overrides: Partial<FixtureEntry['data']> = {}
): FixtureEntry {
  return {
    id,
    collection: 'gallery',
    data: {
      order: 0,
      title: 'Title',
      userAlias: 'User',
      teamAlias: 'Team',
      tool: 'ComfyUI',
      visible: true,
      ...overrides
    }
  }
}

beforeEach(() => {
  getCollectionMock.mockReset()
})

describe('slugOf', () => {
  it('strips the locale prefix from an entry id', () => {
    const entry = { id: 'en/until-our-eye-interlink-harajuku' }
    expect(slugOf(entry)).toBe('until-our-eye-interlink-harajuku')
  })

  it('handles zh-CN prefix', () => {
    const entry = { id: 'zh-CN/desert-landing' }
    expect(slugOf(entry)).toBe('desert-landing')
  })
})

describe('getVisibleGalleryByLocale', () => {
  it('returns only entries whose id starts with the requested locale prefix', async () => {
    getCollectionMock.mockResolvedValue([
      entry('en/alpha'),
      entry('en/beta'),
      entry('zh-CN/alpha'),
      entry('zh-CN/gamma')
    ] as never)

    const en = await getVisibleGalleryByLocale('en')
    expect(en.map((e) => e.id)).toEqual(['en/alpha', 'en/beta'])

    const zh = await getVisibleGalleryByLocale('zh-CN')
    expect(zh.map((e) => e.id)).toEqual(['zh-CN/alpha', 'zh-CN/gamma'])
  })

  it('excludes entries with visible: false', async () => {
    getCollectionMock.mockResolvedValue([
      entry('en/shown', { visible: true }),
      entry('en/hidden', { visible: false }),
      entry('en/also-shown', { visible: true })
    ] as never)

    const result = await getVisibleGalleryByLocale('en')
    expect(result.map((e) => e.id)).toEqual(['en/shown', 'en/also-shown'])
  })

  it('sorts entries by the order field ascending, not by id', async () => {
    getCollectionMock.mockResolvedValue([
      entry('en/charlie', { order: 1 }),
      entry('en/alpha', { order: 3 }),
      entry('en/bravo', { order: 2 })
    ] as never)

    const result = await getVisibleGalleryByLocale('en')
    expect(result.map((e) => e.id)).toEqual([
      'en/charlie',
      'en/bravo',
      'en/alpha'
    ])
  })
})

describe('getGalleryByIds', () => {
  it('returns entries in the order of the input slug array', async () => {
    getCollectionMock.mockResolvedValue([
      entry('en/alpha'),
      entry('en/beta'),
      entry('en/gamma'),
      entry('zh-CN/alpha')
    ] as never)

    const result = await getGalleryByIds(['gamma', 'alpha', 'beta'], 'en')
    expect(result.map((e) => e.id)).toEqual(['en/gamma', 'en/alpha', 'en/beta'])
  })

  it('drops slugs with no matching entry in the requested locale', async () => {
    getCollectionMock.mockResolvedValue([
      entry('en/alpha'),
      entry('zh-CN/beta')
    ] as never)

    const result = await getGalleryByIds(['alpha', 'missing', 'beta'], 'en')
    expect(result.map((e) => e.id)).toEqual(['en/alpha'])
  })
})

interface EventsFixtureEntry {
  id: string
  collection: 'events'
  data: {
    order: number
    label: string
    title: string
    cta: string
    href: string
  }
}

function eventEntry(
  id: string,
  overrides: Partial<EventsFixtureEntry['data']> = {}
): EventsFixtureEntry {
  return {
    id,
    collection: 'events',
    data: {
      order: 0,
      label: 'Label',
      title: 'Title',
      cta: 'CTA',
      href: '#',
      ...overrides
    }
  }
}

describe('getEventsByLocale', () => {
  it('returns only entries whose id starts with the requested locale prefix', async () => {
    getCollectionMock.mockResolvedValue([
      eventEntry('en/alpha'),
      eventEntry('en/beta'),
      eventEntry('zh-CN/alpha')
    ] as never)

    const en = await getEventsByLocale('en')
    expect(en.map((e) => e.id)).toEqual(['en/alpha', 'en/beta'])
  })

  it('sorts entries by the order field ascending, not by id', async () => {
    getCollectionMock.mockResolvedValue([
      eventEntry('en/charlie', { order: 1 }),
      eventEntry('en/alpha', { order: 3 }),
      eventEntry('en/bravo', { order: 2 })
    ] as never)

    const result = await getEventsByLocale('en')
    expect(result.map((e) => e.id)).toEqual([
      'en/charlie',
      'en/bravo',
      'en/alpha'
    ])
  })

  it('returns an empty array for a locale with no entries', async () => {
    getCollectionMock.mockResolvedValue([
      eventEntry('en/alpha'),
      eventEntry('en/beta')
    ] as never)

    const result = await getEventsByLocale('zh-CN')
    expect(result).toEqual([])
  })
})

interface TutorialsFixtureEntry {
  id: string
  collection: 'tutorials'
  data: {
    order: number
    tags: string[]
    title: string
    videoSrc: string
    href?: string
    poster?: string
    posterTime?: number
  }
}

function tutorialEntry(
  id: string,
  overrides: Partial<TutorialsFixtureEntry['data']> = {}
): TutorialsFixtureEntry {
  return {
    id,
    collection: 'tutorials',
    data: {
      order: 0,
      tags: ['Tag'],
      title: 'Title',
      videoSrc: 'https://example.com/video.mp4',
      ...overrides
    }
  }
}

describe('getTutorialsByLocale', () => {
  it('returns only entries whose id starts with the requested locale prefix', async () => {
    getCollectionMock.mockResolvedValue([
      tutorialEntry('en/alpha'),
      tutorialEntry('en/beta'),
      tutorialEntry('zh-CN/alpha')
    ] as never)

    const en = await getTutorialsByLocale('en')
    expect(en.map((e) => e.id)).toEqual(['en/alpha', 'en/beta'])
  })

  it('sorts entries by the order field ascending, not by id', async () => {
    getCollectionMock.mockResolvedValue([
      tutorialEntry('en/charlie', { order: 1 }),
      tutorialEntry('en/alpha', { order: 3 }),
      tutorialEntry('en/bravo', { order: 2 })
    ] as never)

    const result = await getTutorialsByLocale('en')
    expect(result.map((e) => e.id)).toEqual([
      'en/charlie',
      'en/bravo',
      'en/alpha'
    ])
  })
})
