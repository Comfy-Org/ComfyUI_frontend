import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FetchOutcome } from './featureFlags'
import type { FeatureFlagsSnapshot } from '../data/feature-flags'

import {
  reportFeatureFlagsOutcome,
  resetFeatureFlagsReporterForTests
} from './featureFlags.ci'

function baseSnapshot(cloudFreeTier = false): FeatureFlagsSnapshot {
  return {
    fetchedAt: new Date().toISOString(),
    flags: { cloudFreeTier }
  }
}

function freshOutcome(cloudFreeTier = false): FetchOutcome {
  return { status: 'fresh', snapshot: baseSnapshot(cloudFreeTier) }
}

describe('reportFeatureFlagsOutcome', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>
  let summaryDir: string
  let summaryPath: string
  const originalSummary = process.env.GITHUB_STEP_SUMMARY

  beforeEach(() => {
    resetFeatureFlagsReporterForTests()
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    summaryDir = mkdtempSync(join(tmpdir(), 'feature-flags-summary-'))
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

  it('emits nothing on a fresh outcome', () => {
    reportFeatureFlagsOutcome(freshOutcome())
    expect(writeSpy).not.toHaveBeenCalled()
    expect(readFileSync(summaryPath, 'utf8')).toContain('Fresh')
  })

  it('records cloudFreeTier value in the step summary', () => {
    reportFeatureFlagsOutcome(freshOutcome(true))
    expect(readFileSync(summaryPath, 'utf8')).toContain(
      '| **cloudFreeTier** | true |'
    )
  })

  it('emits exactly one annotation across repeated calls', () => {
    reportFeatureFlagsOutcome({
      status: 'stale',
      errorKind: 'http',
      reason: 'HTTP 500 Server Error',
      snapshot: baseSnapshot()
    })
    reportFeatureFlagsOutcome({
      status: 'stale',
      errorKind: 'http',
      reason: 'HTTP 500 Server Error',
      snapshot: baseSnapshot()
    })
    expect(writeSpy).toHaveBeenCalledTimes(1)
  })

  it('emits ::error for schema-mismatch stale outcomes', () => {
    reportFeatureFlagsOutcome({
      status: 'stale',
      errorKind: 'schema',
      reason:
        'schema validation failed: new_free_tier_subscriptions: Expected boolean',
      snapshot: baseSnapshot()
    })
    const annotation = writeSpy.mock.calls[0]![0] as string
    expect(annotation).toContain('::error title=Feature flags schema mismatch')
  })

  it('emits ::warning for transient API unavailability', () => {
    reportFeatureFlagsOutcome({
      status: 'stale',
      errorKind: 'http',
      reason: 'HTTP 503 Service Unavailable',
      snapshot: baseSnapshot()
    })
    const annotation = writeSpy.mock.calls[0]![0] as string
    expect(annotation).toContain(
      '::warning title=Feature flags API unavailable'
    )
  })

  it('emits ::error for a failed outcome', () => {
    reportFeatureFlagsOutcome({
      status: 'failed',
      errorKind: 'http',
      reason: 'HTTP 500 Server Error'
    })
    const annotation = writeSpy.mock.calls[0]![0] as string
    expect(annotation).toContain('::error title=Feature flags fetch failed')
    expect(readFileSync(summaryPath, 'utf8')).toContain('Failed')
  })

  it('escapes untrusted reason text in the step summary table', () => {
    reportFeatureFlagsOutcome({
      status: 'stale',
      errorKind: 'network',
      reason: 'proxy | <script>alert(1)</script>\nnext row',
      snapshot: baseSnapshot()
    })
    const summary = readFileSync(summaryPath, 'utf8')
    expect(summary).toContain(
      'proxy \\| &lt;script&gt;alert(1)&lt;/script&gt;<br>next row'
    )
    expect(summary).not.toContain('<script>')
  })

  it('does not throw when GITHUB_STEP_SUMMARY is not set', () => {
    delete process.env.GITHUB_STEP_SUMMARY
    expect(() => reportFeatureFlagsOutcome(freshOutcome())).not.toThrow()
  })
})
