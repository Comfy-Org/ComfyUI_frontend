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
    fetchedAt: new Date().toISOString(),
    repository: 'Comfy-Org/ComfyUI' as const,
    stargazersCount: 112464
  }
}

function freshOutcome(): FetchOutcome {
  return {
    status: 'fresh',
    snapshot: snapshot()
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
    if (originalSummary === undefined) delete process.env.GITHUB_STEP_SUMMARY
    else process.env.GITHUB_STEP_SUMMARY = originalSummary
  })

  it('emits no annotation on a fresh outcome', () => {
    reportGitHubStarsOutcome(freshOutcome())
    expect(writeSpy).not.toHaveBeenCalled()
    expect(readFileSync(summaryPath, 'utf8')).toContain('Fresh')
  })

  it('emits exactly one stale warning across repeated calls', () => {
    const outcome: FetchOutcome = {
      status: 'stale',
      reason: 'HTTP 403 rate limited',
      snapshot: snapshot()
    }

    reportGitHubStarsOutcome(outcome)
    reportGitHubStarsOutcome(outcome)

    expect(writeSpy).toHaveBeenCalledTimes(1)
    const annotation = writeSpy.mock.calls[0]![0] as string
    expect(annotation).toContain('::warning title=GitHub stars unavailable')
    expect(readFileSync(summaryPath, 'utf8')).toContain('Stale')
  })

  it('emits an error for failed outcomes', () => {
    reportGitHubStarsOutcome({
      status: 'failed',
      reason: 'HTTP 500 Server Error'
    })

    const annotation = writeSpy.mock.calls[0]![0] as string
    expect(annotation).toContain('::error title=GitHub stars fetch failed')
    expect(readFileSync(summaryPath, 'utf8')).toContain('Failed')
  })
})
