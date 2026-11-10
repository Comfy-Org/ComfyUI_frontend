import { describe, expect, it } from 'vitest'

import { searchChatHistory } from './chatHistorySearch'

interface Row {
  id: string
  title: string
  preview?: string
  workflowName?: string
}

const row = (id: string, rest: Partial<Row> = {}): Row => ({
  id,
  title: `Chat ${id}`,
  ...rest
})

function ids(results: ReturnType<typeof searchChatHistory<Row>>): string[] {
  return (results ?? []).map((r) => r.session.id)
}

describe('searchChatHistory', () => {
  describe('empty query', () => {
    it.for(['', '   ', '\t\n '])('returns null (no filtering) for %j', (q) => {
      expect(searchChatHistory([row('a')], q)).toBeNull()
    })
  })

  describe('single word', () => {
    it('matches a title and reports its range', () => {
      const results = searchChatHistory(
        [row('a', { title: 'Portrait upscale' })],
        'port'
      )
      expect(results).toEqual([
        {
          session: expect.objectContaining({ id: 'a' }),
          matchedFields: ['title'],
          ranges: { title: [{ start: 0, end: 4 }] }
        }
      ])
    })

    it('matches only the preview', () => {
      const results = searchChatHistory(
        [row('a', { title: 'Untitled', preview: 'make a sunset scene' })],
        'sunset'
      )
      expect(results?.[0].matchedFields).toEqual(['preview'])
      expect(results?.[0].ranges).toEqual({ preview: [{ start: 7, end: 13 }] })
    })

    it('matches only the workflow name', () => {
      const results = searchChatHistory(
        [row('a', { title: 'Untitled', workflowName: 'Flux portrait v2' })],
        'portrait'
      )
      expect(results?.[0].matchedFields).toEqual(['workflowName'])
      expect(results?.[0].ranges).toEqual({
        workflowName: [{ start: 5, end: 13 }]
      })
    })

    it('reports every field that matched, in title, preview, workflowName order', () => {
      const results = searchChatHistory(
        [
          row('a', {
            title: 'cat',
            preview: 'a cat photo',
            workflowName: 'cat flow'
          })
        ],
        'cat'
      )
      expect(results?.[0].matchedFields).toEqual([
        'title',
        'preview',
        'workflowName'
      ])
    })

    it('returns every occurrence within a field', () => {
      const results = searchChatHistory([row('a', { title: 'ab ab ab' })], 'ab')
      expect(results?.[0].ranges.title).toEqual([
        { start: 0, end: 2 },
        { start: 3, end: 5 },
        { start: 6, end: 8 }
      ])
    })

    it('excludes non-matching sessions', () => {
      expect(searchChatHistory([row('a')], 'zzz')).toEqual([])
    })
  })

  describe('case and accents', () => {
    it('is case-insensitive in both directions and keeps original indices', () => {
      const results = searchChatHistory(
        [row('a', { title: 'Hello WORLD' })],
        'wOrLd'
      )
      expect(results?.[0].ranges.title).toEqual([{ start: 6, end: 11 }])
    })

    it('does not fold accents', () => {
      expect(searchChatHistory([row('a', { title: 'café' })], 'cafe')).toEqual(
        []
      )
      expect(searchChatHistory([row('a', { title: 'cafe' })], 'café')).toEqual(
        []
      )
    })
  })

  describe('multiple words', () => {
    it('requires every word (AND) and ignores extra whitespace', () => {
      const rows = [
        row('a', { title: 'red car' }),
        row('b', { title: 'red bike' }),
        row('c', { title: 'blue car' })
      ]
      expect(ids(searchChatHistory(rows, '  red   car '))).toEqual(['a'])
    })

    it('lets different words match in different fields', () => {
      const results = searchChatHistory(
        [
          row('a', {
            title: 'Upscale',
            preview: 'portrait of a dog',
            workflowName: 'Flux'
          })
        ],
        'flux portrait'
      )
      expect(ids(results)).toEqual(['a'])
      expect(results?.[0].matchedFields).toEqual(['preview', 'workflowName'])
    })

    it('excludes a session where one word matches nowhere', () => {
      expect(
        searchChatHistory(
          [row('a', { title: 'red', preview: 'car' })],
          'red bike'
        )
      ).toEqual([])
    })

    it('does not count a word as matched via a different word in the same field', () => {
      expect(
        searchChatHistory([row('a', { title: 'red' })], 'red red')
      ).toEqual([expect.objectContaining({ matchedFields: ['title'] })])
    })
  })

  describe('range merging', () => {
    it('merges overlapping ranges from different words', () => {
      const results = searchChatHistory(
        [row('a', { title: 'portrait' })],
        'port rait ortra'
      )
      expect(results?.[0].ranges.title).toEqual([{ start: 0, end: 8 }])
    })

    it('merges adjacent ranges', () => {
      const results = searchChatHistory(
        [row('a', { title: 'foobar' })],
        'foo bar'
      )
      expect(results?.[0].ranges.title).toEqual([{ start: 0, end: 6 }])
    })

    it('keeps separated ranges sorted and distinct', () => {
      const results = searchChatHistory(
        [row('a', { title: 'beta x alpha' })],
        'alpha beta'
      )
      expect(results?.[0].ranges.title).toEqual([
        { start: 0, end: 4 },
        { start: 7, end: 12 }
      ])
    })
  })

  describe('special characters', () => {
    it('treats regex metacharacters literally', () => {
      const rows = [
        row('a', { title: 'fix (bug) v1.2' }),
        row('b', { title: 'fix bug v1x2' })
      ]
      expect(ids(searchChatHistory(rows, '(bug)'))).toEqual(['a'])
      expect(ids(searchChatHistory(rows, '1.2'))).toEqual(['a'])
      expect(ids(searchChatHistory(rows, '.*'))).toEqual([])
      expect(ids(searchChatHistory(rows, '['))).toEqual([])
      expect(ids(searchChatHistory(rows, '\\'))).toEqual([])
    })
  })

  describe('missing fields', () => {
    it('handles missing preview and workflowName', () => {
      const results = searchChatHistory([row('a', { title: 'solo' })], 'solo')
      expect(results?.[0].matchedFields).toEqual(['title'])
      expect(results?.[0].ranges).toEqual({ title: [{ start: 0, end: 4 }] })
    })

    it('handles explicit undefined and empty strings', () => {
      const rows = [
        row('a', { title: '', preview: undefined, workflowName: '' }),
        row('b', { title: 'x', preview: '', workflowName: undefined })
      ]
      expect(searchChatHistory(rows, 'x')?.map((r) => r.session.id)).toEqual([
        'b'
      ])
    })
  })

  describe('order and immutability', () => {
    it('preserves input order and the input object identities', () => {
      const rows = [
        row('c', { title: 'match' }),
        row('a', { title: 'no' }),
        row('b', { title: 'a match' })
      ]
      const results = searchChatHistory(rows, 'match')
      expect(ids(results)).toEqual(['c', 'b'])
      expect(results?.[0].session).toBe(rows[0])
    })

    it('does not mutate inputs', () => {
      const rows = [row('a', { title: 'match', preview: 'p' })]
      const snapshot = structuredClone(rows)
      searchChatHistory(rows, 'match p')
      expect(rows).toEqual(snapshot)
    })
  })
})
