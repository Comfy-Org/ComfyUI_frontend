import { describe, expect, it } from 'vitest'

import { filterByQuery, sortByText } from './tableUtils'

const rows = [
  { id: 'save', label: 'Save workflow' },
  { id: 'open', label: 'Open workflow' },
  { id: 'close', label: 'Close workflow' }
]

describe('table state utilities', () => {
  it('filters text without case or surrounding whitespace', () => {
    expect(
      filterByQuery(rows, '  WORK  ', (row) => `${row.id} ${row.label}`)
    ).toEqual(rows)
    expect(filterByQuery(rows, 'open', (row) => row.label)).toEqual([rows[1]])
  })

  it('sorts text in either direction without mutating the source rows', () => {
    expect(sortByText(rows, 'ascending', (row) => row.label)).toEqual([
      rows[2],
      rows[1],
      rows[0]
    ])
    expect(sortByText(rows, 'descending', (row) => row.label)).toEqual([
      rows[0],
      rows[1],
      rows[2]
    ])
    expect(rows[0]?.id).toBe('save')
  })
})
