import { describe, expect, it } from 'vitest'

import {
  formatCoverageMetric,
  renderCriticalCoverageReport
} from './unified-report'

describe('formatCoverageMetric', () => {
  it('formats covered counts and percent', () => {
    expect(
      formatCoverageMetric({
        covered: 8,
        total: 10,
        pct: 80
      })
    ).toBe('8/10 | 80.00%')
  })

  it('falls back when a metric is missing or invalid', () => {
    expect(formatCoverageMetric()).toBe('N/A | N/A')
    expect(
      formatCoverageMetric({
        covered: Number.NaN,
        total: 10,
        pct: 80
      })
    ).toBe('N/A | N/A')
  })
})

describe('renderCriticalCoverageReport', () => {
  it('aggregates critical files only, ignoring total and non-critical paths', () => {
    expect(
      renderCriticalCoverageReport({
        total: {
          statements: { covered: 999, total: 1000, pct: 99.9 }
        },
        [`${process.cwd()}/src/utils/a.ts`]: {
          statements: { covered: 5, total: 6, pct: 83.33 },
          functions: { covered: 2, total: 2, pct: 100 },
          lines: { covered: 6, total: 6, pct: 100 }
        },
        'src/stores/b.ts': {
          statements: { covered: 3, total: 4, pct: 75 },
          functions: { covered: 1, total: 2, pct: 50 },
          lines: { covered: 3, total: 4, pct: 75 }
        },
        [`${process.cwd()}/src/views/NotCritical.vue`]: {
          statements: { covered: 0, total: 50, pct: 0 },
          functions: { covered: 0, total: 5, pct: 0 },
          lines: { covered: 0, total: 50, pct: 0 }
        },
        [`${process.cwd()}/src/lib/nested/src/utils/impostor.ts`]: {
          statements: { covered: 0, total: 40, pct: 0 },
          functions: { covered: 0, total: 4, pct: 0 },
          lines: { covered: 0, total: 40, pct: 0 }
        }
      })
    ).toBe(
      [
        '## Critical Unit Coverage',
        '',
        '| Metric | Covered | Coverage |',
        '|---|---:|---:|',
        '| Statements | 8/10 | 80.00% |',
        '| Branches | N/A | N/A |',
        '| Functions | 3/4 | 75.00% |',
        '| Lines | 9/10 | 90.00% |'
      ].join('\n')
    )
  })
})
