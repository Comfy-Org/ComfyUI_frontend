import { describe, expect, it } from 'vitest'
import { failureSummary } from '@e2e/fixtures/customNode/failureReport'

describe('failureSummary', () => {
  it('keeps an empty failure label concise', () => {
    expect(failureSummary('tier failures', [], 'tier-failures.json')).toBe(
      'tier failures'
    )
  })

  it('shows only the first line of the first ten failures', () => {
    const failures = Array.from(
      { length: 12 },
      (_, index) => `failure ${index + 1}\nlarge nested detail`
    )
    const summary = failureSummary(
      'Example-Pack tier failures',
      failures,
      'tier-failures.json'
    )
    expect(summary).toContain('12 failure(s); first 10')
    expect(summary).toContain('1. failure 1')
    expect(summary).toContain('10. failure 10')
    expect(summary).not.toContain('failure 11')
    expect(summary).not.toContain('large nested detail')
    expect(summary).toContain('full list in tier-failures.json')
  })
})
