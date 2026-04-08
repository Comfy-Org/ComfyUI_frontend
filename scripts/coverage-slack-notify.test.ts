import { describe, expect, it } from 'vitest'

import {
  buildMilestoneBlock,
  crossedMilestone,
  formatCoverageRow,
  formatDelta,
  formatPct,
  parseArgs,
  parseLcovContent,
  progressBar
} from './coverage-slack-notify'

describe('parseLcovContent', () => {
  it('parses valid lcov content', () => {
    const content = [
      'SF:src/foo.ts',
      'LF:100',
      'LH:75',
      'end_of_record',
      'SF:src/bar.ts',
      'LF:200',
      'LH:150',
      'end_of_record'
    ].join('\n')

    const result = parseLcovContent(content)
    expect(result).toEqual({
      totalLines: 300,
      coveredLines: 225,
      percentage: 75
    })
  })

  it('returns null for empty content', () => {
    expect(parseLcovContent('')).toBeNull()
  })

  it('returns null when total lines is zero', () => {
    expect(parseLcovContent('SF:src/foo.ts\nend_of_record')).toBeNull()
  })

  it('handles malformed LF/LH values gracefully', () => {
    const content = 'LF:abc\nLH:50\n'
    expect(parseLcovContent(content)).toBeNull()
  })

  it('handles NaN in LH with valid LF', () => {
    const content = 'LF:100\nLH:xyz\n'
    const result = parseLcovContent(content)
    expect(result).toEqual({
      totalLines: 100,
      coveredLines: 0,
      percentage: 0
    })
  })
})

describe('progressBar', () => {
  it('returns all filled for 100%', () => {
    expect(progressBar(100)).toBe('████████████████████')
  })

  it('returns all empty for 0%', () => {
    expect(progressBar(0)).toBe('░░░░░░░░░░░░░░░░░░░░')
  })

  it('returns half filled for 50%', () => {
    const bar = progressBar(50)
    expect(bar).toBe('██████████░░░░░░░░░░')
  })
})

describe('formatPct', () => {
  it('formats with one decimal place', () => {
    expect(formatPct(75.123)).toBe('75.1%')
  })

  it('formats zero', () => {
    expect(formatPct(0)).toBe('0.0%')
  })
})

describe('formatDelta', () => {
  it('adds + sign for positive delta', () => {
    expect(formatDelta(2.5)).toBe('+2.5%')
  })

  it('adds - sign for negative delta', () => {
    expect(formatDelta(-1.3)).toBe('-1.3%')
  })

  it('adds + sign for zero', () => {
    expect(formatDelta(0)).toBe('+0.0%')
  })
})

describe('crossedMilestone', () => {
  it('detects crossing from 14.9 to 15.1', () => {
    expect(crossedMilestone(14.9, 15.1)).toBe(15)
  })

  it('detects crossing from 79.9 to 80.1', () => {
    expect(crossedMilestone(79.9, 80.1)).toBe(80)
  })

  it('returns null when no milestone crossed', () => {
    expect(crossedMilestone(16, 18)).toBeNull()
  })

  it('returns highest milestone when crossing multiple', () => {
    expect(crossedMilestone(14, 26)).toBe(25)
  })

  it('detects exact boundary crossing', () => {
    expect(crossedMilestone(14.999, 15.0)).toBe(15)
  })

  it('returns null when staying in same bucket', () => {
    expect(crossedMilestone(10.0, 14.9)).toBeNull()
  })
})

describe('buildMilestoneBlock', () => {
  it('returns goal-reached block at target', () => {
    const block = buildMilestoneBlock('Unit test', 80)
    expect(block).not.toBeNull()
    expect(block!.text.text).toContain('GOAL REACHED')
  })

  it('returns milestone block below target', () => {
    const block = buildMilestoneBlock('Unit test', 25)
    expect(block).not.toBeNull()
    expect(block!.text.text).toContain('MILESTONE')
    expect(block!.text.text).toContain('55 percentage points to go')
  })

  it('uses singular for 1 percentage point', () => {
    const block = buildMilestoneBlock('Unit test', 79)
    expect(block!.text.text).toContain('1 percentage point to go')
  })
})

describe('parseArgs', () => {
  it('parses all arguments', () => {
    const result = parseArgs([
      '--pr-url=https://github.com/foo/bar/pull/1',
      '--pr-number=42',
      '--author=alice'
    ])
    expect(result).toEqual({
      prUrl: 'https://github.com/foo/bar/pull/1',
      prNumber: '42',
      author: 'alice'
    })
  })

  it('returns empty strings for missing args', () => {
    expect(parseArgs([])).toEqual({
      prUrl: '',
      prNumber: '',
      author: ''
    })
  })
})

describe('formatCoverageRow', () => {
  it('formats a coverage row with delta', () => {
    const current = { percentage: 50, totalLines: 200, coveredLines: 100 }
    const baseline = { percentage: 45, totalLines: 200, coveredLines: 90 }

    const row = formatCoverageRow('Unit', current, baseline)
    expect(row).toBe('*Unit:*  45.0% → 50.0%  (+5.0%)')
  })

  it('formats negative delta', () => {
    const current = { percentage: 40, totalLines: 200, coveredLines: 80 }
    const baseline = { percentage: 45, totalLines: 200, coveredLines: 90 }

    const row = formatCoverageRow('E2E', current, baseline)
    expect(row).toContain('-5.0%')
  })
})
