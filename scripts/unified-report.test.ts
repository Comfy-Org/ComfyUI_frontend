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
  it('renders critical coverage rows from a summary', () => {
    expect(
      renderCriticalCoverageReport({
        total: {
          statements: { covered: 8, total: 10, pct: 80 },
          functions: { covered: 3, total: 4, pct: 75 },
          lines: { covered: 9, total: 10, pct: 90 }
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
