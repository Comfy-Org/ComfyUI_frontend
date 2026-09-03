import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const sizeReportScript = join(repoRoot, 'scripts/size-report.js')
const perfReportScript = join(repoRoot, 'scripts/perf-report.ts')
const tsx = join(repoRoot, 'node_modules/.bin/tsx')
const tempDirectories: string[] = []

function createTempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'report-compactness-'))
  tempDirectories.push(directory)
  return directory
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value))
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true })
  }
})

describe('compact CI reports', () => {
  it('keeps bundle summaries while moving file details to the artifact', () => {
    const directory = createTempDirectory()
    const bundle = {
      file: 'assets/example.js',
      category: 'Other',
      size: 120,
      gzip: 100,
      brotli: 80
    }
    writeJson(join(directory, 'temp/size/example.json'), bundle)
    writeJson(join(directory, 'temp/size-prev/example.json'), {
      ...bundle,
      size: 100,
      gzip: 90,
      brotli: 70
    })

    const full = execFileSync(process.execPath, [sizeReportScript], {
      cwd: directory,
      encoding: 'utf-8'
    })
    const compact = execFileSync(
      process.execPath,
      [sizeReportScript, '--compact'],
      { cwd: directory, encoding: 'utf-8' }
    )

    expect(full).toContain('assets/example.js')
    expect(compact).toContain('## 📦 Bundle:')
    expect(compact).toContain('`size-data` CI artifact')
    expect(compact).not.toContain('assets/example.js')
  })

  it('keeps performance headlines while moving raw measurements to the artifact', () => {
    const directory = createTempDirectory()
    writeJson(join(directory, 'test-results/perf-metrics.json'), {
      timestamp: '2026-09-03T00:00:00.000Z',
      gitSha: 'test-sha',
      branch: 'test-branch',
      measurements: [
        {
          name: 'canvas-idle',
          durationMs: 1000,
          styleRecalcs: 1,
          styleRecalcDurationMs: 1,
          layouts: 1,
          layoutDurationMs: 1,
          taskDurationMs: 1,
          heapDeltaBytes: 1,
          heapUsedBytes: 1,
          domNodes: 1,
          jsHeapTotalBytes: 1,
          scriptDurationMs: 1,
          eventListeners: 1,
          totalBlockingTimeMs: 1,
          frameDurationMs: 16,
          p95FrameDurationMs: 17
        }
      ]
    })

    const full = execFileSync(tsx, [perfReportScript], {
      cwd: directory,
      encoding: 'utf-8'
    })
    const compact = execFileSync(tsx, [perfReportScript, '--compact'], {
      cwd: directory,
      encoding: 'utf-8'
    })

    expect(full).toContain('<summary>Raw data</summary>')
    expect(compact).toContain('## ⚡ Performance Report')
    expect(compact).toContain('`perf-metrics` CI artifact')
    expect(compact).not.toContain('<summary>Raw data</summary>')
  })
})
