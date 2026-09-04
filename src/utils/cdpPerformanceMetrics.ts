export interface CdpPerformanceMetric {
  name: string
  value: number
}

const TASK_COMPONENT_METRICS = [
  'ScriptDuration',
  'V8CompileDuration',
  'RecalcStyleDuration',
  'LayoutDuration',
  'DevToolsCommandDuration',
  'TaskOtherDuration'
] as const

export interface CdpTaskAccounting {
  taskOtherDurationMs: number | null
  v8CompileDurationMs: number | null
  devToolsCommandDurationMs: number | null
  threadTimeMs: number | null
  processTimeMs: number | null
  /** Sum of Chromium's six TaskDuration component counters. */
  accountedTaskDurationMs: number | null
  /** TaskDuration minus all six components; arithmetic drift, not a category. */
  taskAccountingResidualMs: number | null
  missingCdpMetrics: string[]
  nonMonotonicCdpMetrics: string[]
}

export type CdpMetricSnapshot = ReadonlyMap<string, number>

class MissingCdpMetricError extends Error {}

export function parseCdpMetrics(
  metrics: CdpPerformanceMetric[]
): CdpMetricSnapshot {
  const snapshot = new Map<string, number>()
  for (const { name, value } of metrics) {
    if (!Number.isFinite(value)) continue
    snapshot.set(name, value)
  }
  return snapshot
}

export function requireCdpMetric(
  snapshot: CdpMetricSnapshot,
  name: string
): number {
  const value = snapshot.get(name)
  if (value === undefined) {
    throw new MissingCdpMetricError(
      `Performance.getMetrics omitted required metric ${name}`
    )
  }
  return value
}

function optionalDeltaSeconds(
  before: CdpMetricSnapshot,
  after: CdpMetricSnapshot,
  name: string
): number | null {
  const beforeValue = before.get(name)
  const afterValue = after.get(name)
  if (beforeValue === undefined || afterValue === undefined) return null
  return afterValue - beforeValue
}

export function computeCdpTaskAccounting(
  before: CdpMetricSnapshot,
  after: CdpMetricSnapshot
): CdpTaskAccounting {
  // Chromium defines TaskOtherDuration as TaskDuration minus Script, V8
  // compilation, style, layout, and DevTools-command durations. Preserve the
  // protocol's own residual bucket and only use this sum to audit arithmetic;
  // none of these counters can identify native stacks.
  const names = [
    'TaskDuration',
    ...TASK_COMPONENT_METRICS,
    'ThreadTime',
    'ProcessTime'
  ]
  const deltas = new Map(
    names.map((name) => [name, optionalDeltaSeconds(before, after, name)])
  )
  const getDelta = (name: string): number | null => deltas.get(name) ?? null
  const missingCdpMetrics = names.filter((name) => getDelta(name) === null)
  const nonMonotonicCdpMetrics = names.filter((name) => {
    const delta = getDelta(name)
    return delta !== null && delta < 0
  })
  const componentDeltas = TASK_COMPONENT_METRICS.map((name) => getDelta(name))
  const taskDuration = getDelta('TaskDuration')
  const canCompose =
    taskDuration !== null &&
    componentDeltas.every(
      (value): value is number => value !== null && value >= 0
    ) &&
    taskDuration >= 0
  const accountedSeconds = canCompose
    ? componentDeltas.reduce<number>((sum, value) => sum + value, 0)
    : null

  const milliseconds = (value: number | null | undefined) =>
    value === null || value === undefined || value < 0 ? null : value * 1000

  return {
    taskOtherDurationMs: milliseconds(getDelta('TaskOtherDuration')),
    v8CompileDurationMs: milliseconds(getDelta('V8CompileDuration')),
    devToolsCommandDurationMs: milliseconds(
      getDelta('DevToolsCommandDuration')
    ),
    threadTimeMs: milliseconds(getDelta('ThreadTime')),
    processTimeMs: milliseconds(getDelta('ProcessTime')),
    accountedTaskDurationMs: milliseconds(accountedSeconds),
    taskAccountingResidualMs:
      canCompose && accountedSeconds !== null
        ? (taskDuration - accountedSeconds) * 1000
        : null,
    missingCdpMetrics,
    nonMonotonicCdpMetrics
  }
}
