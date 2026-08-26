import {
  computeCdpTaskAccounting,
  parseCdpMetrics,
  requireCdpMetric
} from './cdpPerformanceMetrics'

const before = parseCdpMetrics([
  { name: 'TaskDuration', value: 10 },
  { name: 'ScriptDuration', value: 4 },
  { name: 'V8CompileDuration', value: 1 },
  { name: 'RecalcStyleDuration', value: 1 },
  { name: 'LayoutDuration', value: 1 },
  { name: 'DevToolsCommandDuration', value: 1 },
  { name: 'TaskOtherDuration', value: 2 },
  { name: 'ThreadTime', value: 8 },
  { name: 'ProcessTime', value: 20 }
])

describe('CDP performance task accounting', () => {
  it('retains every Chromium TaskDuration component and CPU counter', () => {
    const after = parseCdpMetrics([
      { name: 'TaskDuration', value: 10.1 },
      { name: 'ScriptDuration', value: 4.04 },
      { name: 'V8CompileDuration', value: 1.01 },
      { name: 'RecalcStyleDuration', value: 1.01 },
      { name: 'LayoutDuration', value: 1.015 },
      { name: 'DevToolsCommandDuration', value: 1.005 },
      { name: 'TaskOtherDuration', value: 2.02 },
      { name: 'ThreadTime', value: 8.07 },
      { name: 'ProcessTime', value: 20.2 }
    ])

    const result = computeCdpTaskAccounting(before, after)
    expect(result).toMatchObject({
      missingCdpMetrics: [],
      nonMonotonicCdpMetrics: []
    })
    expect(result.taskOtherDurationMs).toBeCloseTo(20)
    expect(result.v8CompileDurationMs).toBeCloseTo(10)
    expect(result.devToolsCommandDurationMs).toBeCloseTo(5)
    expect(result.threadTimeMs).toBeCloseTo(70)
    expect(result.processTimeMs).toBeCloseTo(200)
    expect(result.accountedTaskDurationMs).toBeCloseTo(100)
    expect(result.taskAccountingResidualMs).toBeCloseTo(0)
  })

  it('does not invent an omitted category or composition', () => {
    const after = new Map(before)
    after.delete('TaskOtherDuration')

    const result = computeCdpTaskAccounting(before, after)
    expect(result.taskOtherDurationMs).toBeNull()
    expect(result.accountedTaskDurationMs).toBeNull()
    expect(result.taskAccountingResidualMs).toBeNull()
    expect(result.missingCdpMetrics).toEqual(['TaskOtherDuration'])
  })

  it('rejects reset counters instead of reporting negative durations', () => {
    const after = new Map(before)
    after.set('TaskDuration', 0)

    const result = computeCdpTaskAccounting(before, after)
    expect(result.accountedTaskDurationMs).toBeNull()
    expect(result.taskAccountingResidualMs).toBeNull()
    expect(result.nonMonotonicCdpMetrics).toEqual(['TaskDuration'])
  })

  it('fails loudly when an existing required metric is absent', () => {
    expect(() => requireCdpMetric(new Map(), 'Timestamp')).toThrow(
      'Performance.getMetrics omitted required metric Timestamp'
    )
  })

  it('ignores non-finite protocol values', () => {
    const snapshot = parseCdpMetrics([
      { name: 'Timestamp', value: Number.NaN },
      { name: 'TaskDuration', value: 1 }
    ])
    expect(snapshot.has('Timestamp')).toBe(false)
    expect(requireCdpMetric(snapshot, 'TaskDuration')).toBe(1)
  })
})
