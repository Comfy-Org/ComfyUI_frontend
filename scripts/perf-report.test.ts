import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const TSX = join(ROOT, 'node_modules/.bin/tsx')
const SCRIPT = join(import.meta.dirname, 'perf-report.ts')

function render(measurements: Record<string, unknown>[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'perf-report-'))
  try {
    mkdirSync(join(dir, 'test-results'))
    writeFileSync(
      join(dir, 'test-results/perf-metrics.json'),
      JSON.stringify({ measurements })
    )
    const result = spawnSync(TSX, [SCRIPT], { cwd: dir, encoding: 'utf8' })
    if (result.status !== 0) {
      throw new Error(
        `perf-report.ts exited ${result.status}: ${result.stderr}`
      )
    }
    return result.stdout
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function heading(output: string): string {
  return output.split('\n')[0]
}

describe('perf-report heading', () => {
  it('does not count a scenario without frame samples as missing the FPS target', () => {
    const output = render([
      { name: 'fast', frameDurationMs: 16, p95FrameDurationMs: 17 },
      { name: 'unsampled', frameDurationMs: 0, p95FrameDurationMs: 0 }
    ])

    expect(heading(output)).not.toContain('below 52 FPS target')
    expect(output).not.toContain('0.0 P5 FPS ❌')
    expect(output.split('<details>')[0]).toContain(
      '1 scenario recorded no frame samples'
    )
  })

  it('still leads with a real FPS target miss', () => {
    const output = render([
      { name: 'slow', frameDurationMs: 25, p95FrameDurationMs: 40 },
      { name: 'unsampled', frameDurationMs: 0, p95FrameDurationMs: 0 }
    ])

    expect(heading(output)).toMatch(
      /^## ⚡ Performance: ❌ 1 below 52 FPS target/
    )
  })

  it('ignores unsampled runs when taking the median frame time', () => {
    const output = render([
      { name: 'slow', frameDurationMs: 0, p95FrameDurationMs: 0 },
      { name: 'slow', frameDurationMs: 16, p95FrameDurationMs: 18 },
      { name: 'slow', frameDurationMs: 16, p95FrameDurationMs: 21 }
    ])

    expect(heading(output)).toMatch(
      /^## ⚡ Performance: ❌ 1 below 52 FPS target/
    )
    expect(output).not.toContain('recorded no frame samples')
  })

  it('does not read as clean when no scenario recorded frame samples', () => {
    const output = render([
      { name: 'unsampled', frameDurationMs: 0, p95FrameDurationMs: 0 }
    ])

    expect(heading(output)).toMatch(
      /^## ⚡ Performance: ⚠️ No frame samples — FPS target not checked/
    )
  })

  it('starts a scenario timing line with its first metric, not a separator', () => {
    const output = render([
      { name: 'fast', frameDurationMs: 16, p95FrameDurationMs: 17 }
    ])

    expect(output).toContain('> **fast**: 62.5 avg FPS · 58.8 P5 FPS ✅')
  })

  it('leaves unsampled runs out of the frame time tables', () => {
    const output = render([
      { name: 'slow', frameDurationMs: 0, p95FrameDurationMs: 0 },
      { name: 'slow', frameDurationMs: 0, p95FrameDurationMs: 0 },
      { name: 'slow', frameDurationMs: 30, p95FrameDurationMs: 40 }
    ])

    expect(output).toContain('| slow: p95 frame time | 40ms |')
    expect(output).toContain('| slow: avg frame time | 30ms |')
  })

  it('does not report a run that measured nothing as clean', () => {
    const output = render([])

    expect(heading(output)).toBe(
      '## ⚡ Performance: ⚠️ No measurements recorded — check the perf test logs'
    )
  })
})
