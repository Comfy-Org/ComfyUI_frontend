import { storeToRefs } from 'pinia'
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { CREDITS_PER_USD } from '@/base/credits/comfyCredits'
import { useGraphStructureRevision } from '@/composables/node/useGraphStructureRevision'
import {
  formatCreditsRangeValue,
  isApiNode,
  useNodePricing
} from '@/composables/node/useNodePricing'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { reduceAllNodes } from '@/utils/graphTraversalUtil'

type GraphCostAggregate = {
  min: number
  max: number
  hasRange: boolean
  // Count of priced api-nodes — these are the nodes contributing to min/max.
  pricedNodeCount: number
  // Count of api-nodes that are present in the graph but have no numeric
  // price to contribute (text-only pricing, pre-eval, no rule). Consumers
  // use this to tell the user the total is a lower bound.
  unpricedNodeCount: number
}

type Translate = (key: string, values?: Record<string, unknown>) => string

// Round a USD amount to the precision at which per-node pricing is shown
// (one decimal credit). Applied at display time to the final aggregate so
// that summing many sub-display-precision nodes does not collapse the
// total (100 nodes at $0.04 each would quantize to 0 credits per node and
// sum to 0 instead of the real 40 credits). Per-row displays can drift
// from the displayed total by up to ~0.05 credits per row; the total is
// mathematically correct.
const quantizeUsdToDisplayPrecision = (usd: number): number =>
  Math.round(usd * CREDITS_PER_USD * 10) / 10 / CREDITS_PER_USD

/**
 * Compact value-only representation of an aggregate: optional `~` prefix
 * for ranges, optional `+` suffix for the presence of unpriced api-nodes,
 * and the credits range itself in between. Shared by the sign-in dialog
 * total label and the actionbar chip so the two surfaces can never drift
 * (e.g. the chip showing `~76.5-104.6+` while the dialog says `~76.5-104.6`).
 */
export const formatCompactCreditRange = (
  aggregate: GraphCostAggregate
): string => {
  const prefix = aggregate.hasRange ? '~' : ''
  const suffix = aggregate.unpricedNodeCount > 0 ? '+' : ''
  return `${prefix}${formatCreditsRangeValue(aggregate.min, aggregate.max)}${suffix}`
}

/**
 * Format an aggregate for the total-cost labels used by the sign-in dialog
 * and the actionbar popover. The `t` parameter comes from `useI18n()` at the
 * call site so the composable itself stays framework-light and the single
 * source of truth for the label lives in the locale files.
 *
 * When the aggregate includes unpriced api-nodes, the label carries a `+`
 * suffix so the reader knows the total is a lower bound — "2 credits" reads
 * as exact, but "2+ credits" reads as "at least 2, and there's something we
 * couldn't count."
 *
 * Returns `null` when the aggregate has no priced nodes. A `0+ credits`
 * total is worse than no total — it reads as "free-but-not-quite" to the
 * user, whereas omitting the line reads as "we can't name a total here."
 * The two surfaces that consume this (sign-in dialog, actionbar popover)
 * both hide the total row when this returns null while still showing the
 * per-row breakdown, so unpriced-only workflows get a named list of
 * api-nodes with no misleading numeric summary.
 */
export const formatAggregateTotal = (
  aggregate: GraphCostAggregate | null,
  t: Translate
): { label: string; hasRange: boolean } | null => {
  if (!aggregate) return null
  if (aggregate.pricedNodeCount === 0) return null
  return {
    label: t('apiNodesCostBreakdown.creditsValue', {
      value: formatCompactCreditRange(aggregate)
    }),
    hasRange: aggregate.hasRange
  }
}

/**
 * Aggregate the numeric cost of every priced api-node in a graph hierarchy.
 *
 * Walks the graph (including subgraphs) via `reduceAllNodes` and sums the
 * `{min, max}` USD bounds from `useNodePricing().getNodeNumericPrice` for
 * each priced api-node. Api-nodes without a numeric price (text-only
 * pricing, pre-eval, no rule) are counted separately on `unpricedNodeCount`
 * so consumers can surface the fact that the numeric total isn't complete.
 *
 * Sums the raw USD bounds and applies display-precision quantization once
 * at the end; `hasRange` derives from the quantized final bounds so the
 * `~` prefix on the total only appears when the displayed total actually
 * spans more than one credit (quantization can collapse a raw range to a
 * flat value).
 *
 * Returns `null` when the graph is absent or contains no api-nodes at all.
 * A graph with only unpriced api-nodes still returns a non-null aggregate
 * so the UI can render the breakdown (with a `+` suffix on the total label
 * from `formatAggregateTotal`).
 */
export const useGraphCostAggregator = (
  graph: MaybeRefOrGetter<LGraph | Subgraph | null | undefined>
) => {
  const { getNodeNumericPrice, pricingAggregateRevision } = useNodePricing()
  const graphStructureRevision = useGraphStructureRevision(graph)
  // Workflow swaps mutate the existing LGraph in place rather than creating
  // a new instance, so subscribing to graph identity alone won't catch
  // "this workflow has fewer (or zero) api-nodes than the previous one."
  // activeWorkflow reassigns on every load — reading it here threads that
  // event into the computed's dep graph.
  const { activeWorkflow } = storeToRefs(useWorkflowStore())

  return computed<GraphCostAggregate | null>(() => {
    // Reactive deps: any node's eval completion (coarse aggregate signal —
    // see useNodePricing for why this is separate from the canvas tick),
    // in-place node add/remove, and workflow swap (replace LGraph contents
    // in place).
    void pricingAggregateRevision.value
    void graphStructureRevision.value
    void activeWorkflow.value

    const resolved = toValue(graph)
    if (!resolved) return null

    // Mutate the accumulator instead of returning a fresh object per node.
    // The accumulator is private to this reduce — no aliasing risk — and a
    // 50-node graph at 30fps recompute saves ~1500 short-lived allocations
    // per second.
    const raw = reduceAllNodes<{
      min: number
      max: number
      pricedNodeCount: number
      unpricedNodeCount: number
    }>(
      resolved,
      (acc, node) => {
        if (!isApiNode(node)) return acc
        const price = getNodeNumericPrice(node)
        if (price === null) {
          acc.unpricedNodeCount++
          return acc
        }
        acc.min += price.min
        acc.max += price.max
        acc.pricedNodeCount++
        return acc
      },
      { min: 0, max: 0, pricedNodeCount: 0, unpricedNodeCount: 0 }
    )

    if (raw.pricedNodeCount === 0 && raw.unpricedNodeCount === 0) return null

    const qMin = quantizeUsdToDisplayPrecision(raw.min)
    const qMax = quantizeUsdToDisplayPrecision(raw.max)
    return {
      min: qMin,
      max: qMax,
      hasRange: qMin !== qMax,
      pricedNodeCount: raw.pricedNodeCount,
      unpricedNodeCount: raw.unpricedNodeCount
    }
  })
}
