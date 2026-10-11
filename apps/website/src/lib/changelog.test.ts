import { describe, expect, it, vi } from 'vitest'

import {
  fetchChangelog,
  parseChangelog,
  readChangelogCache,
  writeChangelogCache
} from './changelog'

const source =
  '<Update label="v1" description="October 5, 2026">\n**New**\n* [Feature](https://docs.comfy.org)\n</Update>'
const entry = {
  id: 'v1',
  label: 'v1',
  date: 'October 5, 2026',
  markdown: '**New**\n* [Feature](https://docs.comfy.org)'
}

describe('docs changelog boundary', () => {
  it('reads release labels, dates and Markdown in source order', () => {
    expect(parseChangelog(`---\ntitle: Changelog\n---\n${source}`)).toEqual([
      entry
    ])
  })
  it.for([
    ['no description', source.replace(' description="October 5, 2026"', '')],
    ['an empty description', source.replace('October 5, 2026', '')]
  ] as const)('reads a release with %s and no date', ([, input]) => {
    const { date: _date, ...undated } = entry
    expect(parseChangelog(input)).toEqual([undated])
    expect(parseChangelog(input)[0]).not.toHaveProperty('date')
  })
  it('rejects a release without notes', () => {
    expect(() =>
      parseChangelog(
        '<Update label="v1" description="October 5, 2026"> </Update>'
      )
    ).toThrow('Empty update')
  })
  it('gives each release an anchor id derived from its label', () => {
    expect(parseChangelog(source.replace('v1', 'v1.0 Beta'))[0]?.id).toBe(
      'v1-0-beta'
    )
  })
  it.for([
    [
      'description before label',
      `<Update description="October 5, 2026" label="v1">**New**</Update>`
    ],
    [
      'braced optional metadata',
      `<Update tags={['Features']} description='October 5, 2026' rss={{ title: 'Release' }} label='v1'>**New**</Update>`
    ],
    [
      'label text inside a quoted value',
      `<Update tags=" label='fake'" label="v1" description="October 5, 2026">**New**</Update>`
    ]
  ] as const)('reads release metadata with %s', ([, input]) => {
    expect(parseChangelog(input)).toEqual([
      { id: 'v1', label: 'v1', date: 'October 5, 2026', markdown: '**New**' }
    ])
  })
  it.for([
    ['an empty source', ''],
    ['an HTML error page', '<html>Error</html>'],
    ['an unterminated update', source + '<Update label="v2">broken'],
    [
      'a duplicate label',
      source.replace('label="v1"', 'label="v1" label="v2"')
    ],
    ['a braced label', source.replace('label="v1"', 'label={untrusted()}')],
    [
      'an unknown attribute',
      source.replace('label="v1"', 'label="v1" unknown="value"')
    ]
  ] as const)('rejects %s', ([, input]) => {
    expect(() => parseChangelog(input)).toThrow()
  })
  it.for(['v1.0', 'v1-0'])(
    'rejects release v1.0 followed by %s as an ambiguous anchor',
    (label) => {
      const first = source.replace('v1', 'v1.0')
      const second = source.replace('v1', label)
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
    ).toEqual([entry])
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
  it('reads back the cache record it writes', () => {
    const stored = new Map<string, string>()
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value)
    }
    expect(writeChangelogCache(source, storage)).toBe(true)
    expect(readChangelogCache(storage)).toEqual([entry])
  })
  it('reports a cache write the browser refuses', () => {
    expect(
      writeChangelogCache(source, {
        setItem: () => {
          throw new DOMException('full', 'QuotaExceededError')
        }
      })
    ).toBe(false)
  })
  it('requests the docs source past the HTTP cache', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(source))
    expect((await fetchChangelog()).entries[0]?.label).toBe('v1')
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({
      cache: 'no-cache'
    })
  })
  it('abandons a stalled request when its timeout fires', async () => {
    const timeout = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason)
          )
        )
    )
    const request = fetchChangelog()
    timeout.abort(new DOMException('timed out', 'TimeoutError'))
    await expect(request).rejects.toThrow('timed out')
  })
  it('abandons a request when its caller aborts', async () => {
    const caller = new AbortController()
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason)
          )
        )
    )
    const request = fetchChangelog(caller.signal)
    caller.abort(new DOMException('left the page', 'AbortError'))
    await expect(request).rejects.toThrow('left the page')
  })
  it('rejects failed responses', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Unavailable', { status: 503 })
    )
    await expect(fetchChangelog()).rejects.toThrow('503')
  })
})
