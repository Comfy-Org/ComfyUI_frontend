import { describe, expect, it, vi } from 'vitest'

import { fetchChangelog, parseChangelog, readChangelogCache } from './changelog'

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
    `<Update description="October 5, 2026" label="v1">**New**</Update>`,
    `<Update tags={['Features']} description='October 5, 2026' rss={{ title: 'Release' }} label='v1'>**New**</Update>`,
    `<Update tags=" label='fake'" label="v1" description="October 5, 2026">**New**</Update>`
  ])('reads reordered and inert optional release metadata', (input) => {
    expect(parseChangelog(input)).toEqual([
      { label: 'v1', date: 'October 5, 2026', markdown: '**New**' }
    ])
  })
  it.for([
    '',
    '<html>Error</html>',
    source + '<Update label="v2">broken',
    source.replace('October 5, 2026', ''),
    source.replace('label="v1"', 'label="v1" label="v2"'),
    source.replace('label="v1"', 'label={untrusted()}'),
    source.replace('label="v1"', 'label="v1" unknown="value"')
  ])('rejects unavailable or changed source formats', (input) => {
    expect(() => parseChangelog(input)).toThrow()
  })
  it.for(['v1', 'v1-0'])(
    'rejects repeated or colliding release anchors (%s)',
    (label) => {
      const first = source.replace('v1', 'v1.0')
      const second = source.replace('v1', label === 'v1' ? 'v1.0' : label)
      expect(() => parseChangelog(first + second)).toThrow(
        'Ambiguous release label'
      )
    }
  )
  it('keeps a validated six-day-old cache', () => {
    const checkedAt = Date.now() - 518_400_000
    expect(
      readChangelogCache({
        getItem: () => JSON.stringify({ source, checkedAt })
      })
    ).toEqual({
      entries: [
        {
          label: 'v1',
          date: 'October 5, 2026',
          markdown: '**New**\n* [Feature](https://docs.comfy.org)'
        }
      ],
      checkedAt
    })
  })
  it.for([
    ['expired', () => ({ source, checkedAt: Date.now() - 604_800_001 })],
    ['invalid source', () => ({ source: 'broken', checkedAt: Date.now() })],
    ['future timestamp', () => ({ source, checkedAt: Date.now() + 10000 })]
  ] as const)('rejects a cache with %s', ([, value]) => {
    expect(
      readChangelogCache({ getItem: () => JSON.stringify(value()) })
    ).toBeUndefined()
  })
  it('handles disabled storage', () => {
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
