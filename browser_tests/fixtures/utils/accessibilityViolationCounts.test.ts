import { describe, expect, it } from 'vitest'

import { compareViolationCounts } from '@e2e/fixtures/utils/accessibilityViolationCounts'

type ElementCounts = Parameters<typeof compareViolationCounts>[0]

interface ComparisonCase extends ReturnType<typeof compareViolationCounts> {
  name: string
  known: ElementCounts
  found: ElementCounts
}

describe('compareViolationCounts', () => {
  it.for<ComparisonCase>([
    {
      name: 'accepts a rule that fails on exactly its known count',
      known: { 'color-contrast': 2 },
      found: { 'color-contrast': 2 },
      exceeded: [],
      reduced: []
    },
    {
      name: 'rejects a known rule that fails on more elements',
      known: { 'color-contrast': 2 },
      found: { 'color-contrast': 3 },
      exceeded: [
        { rule: 'color-contrast', knownElements: 2, foundElements: 3 }
      ],
      reduced: []
    },
    {
      name: 'rejects a known rule that fails on fewer elements',
      known: { 'color-contrast': 3 },
      found: { 'color-contrast': 1 },
      exceeded: [],
      reduced: [{ rule: 'color-contrast', knownElements: 3, foundElements: 1 }]
    },
    {
      name: 'rejects a known rule that no longer fails',
      known: { 'image-alt': 1 },
      found: {},
      exceeded: [],
      reduced: [{ rule: 'image-alt', knownElements: 1, foundElements: 0 }]
    },
    {
      name: 'rejects a failing rule that is not known',
      known: {},
      found: { region: 2 },
      exceeded: [{ rule: 'region', knownElements: 0, foundElements: 2 }],
      reduced: []
    },
    {
      name: 'compares each rule on its own when the totals match',
      known: { 'color-contrast': 1, tabindex: 2 },
      found: { 'color-contrast': 2, tabindex: 1 },
      exceeded: [
        { rule: 'color-contrast', knownElements: 1, foundElements: 2 }
      ],
      reduced: [{ rule: 'tabindex', knownElements: 2, foundElements: 1 }]
    }
  ])('$name', ({ known, found, exceeded, reduced }) => {
    expect(compareViolationCounts(known, found)).toEqual({ exceeded, reduced })
  })
})
