import { describe, expect, it, vi } from 'vitest'

import {
  CHANGELOG_CACHE_MAX_AGE_MS,
  fetchChangelog,
  parseChangelog,
  readChangelogCache
} from './changelog'

const source =
  '<Update label="v1" description="October 5, 2026">\n**New**\n* [Feature](https://docs.comfy.org)\n</Update>'

describe('docs changelog boundary', () => {
  it('reads release labels, dates and Markdown in source order', () => {
    expect(parseChangelog(`---\ntitle: Changelog\n---\n${source}`)).toEqual([
      {
        label: 'v1',
        date: 'October 5, 2026',
        markdown: '**New**\n* [Feature](https://docs.comfy.org)'
      }
    ])
  })
  it.for([
    '',
    '<html>Error</html>',
    source + '<Update label="v2">broken',
    source.replace('October 5, 2026', '')
  ])('rejects unavailable or changed source formats', (input) => {
    expect(() => parseChangelog(input)).toThrow()
  })
  it('keeps only a validated recent cache', () => {
    const cache = (value: unknown) => ({ getItem: () => JSON.stringify(value) })
    expect(
      readChangelogCache(cache({ source, checkedAt: Date.now() }))
    ).toBeDefined()
    expect(
      readChangelogCache(
        cache({
          source,
          checkedAt: Date.now() - CHANGELOG_CACHE_MAX_AGE_MS - 1
        })
      )
    ).toBeUndefined()
    expect(
      readChangelogCache(cache({ source: 'broken', checkedAt: Date.now() }))
    ).toBeUndefined()
    expect(
      readChangelogCache(cache({ source, checkedAt: Date.now() + 10000 }))
    ).toBeUndefined()
    expect(
      readChangelogCache({
        getItem: () => {
          throw new Error('disabled')
        }
      })
    ).toBeUndefined()
  })
  it('revalidates and reflects changed source without a rebuild', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(source))
      .mockResolvedValueOnce(new Response(source.replace('v1', 'v2')))
    vi.stubGlobal('fetch', fetcher)
    expect((await fetchChangelog()).entries[0]?.label).toBe('v1')
    expect((await fetchChangelog()).entries[0]?.label).toBe('v2')
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-cache' })
  })
  it('rejects failed responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Unavailable', { status: 503 }))
    )
    await expect(fetchChangelog()).rejects.toThrow('503')
  })
})
