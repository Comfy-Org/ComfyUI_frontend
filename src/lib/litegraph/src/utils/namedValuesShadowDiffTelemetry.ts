import { getCnrIdFromNode } from '@/platform/nodeReplacement/cnrIdUtil'
import { useTelemetry } from '@/platform/telemetry'

import type { LGraphNode } from '../LGraphNode'
import type { NamedValuesShadowDiffResult } from './namedValuesShadowDiff'

const SHADOW_DIFF_SUMMARY_SAMPLE_RATE = 0.05

interface NamedValuesShadowDiffLoadAggregation {
  totalNodesChecked: number
  nodesWithMismatch: number
  mismatchedNodeTypes: Set<string>
  mismatchedPackIds: Set<string>
}

let aggregation: NamedValuesShadowDiffLoadAggregation | null = null
let loadDepth = 0

function createAggregation(): NamedValuesShadowDiffLoadAggregation {
  return {
    totalNodesChecked: 0,
    nodesWithMismatch: 0,
    mismatchedNodeTypes: new Set(),
    mismatchedPackIds: new Set()
  }
}

function getBareClassName(node: LGraphNode): string {
  const ctor = node.constructor as unknown as { name?: string }
  return ctor.name ?? 'unknown'
}

/** Call at the start of a top-level `LGraph.configure()`. Reentrant-safe for nested subgraph configures. */
export function beginNamedValuesShadowDiffLoad(): void {
  if (loadDepth === 0) aggregation = createAggregation()
  loadDepth++
}

/** Call in the matching `finally` of `LGraph.configure()`. Emits the sampled summary once the outermost call returns. */
export function endNamedValuesShadowDiffLoad(): void {
  loadDepth--
  if (loadDepth > 0) return

  const finished = aggregation
  aggregation = null
  if (!finished || finished.totalNodesChecked === 0) return
  if (Math.random() >= SHADOW_DIFF_SUMMARY_SAMPLE_RATE) return

  useTelemetry()?.trackNamedValuesShadowDiffSummary({
    total_nodes_checked: finished.totalNodesChecked,
    nodes_with_mismatch: finished.nodesWithMismatch,
    distinct_node_types: [...finished.mismatchedNodeTypes].slice(0, 20),
    distinct_pack_ids: [...finished.mismatchedPackIds].slice(0, 20)
  })
}

export function reportNamedValuesShadowDiff(
  node: LGraphNode,
  diff: NamedValuesShadowDiffResult | null,
  hadNamedField: boolean
): void {
  if (!diff) return

  const nodeType = getBareClassName(node)
  const packId = getCnrIdFromNode(node)

  if (aggregation) {
    aggregation.totalNodesChecked++
    if (diff.mismatchWidgetCount > 0) {
      aggregation.nodesWithMismatch++
      aggregation.mismatchedNodeTypes.add(nodeType)
      if (packId) aggregation.mismatchedPackIds.add(packId)
    }
  }

  if (diff.mismatchWidgetCount === 0) return

  useTelemetry()?.trackNamedValuesShadowDiffMismatch({
    node_type: nodeType,
    pack_id: packId,
    mismatch_widget_count: diff.mismatchWidgetCount,
    checked_widget_count: diff.checkedWidgetCount,
    had_named_field: hadNamedField,
    has_on_serialize_hook: typeof node.onSerialize === 'function',
    has_on_configure_hook: typeof node.onConfigure === 'function'
  })
}
