import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { isCloud } from '@/platform/distribution/types'
import { isHostTelemetryEnabled } from '@/platform/telemetry/hostTelemetryEnabled'
import { reportError } from '@/platform/telemetry/reportError'
import { isSubgraph } from '@/utils/typeGuardUtil'

type RowOperation = 'add_row' | 'remove_row' | 'remote_apply'

/**
 * The widget allocation budget a single DynamicGroup may expand into.
 *
 * This is a defensive bound, not the `max` product policy: it exists so that no
 * writer — a restored file, a peer, the agent — can make a row count allocate
 * unbounded widgets and inputs. `max` is Core's executability policy and is
 * enforced by Core and by producers, never here. See
 * `docs/adr/DYNAMIC-GROUP-0047-row-count-enforcement-boundary.md`.
 *
 * It mirrors comfy-multi-player's `MAX_OVERFLOW_WIDGETS` on purpose and **must
 * not be lower than it**. A follower stricter than the document layer refuses
 * counts the document accepted, which leaves the document and the canvas
 * disagreeing; `dynamicGroupEnforcementBoundary.test.ts` pins the relation.
 */
export const MAX_DYNAMIC_GROUP_ROW_WIDGETS = 4096

const rowFieldCounts = new WeakMap<IBaseWidget, number>()
const reported = new Set<string>()
let remoteRowCountNode: LGraphNode | undefined

export function markDynamicGroupController(
  widget: IBaseWidget,
  rowFields: number
): void {
  rowFieldCounts.set(widget, rowFields)
}

/** True for the hidden widget whose value is a DynamicGroup's row count. */
export function isDynamicGroupController(widget: IBaseWidget): boolean {
  return rowFieldCounts.has(widget)
}

/** Rows `widget`'s group may hold before its row widgets exceed the budget. */
export function dynamicGroupRowAllocationBound(widget: IBaseWidget): number {
  const fields = rowFieldCounts.get(widget)
  if (fields === undefined) return 0
  return fields === 0
    ? MAX_DYNAMIC_GROUP_ROW_WIDGETS
    : Math.floor(MAX_DYNAMIC_GROUP_ROW_WIDGETS / fields)
}

/**
 * Whether the row count being written to `node` came from the document rather
 * than from local authoring. Guards that belong to the authoring or restore
 * path consult this so they do not also run against a followed document, whose
 * count the follower must preserve.
 */
export function isRemoteDynamicGroupRowWrite(node: LGraphNode): boolean {
  return remoteRowCountNode === node
}

/**
 * Runs a remote row count write to `node`. A refusal on that node inside it is
 * reported once, as the remote mismatch, not also as a local row change.
 */
export function applyRemoteDynamicGroupRowCount(
  node: LGraphNode,
  write: () => void
): void {
  const previous = remoteRowCountNode
  remoteRowCountNode = node
  try {
    write()
  } finally {
    remoteRowCountNode = previous
  }
}

/** Whether a controller holds the row count its setter derives from `value`. */
export function reachesDynamicGroupRowCount(
  widget: IBaseWidget,
  value: unknown
): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false
  return widget.value === Math.max(widget.options.min ?? 0, Math.trunc(value))
}

function reportRowCount(
  node: LGraphNode,
  operation: RowOperation,
  counts: { requested: number | null; actual: number },
  report: {
    message: string
    errorType: string
    surface: 'graph' | 'agent'
    level?: 'warning'
    tags?: Record<string, string>
  }
): void {
  const key = `${report.errorType}:${node.type}:${operation}`
  if (!(isCloud || isHostTelemetryEnabled()) || reported.has(key)) return
  reported.add(key)
  reportError(new Error(report.message), {
    errorType: report.errorType,
    surface: report.surface,
    level: report.level,
    tags: {
      ...report.tags,
      node_type: node.type,
      operation,
      in_subgraph: isSubgraph(node.graph)
    },
    context: counts
  })
}

/** Reports a local DynamicGroup row change that left a different row count. */
export function reportDynamicGroupRowRefusal(
  node: LGraphNode,
  operation: 'add_row' | 'remove_row',
  requested: number,
  actual: number
): void {
  if (isRemoteDynamicGroupRowWrite(node)) return
  reportRowCount(
    node,
    operation,
    { requested, actual },
    {
      message: 'Refused a DynamicGroup row change',
      errorType: 'failure_resizing_dynamic_group_rows',
      surface: 'graph',
      level: 'warning'
    }
  )
}

/** Reports a remote DynamicGroup row count the live group did not reach. */
export function reportRemoteDynamicGroupRowMismatch(
  node: LGraphNode,
  requested: unknown,
  actual: number,
  tags: Record<string, string>
): void {
  reportRowCount(
    node,
    'remote_apply',
    { requested: typeof requested === 'number' ? requested : null, actual },
    {
      message: 'Remote DynamicGroup row count did not apply',
      errorType: 'agent_graph_dynamic_group_rows_mismatch',
      surface: 'agent',
      tags
    }
  )
}
