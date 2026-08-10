import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FetchOutcome } from './github'

import {
  reportGitHubStarsOutcome,
  resetGitHubStarsReporterForTests
} from './github.ci'

function snapshot() {
  return {
    fetchedAt: '2026-08-10T00:00:00.000Z',
    repository: 'Comfy-Org/ComfyUI' as const,
    stargazersCount: 126201
  }
}

describe('reportGitHubStarsOutcome', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>
  let summaryDir: string
  let summaryPath: string
  const originalSummary = process.env.GITHUB_STEP_SUMMARY

  beforeEach(() => {
    resetGitHubStarsReporterForTests()
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    summaryDir = mkdtempSync(join(tmpdir(), 'github-stars-summary-'))
    summaryPath = join(summaryDir, 'summary.md')
    writeFileSync(summaryPath, '')
    process.env.GITHUB_STEP_SUMMARY = summaryPath
  })

  afterEach(() => {
    writeSpy.mockRestore()
    rmSync(summaryDir, { recursive: true, force: true })
    if (originalSummary === undefined) {
      delete process.env.GITHUB_STEP_SUMMARY
      return
    }
    process.env.GITHUB_STEP_SUMMARY = originalSummary
  })

  it('writes a fresh summary without an annotation', () => {
    const outcome: FetchOutcome = {
      status: 'fresh',
      snapshot: snapshot()
    }

    reportGitHubStarsOutcome(outcome)

    expect(writeSpy).not.toHaveBeenCalled()
    expect(readFileSync(summaryPath, 'utf8')).toContain('Fresh')
  })

  it('emits one warning when repeated calls use a stale snapshot', () => {
    const outcome: FetchOutcome = {
      status: 'stale',
      reason: 'HTTP 403 rate limited',
      snapshot: snapshot()
    }

    reportGitHubStarsOutcome(outcome)
    reportGitHubStarsOutcome(outcome)

    expect(writeSpy).toHaveBeenCalledTimes(1)
    expect(writeSpy.mock.calls[0]?.[0]).toContain(
      '::warning title=GitHub stars unavailable'
    )
    expect(readFileSync(summaryPath, 'utf8')).toContain('Stale')
  })

  it('emits an error when no snapshot is available', () => {
    reportGitHubStarsOutcome({
      status: 'failed',
      reason: 'HTTP 500 Server Error'
    })

    expect(writeSpy.mock.calls[0]?.[0]).toContain(
      '::error title=GitHub stars fetch failed'
    )
    expect(readFileSync(summaryPath, 'utf8')).toContain('Failed')
  })
})
