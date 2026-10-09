import { describe, expect, it } from 'vitest'

import { isFuture, kindCounts, matchesListing, previewChanges } from './format'

describe('admin listings', () => {
  it.for([
    { filter: 'ALL', query: '', kind: 'MODEL', expected: true },
    { filter: 'WORKFLOW', query: '', kind: 'MODEL', expected: false },
    { filter: 'ALL', query: ' wan ', kind: 'MODEL', expected: true },
    { filter: 'ALL', query: 'kling', kind: 'MODEL', expected: false }
  ] as const)(
    'filter $filter with "$query" matches a $kind: $expected',
    ({ filter, query, kind, expected }) => {
      expect(matchesListing(filter, query, kind, ['Wan 3.0', undefined])).toBe(
        expected
      )
    }
  )

  it('counts every kind, including empty ones', () => {
    expect(kindCounts(['MODEL', 'MODEL', 'APP'])).toEqual({
      ALL: 3,
      MODEL: 2,
      WORKFLOW: 0,
      APP: 1
    })
  })

  it.for([
    ['2026-10-20T16:00:00Z', true],
    ['2026-01-01T00:00:00Z', false],
    [undefined, false]
  ] as const)('treats %s as future: %s', ([value, expected]) => {
    expect(isFuture(value, Date.parse('2026-10-09T12:00:00Z'))).toBe(expected)
  })
})

describe('preview changes list', () => {
  it('sends hidden launches to their time and the rest to their page', () => {
    const changes = previewChanges(
      [
        {
          id: 'wan',
          title: 'Wan',
          change: 'new',
          slug: '/hub/models/wan',
          visibleFrom: '2026-10-20T16:00:00Z'
        },
        {
          id: 'kling',
          title: 'Kling',
          change: 'updated',
          slug: '/hub/models/kling'
        }
      ],
      Date.parse('2026-10-09T12:00:00Z'),
      (at) => `at ${at}`
    )
    expect(changes).toEqual([
      {
        id: 'wan',
        title: 'Wan',
        change: 'new',
        page: '/hub/models/wan/',
        detail: 'at 2026-10-20T16:00:00Z',
        launch: '2026-10-20T16:00:00Z'
      },
      {
        id: 'kling',
        title: 'Kling',
        change: 'updated',
        page: '/hub/models/kling/',
        detail: '/hub/models/kling',
        launch: undefined
      }
    ])
  })
})
