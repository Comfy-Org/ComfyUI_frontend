import { describe, expect, it } from 'vitest'

import { filterByQuery, sortByText } from './tableUtils'

const rows = [
  { id: 'open', label: 'Open workflow' },
  { id: 'save', label: 'Save workflow' },
  { id: 'close', label: 'Close workflow' }
] as const

describe('table state utilities', () => {
  it.for([
    { query: '  WORK  ', expected: ['open', 'save', 'close'] },
    { query: 'open', expected: ['open'] },
    { query: 'save save', expected: [] },
    { query: 'creer', expected: ['create'] },
    { query: 'CRÉER', expected: ['create'] }
  ])(
    'matches "$query" against each field without case, accents or surrounding whitespace',
    ({ query, expected }) => {
      expect(
        filterByQuery(
          [...rows, { id: 'create', label: 'Créer un nœud' }],
          query,
          (row) => [row.id, row.label]
        ).map((row) => row.id)
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

  it('sorts embedded numbers numerically', () => {
    expect(
      sortByText(['Node10', 'Node2', 'Node1'], 'ascending', (name) => name)
    ).toEqual(['Node1', 'Node2', 'Node10'])
  })

  it('keeps source order without a sort direction', () => {
    expect(sortByText(rows, null, (row) => row.label)).toEqual(rows)
  })
})
