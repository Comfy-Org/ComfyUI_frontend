import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FetchOutcome } from './ashby'
import type { RolesSnapshot } from '../data/roles'

import { reportAshbyOutcome, resetAshbyReporterForTests } from './ashby.ci'

function baseSnapshot(): RolesSnapshot {
  return {
    fetchedAt: new Date().toISOString(),
    departments: [
      {
        name: 'ENGINEERING',
        key: 'engineering',
        roles: [
          {
            id: 'x',
            title: 'Design Engineer',
            department: 'Engineering',
            location: 'San Francisco',
            applyUrl: 'https://jobs.ashbyhq.com/comfy-org/x'
          }
        ]
      }
    ]
  }
}

function freshOutcome(droppedCount = 0): FetchOutcome {
  return {
    status: 'fresh',
    droppedCount,
    droppedRoles: Array.from({ length: droppedCount }, (_, i) => ({
      title: `Bad Role ${i + 1}`,
      reason: 'jobUrl: Invalid url'
    })),
    snapshot: {
      fetchedAt: new Date().toISOString(),
      departments: [
        {
          name: 'ENGINEERING',
          key: 'engineering',
          roles: [
            {
              id: 'x',
              title: 'Design Engineer',
              department: 'Engineering',
              location: 'San Francisco',
              applyUrl: 'https://jobs.ashbyhq.com/comfy-org/x'
            }
          ]
        }
      ]
    }
  }
}

describe('reportAshbyOutcome', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>
  let summaryDir: string
  let summaryPath: string
  const originalSummary = process.env.GITHUB_STEP_SUMMARY

  beforeEach(() => {
    resetAshbyReporterForTests()
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    summaryDir = mkdtempSync(join(tmpdir(), 'ashby-summary-'))
    summaryPath = join(summaryDir, 'summary.md')
    writeFileSync(summaryPath, '')
    process.env.GITHUB_STEP_SUMMARY = summaryPath
  })

  afterEach(() => {
    writeSpy.mockRestore()
    rmSync(summaryDir, { recursive: true, force: true })
    if (originalSummary === undefined) delete process.env.GITHUB_STEP_SUMMARY
    else process.env.GITHUB_STEP_SUMMARY = originalSummary
  })

  it('emits nothing on a clean fresh outcome', () => {
    reportAshbyOutcome(freshOutcome(0))
    expect(writeSpy).not.toHaveBeenCalled()
    expect(readFileSync(summaryPath, 'utf8')).toContain('Fresh')
  })

  it('emits exactly one set of annotations across repeated calls', () => {
    reportAshbyOutcome(freshOutcome(1))
    reportAshbyOutcome(freshOutcome(1))
    expect(writeSpy).toHaveBeenCalledTimes(1)
    const annotation = writeSpy.mock.calls[0]![0] as string
    expect(annotation).toContain('::warning title=Ashby: dropped 1 invalid')
    expect(readFileSync(summaryPath, 'utf8')).toContain('Dropped')
  })

  it('emits ::error for auth failures in a stale outcome', () => {
    reportAshbyOutcome({
      status: 'stale',
      reason: 'HTTP 401 Unauthorized',
      reasonCode: 'auth',
      snapshot: baseSnapshot()
    })
    const annotation = writeSpy.mock.calls[0]![0] as string
    expect(annotation).toContain('::error title=Ashby authentication failed')
  })

  it('emits ::warning for missing-env stale outcomes', () => {
    reportAshbyOutcome({
      status: 'stale',
      reason: 'missing WEBSITE_ASHBY_API_KEY or WEBSITE_ASHBY_JOB_BOARD_NAME',
      reasonCode: 'missing-env',
      snapshot: baseSnapshot()
    })
    const annotation = writeSpy.mock.calls[0]![0] as string
    expect(annotation).toContain('::warning title=Ashby integration')
  })

  it('emits ::error for schema mismatch in a stale outcome', () => {
    reportAshbyOutcome({
      status: 'stale',
      reason: 'envelope schema validation failed: apiVersion: Expected "1"',
      reasonCode: 'schema',
      snapshot: baseSnapshot()
    })
    const annotation = writeSpy.mock.calls[0]![0] as string
    expect(annotation).toContain('::error title=Ashby schema mismatch')
  })

  it('emits ::warning for network errors in a stale outcome', () => {
    reportAshbyOutcome({
      status: 'stale',
      reason: 'HTTP 503 Service Unavailable',
      reasonCode: 'network',
      snapshot: baseSnapshot()
    })
    const annotation = writeSpy.mock.calls[0]![0] as string
    expect(annotation).toContain('::warning title=Ashby API unavailable')
  })

  it('emits ::error for a failed outcome and writes no fresh-only sections', () => {
    reportAshbyOutcome({
      status: 'failed',
      reason: 'HTTP 500 Server Error',
      reasonCode: 'network'
    })
    const annotation = writeSpy.mock.calls[0]![0] as string
    expect(annotation).toContain('::error title=Ashby fetch failed')
    expect(readFileSync(summaryPath, 'utf8')).toContain('Failed')
  })

  it('does not throw when GITHUB_STEP_SUMMARY is not set', () => {
    delete process.env.GITHUB_STEP_SUMMARY
    expect(() => reportAshbyOutcome(freshOutcome(0))).not.toThrow()
  })

  it('renders snapshot age as "today" for a stale outcome fetched moments ago', () => {
    reportAshbyOutcome({
      status: 'stale',
      reason: 'HTTP 503 Service Unavailable',
      reasonCode: 'network',
      snapshot: { ...baseSnapshot(), fetchedAt: new Date().toISOString() }
    })
    expect(readFileSync(summaryPath, 'utf8')).toContain('| today |')
  })

  it('renders snapshot age as "unknown" when fetchedAt is unparseable', () => {
    reportAshbyOutcome({
      status: 'stale',
      reason: 'HTTP 503 Service Unavailable',
      reasonCode: 'network',
      snapshot: { ...baseSnapshot(), fetchedAt: 'not-a-date' }
    })
    expect(readFileSync(summaryPath, 'utf8')).toContain('| unknown |')
  })

  it('renders snapshot age as "unknown" when fetchedAt is in the future', () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString()
    reportAshbyOutcome({
      status: 'stale',
      reason: 'HTTP 503 Service Unavailable',
      reasonCode: 'network',
      snapshot: { ...baseSnapshot(), fetchedAt: future }
    })
    expect(readFileSync(summaryPath, 'utf8')).toContain('| unknown |')
  })

  it('renders snapshot age as "1 day" when exactly one day old', () => {
    const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString()
    reportAshbyOutcome({
      status: 'stale',
      reason: 'HTTP 503 Service Unavailable',
      reasonCode: 'network',
      snapshot: { ...baseSnapshot(), fetchedAt: oneDayAgo }
    })
    expect(readFileSync(summaryPath, 'utf8')).toContain('| 1 day |')
  })

  it('renders snapshot age in days when older than one day', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000).toISOString()
    reportAshbyOutcome({
      status: 'stale',
      reason: 'HTTP 503 Service Unavailable',
      reasonCode: 'network',
      snapshot: { ...baseSnapshot(), fetchedAt: fiveDaysAgo }
    })
    expect(readFileSync(summaryPath, 'utf8')).toContain('| 5 days |')
  })
})
