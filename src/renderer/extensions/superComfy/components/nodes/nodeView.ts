import { sum, uniq } from 'es-toolkit'

import type {
  ExecutableNode,
  MediaItem,
  NodeId,
  PortSpec,
  RunFailureCode,
  RunRecord,
  SettingSpec,
  SettingValue,
  SuperNode
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import { portsOf } from '@/renderer/extensions/superComfy/engine/graphTopology'
import { samePlanKeys } from '@/renderer/extensions/superComfy/engine/planRuns'
import { nodeProgress } from '@/renderer/extensions/superComfy/engine/selectors'
import type {
  Block,
  NodeActivity,
  RunPlan,
  RunSlot
} from '@/renderer/extensions/superComfy/engine/types'

export type BatchEntry =
  | { kind: 'item'; item: MediaItem }
  | { kind: 'failed'; message?: string; code?: RunFailureCode }

export interface StatusLine {
  tone: 'muted' | 'destructive'
  key?: string
  params?: Record<string, string | number>
  count?: number
  text?: string
}

interface StatusInput {
  node: ExecutableNode
  activity: NodeActivity
  plan: RunPlan
  missing: readonly string[]
  error?: string
}

const SUMMARY_VALUES = 3

export function itemEntries(items: readonly MediaItem[]): BatchEntry[] {
  return items.map((item) => ({ kind: 'item', item }))
}

export function batchEntries(node: ExecutableNode, port: string): BatchEntry[] {
  const result = node.result
  if (!result) return []
  const failures = new Map(
    result.failures.map((failure) => [failure.index, failure])
  )
  return result.planKeys.flatMap((key, index): BatchEntry[] => {
    const failure = failures.get(index)
    if (failure) {
      return [{ kind: 'failed', message: failure.message, code: failure.code }]
    }
    const record = Object.hasOwn(node.runs, key) ? node.runs[key] : undefined
    return itemEntries(record?.outputs[port] ?? [])
  })
}

function portLabels(node: SuperNode, names: readonly string[]): string {
  const inputs = portsOf(node).inputs
  return names
    .map((name) => inputs.find((port) => port.name === name)?.label ?? name)
    .join(', ')
}

function queuePosition(slots: readonly RunSlot[]): number | null {
  const running = slots.filter(({ state }) => state === 'running')
  if (running.length === 0) return null
  const positions = running.map(({ queuePosition }) => queuePosition)
  if (positions.some((position) => position === undefined)) return null
  return Math.min(...positions.filter((position) => position !== undefined))
}

function runningStatus(
  activity: Extract<NodeActivity, { phase: 'running' }>
): StatusLine {
  const position = queuePosition(activity.slots)
  if (position !== null) {
    return {
      tone: 'muted',
      key: 'superComfy.node.queued',
      params: { position }
    }
  }
  const progress = nodeProgress(activity)
  return {
    tone: 'muted',
    key: 'superComfy.node.running',
    params: { done: progress?.settled ?? 0, total: progress?.total ?? 0 }
  }
}

function limitStatus(node: ExecutableNode, block: Block): StatusLine | null {
  if (block.reason === 'tooManyRuns') {
    return {
      tone: 'destructive',
      key: 'superComfy.node.tooManyRuns',
      params: { runs: block.runs, limit: block.limit }
    }
  }
  if (block.reason === 'tooManyItems') {
    return {
      tone: 'destructive',
      key: 'superComfy.node.tooManyItems',
      params: { port: portLabels(node, [block.port]), max: block.max }
    }
  }
  return null
}

function blockStatus(
  node: ExecutableNode,
  block: Block,
  plan: RunPlan,
  missing: readonly string[]
): StatusLine | null {
  switch (block.reason) {
    case 'missingInputs':
      return missing.length > 0
        ? {
            tone: 'destructive',
            key: 'superComfy.node.needs',
            params: { port: portLabels(node, missing) }
          }
        : null
    case 'tooManyRuns':
    case 'tooManyItems':
      return !plan.ok && plan.block.reason === block.reason
        ? limitStatus(node, plan.block)
        : null
    case 'noContract':
      return null
    case 'upstreamFailed':
      return { tone: 'destructive', key: 'superComfy.node.upstreamFailed' }
  }
}

function resultStatus(node: ExecutableNode, plan: RunPlan): StatusLine | null {
  const result = node.result
  if (!result) return null
  if (result.status === 'failed') {
    return { tone: 'destructive', key: 'superComfy.node.allFailed' }
  }
  if (result.failures.length > 0) {
    return {
      tone: 'destructive',
      key: 'superComfy.node.failed',
      params: { count: result.failures.length }
    }
  }
  const stale =
    plan.ok &&
    !samePlanKeys(
      result.planKeys,
      plan.runs.map(({ key }) => key)
    )
  if (stale) return { tone: 'muted', key: 'superComfy.node.changed' }
  return {
    tone: 'muted',
    key: 'superComfy.node.done',
    params: { count: result.planKeys.length },
    count: result.planKeys.length
  }
}

function planStatus(node: ExecutableNode, plan: RunPlan): StatusLine | null {
  if (plan.ok) return null
  if (plan.block.reason !== 'missingInputs') return null
  return {
    tone: 'muted',
    key: 'superComfy.node.needs',
    params: { port: portLabels(node, plan.block.ports) }
  }
}

/** The one-line status shown in an executable node's header. */
export function nodeStatus({
  node,
  activity,
  plan,
  missing,
  error
}: StatusInput): StatusLine | null {
  if (error) return { tone: 'destructive', text: error }
  if (activity.phase === 'running') return runningStatus(activity)
  if (activity.phase === 'waiting') return null
  if (activity.phase === 'upToDate') {
    return { tone: 'muted', key: 'superComfy.node.upToDate' }
  }
  const blocked =
    activity.phase === 'blocked'
      ? blockStatus(node, activity.block, plan, missing)
      : null
  return blocked ?? resultStatus(node, plan) ?? planStatus(node, plan)
}

function settingValue(
  spec: SettingSpec,
  values: Record<string, SettingValue>
): SettingValue | undefined {
  return Object.hasOwn(values, spec.name) ? values[spec.name] : spec.default
}

/** Up to three setting values for the collapsed settings summary. */
export function summaryValues(
  settings: readonly SettingSpec[],
  values: Record<string, SettingValue>
): string[] {
  return settings
    .filter((spec) => spec.control !== 'toggle')
    .map((spec) => settingValue(spec, values))
    .filter(
      (value): value is string | number =>
        value !== undefined && typeof value !== 'boolean' && value !== ''
    )
    .slice(0, SUMMARY_VALUES)
    .map(String)
}

export function inlinePorts(
  node: ExecutableNode,
  wired: (nodeId: NodeId, port: string) => boolean
): PortSpec[] {
  return portsOf(node).inputs.filter(
    (port) => port.inline === true && !wired(node.id, port.name)
  )
}

function resultRecords(node: ExecutableNode): RunRecord[] {
  return (node.result?.planKeys ?? []).flatMap((key) =>
    Object.hasOwn(node.runs, key) ? [node.runs[key]] : []
  )
}

/** Credits the server reported for the node's last result, if any. */
export function resultCredits(node: ExecutableNode): number | null {
  const reported = resultRecords(node).flatMap(({ creditsUsed }) =>
    creditsUsed === undefined ? [] : [creditsUsed]
  )
  return reported.length > 0 ? sum(reported) : null
}

/** The distinct notices the server attached to the node's last result. */
export function resultNotices(node: ExecutableNode): string[] {
  return uniq(
    resultRecords(node).flatMap(({ notice }) => (notice ? [notice] : []))
  )
}
