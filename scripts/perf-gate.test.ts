import { describe, expect, it } from 'vitest'

import type { FpsSample } from './perf-gate'
import { TARGET_P5_FPS, evaluatePerfGate, formatGateFailure } from './perf-gate'

const passing: FpsSample[] = [
  { testName: 'canvas-idle', p5Fps: 59.7 },
  { testName: 'large-graph-pan', p5Fps: 59.9 }
]

describe('evaluatePerfGate', () => {
  it('passes when every measured test clears the target', () => {
    const gate = evaluatePerfGate({
      metricsPresent: true,
      fpsSamples: passing,
      regressionCount: 0
    })
    expect(gate.passed).toBe(true)
    expect(gate.failures).toEqual([])
    expect(gate.evaluated).toBe(2)
  })

  it('fails the run when a test drops below the target', () => {
    const gate = evaluatePerfGate({
      metricsPresent: true,
      fpsSamples: [...passing, { testName: 'subgraph-idle', p5Fps: 41.2 }],
      regressionCount: 0
    })
    expect(gate.passed).toBe(false)
    expect(gate.failures).toEqual([
      {
        kind: 'fps-below-target',
        testName: 'subgraph-idle',
        p5Fps: 41.2,
        target: TARGET_P5_FPS
      }
    ])
    expect(gate.evaluated).toBe(3)
  })

  it('treats the target as inclusive', () => {
    expect(
      evaluatePerfGate({
        metricsPresent: true,
        fpsSamples: [{ testName: 'exactly-at-target', p5Fps: TARGET_P5_FPS }],
        regressionCount: 0
      }).passed
    ).toBe(true)

    expect(
      evaluatePerfGate({
        metricsPresent: true,
        fpsSamples: [{ testName: 'a-hair-under', p5Fps: TARGET_P5_FPS - 0.01 }],
        regressionCount: 0
      }).passed
    ).toBe(false)
  })

  it('reports every failing test, not just the first', () => {
    const gate = evaluatePerfGate({
      metricsPresent: true,
      fpsSamples: [
        { testName: 'a', p5Fps: 10 },
        { testName: 'b', p5Fps: 59.9 },
        { testName: 'c', p5Fps: 20 }
      ],
      regressionCount: 0
    })
    expect(gate.failures.map((f) => f.kind)).toEqual([
      'fps-below-target',
      'fps-below-target'
    ])
    expect(
      gate.failures.map((f) =>
        f.kind === 'fps-below-target' ? f.testName : null
      )
    ).toEqual(['a', 'c'])
  })

  // The failure mode this gate exists to catch: a perf job that measured
  // nothing must not report green.
  it('fails when the metrics file is absent', () => {
    const gate = evaluatePerfGate({
      metricsPresent: false,
      fpsSamples: [],
      regressionCount: 0
    })
    expect(gate.passed).toBe(false)
    expect(gate.failures).toEqual([{ kind: 'no-metrics' }])
    expect(gate.evaluated).toBe(0)
  })

  it('fails when metrics exist but contain no usable samples', () => {
    const gate = evaluatePerfGate({
      metricsPresent: true,
      fpsSamples: [
        { testName: 'canvas-idle', p5Fps: null },
        { testName: 'large-graph-pan', p5Fps: Number.NaN }
      ],
      regressionCount: 0
    })
    expect(gate.passed).toBe(false)
    expect(gate.failures).toEqual([{ kind: 'no-measurements' }])
    expect(gate.evaluated).toBe(0)
  })

  it('ignores unusable samples without failing when others are usable', () => {
    const gate = evaluatePerfGate({
      metricsPresent: true,
      fpsSamples: [
        { testName: 'canvas-idle', p5Fps: null },
        { testName: 'large-graph-pan', p5Fps: 59.9 }
      ],
      regressionCount: 0
    })
    expect(gate.passed).toBe(true)
    expect(gate.evaluated).toBe(1)
  })

  // Regressions are z-scores against `temp/perf-history`, which is frozen at
  // 2026-03-17 (issue #15545). They are carried for visibility and must not
  // change the verdict until that pipeline is alive again.
  it('records the regression count but never fails on it', () => {
    const gate = evaluatePerfGate({
      metricsPresent: true,
      fpsSamples: passing,
      regressionCount: 4
    })
    expect(gate.regressionCount).toBe(4)
    expect(gate.passed).toBe(true)
  })
})

describe('formatGateFailure', () => {
  it('names the test and both numbers for a budget miss', () => {
    expect(
      formatGateFailure({
        kind: 'fps-below-target',
        testName: 'subgraph-idle',
        p5Fps: 41.234,
        target: 52
      })
    ).toBe('subgraph-idle: 41.2 P5 FPS is below the target of 52')
  })

  it('distinguishes no file from no samples', () => {
    expect(formatGateFailure({ kind: 'no-metrics' })).not.toBe(
      formatGateFailure({ kind: 'no-measurements' })
    )
  })
})
