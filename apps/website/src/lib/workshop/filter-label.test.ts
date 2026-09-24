import { describe, expect, it } from 'vitest'

import { filterLabel } from './filter-label'

describe('filterLabel', () => {
  it.for([
    ['the group itself when it is the only one', ['Use cases'], 'Use cases'],
    [
      'the generic name once a second group exists',
      ['Use cases', 'Output'],
      'Filter'
    ],
    ['the generic name when there is nothing to filter by', [], 'Filter']
  ] as const)('names it after %s', ([, labels, expected]) => {
    expect(
      filterLabel(
        labels.map((label) => ({ label })),
        'Filter'
      )
    ).toBe(expected)
  })
})
