import { describe, expect, it } from 'vitest'

import { isUrlUnderPath, previousEntryUrl } from './previousEntry'

function nav(
  index: number | null,
  urls: (string | undefined)[]
): NonNullable<Parameters<typeof previousEntryUrl>[0]> {
  return {
    currentEntry: index === null ? null : { index },
    entries: () => urls.map((url) => ({ url }))
  }
}

describe('previousEntryUrl', () => {
  it('returns the entry before the current one', () => {
    expect(
      previousEntryUrl(
        nav(1, ['https://a.test/events', 'https://a.test/events/x']),
        ''
      )
    ).toBe('https://a.test/events')
  })

  it('falls back to the referrer when there is no Navigation API', () => {
    expect(previousEntryUrl(undefined, 'https://a.test/events')).toBe(
      'https://a.test/events'
    )
  })

  it('falls back to the referrer when currentEntry is null', () => {
    expect(previousEntryUrl(nav(null, []), 'https://a.test/events')).toBe(
      'https://a.test/events'
    )
  })

  it('falls back to the referrer at the first Navigation API entry', () => {
    expect(
      previousEntryUrl(
        nav(0, ['https://a.test/events/x']),
        'https://a.test/events'
      )
    ).toBe('https://a.test/events')
  })

  it('returns null at the first entry, where there is no previous', () => {
    expect(previousEntryUrl(nav(0, ['https://a.test/events/x']), '')).toBeNull()
  })

  it('returns null when neither source has a value', () => {
    expect(previousEntryUrl(undefined, '')).toBeNull()
  })
})

describe('isUrlUnderPath', () => {
  it('accepts a same-origin url under the prefix', () => {
    expect(
      isUrlUnderPath('https://a.test/events/x', 'https://a.test', '/events')
    ).toBe(true)
  })

  it('accepts the prefix itself', () => {
    expect(
      isUrlUnderPath('https://a.test/events', 'https://a.test', '/events')
    ).toBe(true)
  })

  it.for([
    { label: 'null', url: null },
    { label: 'a different origin', url: 'https://b.test/events' },
    { label: 'a different path', url: 'https://a.test/blog' },
    {
      label: 'a sibling path sharing the prefix',
      url: 'https://a.test/events-archive'
    },
    { label: 'an unparseable url', url: 'not a url' }
  ])('rejects $label', ({ url }) => {
    expect(isUrlUnderPath(url, 'https://a.test', '/events')).toBe(false)
  })
})
