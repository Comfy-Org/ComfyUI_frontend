import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCollection } from 'astro:content'

import { getGalleryByIds, getVisibleGalleryByLocale, slugOf } from './queries'

vi.mock('astro:content', () => ({
  getCollection: vi.fn()
}))

const getCollectionMock = vi.mocked(getCollection)

interface FixtureEntry {
  id: string
  collection: 'gallery'
  data: {
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
