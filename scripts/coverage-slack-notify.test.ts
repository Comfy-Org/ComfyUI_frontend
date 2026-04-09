import { describe, expect, it } from 'vitest'

import type { CoverageData } from './coverage-slack-notify'
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
  it('parses valid LCOV content', () => {
    const content = ['LF:100', 'LH:75', 'end_of_record'].join('\n')
    const result = parseLcovContent(content)
    expect(result).toEqual({
      percentage: 75,
      totalLines: 100,
      coveredLines: 75
    })
  })

  it('sums lines across multiple records', () => {
    const content = [
      'LF:100',
      'LH:50',
      'end_of_record',
      'LF:200',
      'LH:150',
      'end_of_record'
    ].join('\n')
    const result = parseLcovContent(content)
    expect(result).toEqual({
      percentage: (200 / 300) * 100,
      totalLines: 300,
      coveredLines: 200
    })
  })

  it('returns null for empty content', () => {
    expect(parseLcovContent('')).toBeNull()
  })

  it('returns null when total lines is zero', () => {
    const content = 'LH:10\nend_of_record'
    expect(parseLcovContent(content)).toBeNull()
  })

  it('treats malformed numeric values as zero', () => {
    const content = ['LF:abc', 'LH:10', 'LF:50', 'end_of_record'].join('\n')
    const result = parseLcovContent(content)
    expect(result).toEqual({
      percentage: 20,
      totalLines: 50,
      coveredLines: 10
    })
  })

  it('ignores unrelated lines', () => {
    const content = [
      'TN:',
      'SF:/some/file.ts',
      'LF:200',
      'LH:100',
      'end_of_record'
    ].join('\n')
    const result = parseLcovContent(content)
    expect(result).toEqual({
      percentage: 50,
      totalLines: 200,
      coveredLines: 100
    })
  })
})

describe('progressBar', () => {
  it('renders empty bar at 0%', () => {
    expect(progressBar(0)).toBe('░'.repeat(20))
  })

  it('renders half-filled bar at 50%', () => {
    const bar = progressBar(50)
    expect(bar).toBe('█'.repeat(10) + '░'.repeat(10))
  })

  it('renders full bar at 100%', () => {
    expect(progressBar(100)).toBe('█'.repeat(20))
  })

  it('clamps negative values to 0%', () => {
    expect(progressBar(-10)).toBe('░'.repeat(20))
  })

  it('clamps values above 100% to 100%', () => {
    expect(progressBar(150)).toBe('█'.repeat(20))
  })

  it('has consistent length of 20 characters', () => {
    for (const pct of [0, 25, 50, 75, 100]) {
      expect(progressBar(pct)).toHaveLength(20)
    }
  })
})

describe('formatPct', () => {
  it('formats integer percentage', () => {
    expect(formatPct(50)).toBe('50.0%')
  })

  it('formats decimal percentage', () => {
    expect(formatPct(12.34)).toBe('12.3%')
  })

  it('formats zero', () => {
    expect(formatPct(0)).toBe('0.0%')
  })

  it('formats 100', () => {
    expect(formatPct(100)).toBe('100.0%')
  })
})

describe('formatDelta', () => {
  it('formats positive delta with + sign', () => {
    expect(formatDelta(1.2)).toBe('+1.2%')
  })

  it('formats negative delta with - sign', () => {
    expect(formatDelta(-0.5)).toBe('-0.5%')
  })

  it('formats zero delta with + sign', () => {
    expect(formatDelta(0)).toBe('+0.0%')
  })

  it('formats large positive delta', () => {
    expect(formatDelta(15.67)).toBe('+15.7%')
  })
})

describe('crossedMilestone', () => {
  it('detects crossing a 5% boundary', () => {
    expect(crossedMilestone(23, 27)).toBe(25)
  })

  it('returns null when no boundary is crossed', () => {
    expect(crossedMilestone(21, 24)).toBeNull()
  })

  it('detects exact boundary crossing', () => {
    expect(crossedMilestone(24.9, 25)).toBe(25)
  })

  it('returns highest milestone when crossing multiple boundaries', () => {
    expect(crossedMilestone(24, 31)).toBe(30)
  })

  it('returns null when values are equal', () => {
    expect(crossedMilestone(25, 25)).toBeNull()
  })

  it('returns null when coverage decreases', () => {
    expect(crossedMilestone(30, 28)).toBeNull()
  })

  it('detects crossing from 0', () => {
    expect(crossedMilestone(0, 7)).toBe(5)
  })
})

describe('buildMilestoneBlock', () => {
  it('builds celebration block below target', () => {
    const block = buildMilestoneBlock('Unit test', 50)
    expect(block.type).toBe('section')
    expect(block.text.type).toBe('mrkdwn')
    expect(block.text.text).toContain('MILESTONE: Unit test coverage hit 50%')
    expect(block.text.text).toContain('30 percentage points to go')
  })

  it('builds goal-reached block at target', () => {
    const block = buildMilestoneBlock('Unit test', 80)
    expect(block.text.text).toContain('GOAL REACHED')
    expect(block.text.text).toContain('80%')
    expect(block.text.text).toContain('✅')
  })

  it('builds goal-reached block above target', () => {
    const block = buildMilestoneBlock('E2E test', 85)
    expect(block.text.text).toContain('GOAL REACHED')
    expect(block.text.text).toContain('85%')
  })

  it('uses singular "point" when 1 remaining', () => {
    const block = buildMilestoneBlock('Unit test', 79)
    expect(block.text.text).toContain('1 percentage point to go')
  })
})

describe('parseArgs', () => {
  it('parses all args', () => {
    const argv = [
      '--pr-url=https://github.com/org/repo/pull/42',
      '--pr-number=42',
      '--author=testuser'
    ]
    expect(parseArgs(argv)).toEqual({
      prUrl: 'https://github.com/org/repo/pull/42',
      prNumber: '42',
      author: 'testuser'
    })
  })

  it('returns empty strings for missing args', () => {
    expect(parseArgs([])).toEqual({
      prUrl: '',
      prNumber: '',
      author: ''
    })
  })

  it('handles args with empty values', () => {
    const argv = ['--pr-url=', '--pr-number=', '--author=']
    expect(parseArgs(argv)).toEqual({
      prUrl: '',
      prNumber: '',
      author: ''
    })
  })

  it('ignores unknown args', () => {
    const argv = ['--unknown=value', '--pr-number=99']
    expect(parseArgs(argv)).toEqual({
      prUrl: '',
      prNumber: '99',
      author: ''
    })
  })
})

describe('formatCoverageRow', () => {
  it('formats a coverage comparison row', () => {
    const current: CoverageData = {
      percentage: 55,
      totalLines: 1000,
      coveredLines: 550
    }
    const baseline: CoverageData = {
      percentage: 50,
      totalLines: 1000,
      coveredLines: 500
    }
    const row = formatCoverageRow('Unit', current, baseline)
    expect(row).toBe('*Unit:*  50.0% → 55.0%  (+5.0%)')
  })

  it('formats a row with negative delta', () => {
    const current: CoverageData = {
      percentage: 48,
      totalLines: 1000,
      coveredLines: 480
    }
    const baseline: CoverageData = {
      percentage: 50,
      totalLines: 1000,
      coveredLines: 500
    }
    const row = formatCoverageRow('E2E', current, baseline)
    expect(row).toBe('*E2E:*  50.0% → 48.0%  (-2.0%)')
  })
})
