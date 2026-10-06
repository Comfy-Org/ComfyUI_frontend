import { describe, expect, it } from 'vitest'

import { filterByQuery, sortByText } from './tableUtils'

const rows = [
  { id: 'open', label: 'Open workflow' },
  { id: 'save', label: 'Save workflow' },
  { id: 'close', label: 'Close workflow' }
]

describe('table state utilities', () => {
  it.for([
    { query: '  WORK  ', expected: ['open', 'save', 'close'] },
    { query: 'open', expected: ['open'] },
    { query: 'save save', expected: [] }
  ])(
    'matches "$query" against each field without case or surrounding whitespace',
    ({ query, expected }) => {
      expect(
        filterByQuery(rows, query, (row) => [row.id, row.label]).map(
          (row) => row.id
        )
      ).toEqual(expected)
    }
  )

  it('sorts text in either direction without mutating the source rows', () => {
    expect(sortByText(rows, 'ascending', (row) => row.label)).toEqual([
      rows[2],
      rows[0],
      rows[1]
    ])
    expect(sortByText(rows, 'descending', (row) => row.label)).toEqual([
      rows[1],
      rows[0],
      rows[2]
    ])
    expect(rows.map((row) => row.id)).toEqual(['open', 'save', 'close'])
  })

  it('keeps source order without a sort direction', () => {
    expect(sortByText(rows, null, (row) => row.label)).toEqual(rows)
  })
})
