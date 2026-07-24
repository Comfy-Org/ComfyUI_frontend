import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FetchOutcome } from './cloudNodes'
import type { NodesSnapshot } from '../data/cloudNodes'

import {
  reportCloudNodesOutcome,
  resetCloudNodesReporterForTests
} from './cloudNodes.ci'

function baseSnapshot(): NodesSnapshot {
  return {
    fetchedAt: new Date().toISOString(),
    packs: [
      {
        id: 'pack-id',
        displayName: 'Pack',
        nodes: [
          {
            name: 'NodeClass',
            displayName: 'Node Class',
            category: 'misc'
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
    droppedNodes:
      droppedCount === 0
        ? []
        : [{ name: 'BadNode', reason: 'invalid display_name' }],
    snapshot: baseSnapshot()
  }
}

describe('reportCloudNodesOutcome', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>
  let summaryDir: string
  let summaryPath: string
  const originalSummary = process.env.GITHUB_STEP_SUMMARY

  beforeEach(() => {
    resetCloudNodesReporterForTests()
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    summaryDir = mkdtempSync(join(tmpdir(), 'cloud-nodes-summary-'))
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
    reportCloudNodesOutcome(freshOutcome(0))
    expect(writeSpy).not.toHaveBeenCalled()
    expect(readFileSync(summaryPath, 'utf8')).toContain('Fresh')
  })

  it('emits exactly one set of annotations across repeated calls', () => {
    reportCloudNodesOutcome(freshOutcome(1))
    reportCloudNodesOutcome(freshOutcome(1))
    expect(writeSpy).toHaveBeenCalledTimes(1)
    const annotation = writeSpy.mock.calls[0]?.[0] as string
    expect(annotation).toContain(
      '::warning title=Cloud nodes: dropped 1 invalid'
    )
    expect(readFileSync(summaryPath, 'utf8')).toContain('Dropped')
  })

  it('emits ::error for auth failures in a stale outcome', () => {
    reportCloudNodesOutcome({
      status: 'stale',
      reason: 'HTTP 401 Unauthorized',
      snapshot: baseSnapshot()
    })
    const annotation = writeSpy.mock.calls[0]?.[0] as string
    expect(annotation).toContain(
      '::error title=Cloud nodes authentication failed'
    )
  })

  it('emits ::warning for missing-env stale outcomes', () => {
    reportCloudNodesOutcome({
      status: 'stale',
      reason: 'missing WEBSITE_CLOUD_API_KEY',
      snapshot: baseSnapshot()
    })
    const annotation = writeSpy.mock.calls[0]?.[0] as string
    expect(annotation).toContain('::warning title=Cloud nodes integration')
  })

  it('emits ::error for a failed outcome and writes no fresh-only sections', () => {
    reportCloudNodesOutcome({
      status: 'failed',
      reason: 'HTTP 500 Server Error'
    })
    const annotation = writeSpy.mock.calls[0]?.[0] as string
    expect(annotation).toContain('::error title=Cloud nodes fetch failed')
    expect(readFileSync(summaryPath, 'utf8')).toContain('Failed')
  })

  it('does not throw when GITHUB_STEP_SUMMARY is not set', () => {
    delete process.env.GITHUB_STEP_SUMMARY
    expect(() => reportCloudNodesOutcome(freshOutcome(0))).not.toThrow()
  })
})
