import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { PerfMeasurement } from '../browser_tests/fixtures/helpers/PerformanceHelper'

const ROOT = join(import.meta.dirname, '..')
const TSX = join(ROOT, 'node_modules/.bin/tsx')
const SCRIPT = join(import.meta.dirname, 'perf-report.ts')

type Sample = Pick<
  PerfMeasurement,
  'name' | 'frameDurationMs' | 'p95FrameDurationMs'
> &
  Partial<Pick<PerfMeasurement, 'totalBlockingTimeMs'>>

interface ReportInputs {
  baseline?: Sample[]
  history?: Sample[][]
}

function writeReport(path: string, measurements: Sample[], index = 0) {
  writeFileSync(
    path,
    JSON.stringify({
      timestamp: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      measurements
    })
  )
}

function render(
  measurements: Sample[],
  { baseline, history = [] }: ReportInputs = {}
): string {
  const dir = mkdtempSync(join(tmpdir(), 'perf-report-'))
  try {
    mkdirSync(join(dir, 'test-results'))
    writeReport(join(dir, 'test-results/perf-metrics.json'), measurements)
    if (baseline) {
      mkdirSync(join(dir, 'temp/perf-baseline'), { recursive: true })
      writeReport(join(dir, 'temp/perf-baseline/perf-metrics.json'), baseline)
    }
    if (history.length > 0) {
      mkdirSync(join(dir, 'temp/perf-history'), { recursive: true })
      history.forEach((run, index) =>
        writeReport(join(dir, `temp/perf-history/${index}.json`), run, index)
      )
    }
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

function frames(name: string, ...frameMs: number[]): Sample[] {
  return frameMs.map((ms) => ({
    name,
    frameDurationMs: ms,
    p95FrameDurationMs: ms,
    totalBlockingTimeMs: 0
  }))
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

describe('perf-report baseline comparison', () => {
  it('compares sampled frame medians against the baseline on a cold start', () => {
    const output = render(frames('grow', 0, 40), {
      baseline: frames('grow', 0, 20)
    })

    expect(output).toContain('| grow: p95 frame time | 20ms | 40ms | +100% |')
    expect(output).toContain('| grow: avg frame time | 20ms | 40ms | +100% |')
    expect(output).toContain('| grow: TBT | 0ms | 0ms | +0% |')
  })

  it('does not flag unchanged frame times when history has unsampled runs', () => {
    const output = render(frames('steady', 0, 0, 17), {
      baseline: frames('steady', 0, 0, 17),
      history: [
        frames('steady', 0, 0, 16),
        frames('steady', 0, 0, 17),
        frames('steady', 0, 0, 17)
      ]
    })

    expect(heading(output)).toBe(
      '## ⚡ Performance: ✅ No regressions detected'
    )
    expect(output).toContain('| steady: p95 frame time | 17ms | 17ms | +0% |')
    expect(output).toContain('| steady: TBT | 0ms | 0ms | +0% |')
    expect(output).toMatch(/\| steady: p95 frame time \| 17ms \| 1ms \|/)
    expect(output).toMatch(
      /\| steady: p95 frame time \| \S+ \| [^|]+ \| 17ms \|/
    )
  })

  it('leaves wholly unsampled history runs out of the frame time variance', () => {
    const output = render(frames('steady', 0, 17), {
      baseline: frames('steady', 0, 17),
      history: [
        frames('steady', 0, 0, 16),
        frames('steady', 0, 0, 18),
        frames('steady', 0, 0)
      ]
    })

    expect(heading(output)).toBe(
      '## ⚡ Performance: ✅ No regressions detected'
    )
    expect(output).toContain(
      '<summary>Historical variance (up to 3 runs per metric)</summary>'
    )
    expect(output).toContain('| steady: p95 frame time | 17ms | 1ms |')
    expect(output).toContain('| steady: TBT | 0ms | 0ms |')
    expect(output).not.toMatch(/\| steady: p95 frame time \| [▁▂▃▄▅▆▇█]+ \|/)
  })

  it('flags a real frame time regression against sampled history', () => {
    const output = render(frames('grow', 0, 40), {
      baseline: frames('grow', 0, 20),
      history: [frames('grow', 0, 20), frames('grow', 0, 21)]
    })

    expect(heading(output)).toContain('2 regressions detected')
    expect(output.split('<details>')[0]).toContain(
      'Review the regressions below and profile the affected scenarios before merging.'
    )
    expect(output).toContain('| grow: p95 frame time | 20ms | 40ms | +100% |')
  })
})
