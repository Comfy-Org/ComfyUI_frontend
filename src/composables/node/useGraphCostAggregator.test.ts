import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  createApiNode,
  createPlainNode,
  flushPricingEval,
  makeGraph,
  priceBadge,
  resetNodeIds
} from '@/composables/node/__tests__/pricingTestHelpers'
import {
  formatAggregateTotal,
  useGraphCostAggregator
} from '@/composables/node/useGraphCostAggregator'
import { useNodePricing } from '@/composables/node/useNodePricing'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockSubgraphNode } from '@/utils/__tests__/litegraphTestUtils'

// Shape-preserving stub for vue-i18n `t`. Substitutes {value} tokens so
// tests can still assert the numeric payload without loading the full
// i18n runtime.
const mockT = (key: string, values?: Record<string, unknown>): string => {
  if (key === 'apiNodesCostBreakdown.creditsValue') {
    return `${values?.value ?? ''} credits`
  }
  return key
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useGraphCostAggregator', () => {
  beforeEach(() => {
    // The aggregator reads workflowStore.activeWorkflow as an invalidation
    // signal; stores require a Pinia instance to resolve.
    setActivePinia(createPinia())
    resetNodeIds()
  })

  it('returns null for an empty graph', () => {
    const aggregate = useGraphCostAggregator(makeGraph([]))
    expect(aggregate.value).toBeNull()
  })

  it('returns null when the graph reference is null', () => {
    const aggregate = useGraphCostAggregator(null)
    expect(aggregate.value).toBeNull()
  })

  // The aggregator sums raw USD bounds across every priced api-node and
  // quantizes to display precision (one decimal credit) once at the end.
  // The final quantization introduces sub-cent drift vs the raw inputs,
  // so assertions use closeTo rather than exact equality. A dedicated
  // regression test below (`sums many sub-display-precision nodes...`)
  // locks in this "sum raw, quantize last" order — summing quantized
  // per-node values would collapse sub-display bounds to zero.

  it('sums a single api-node with static usd pricing', async () => {
    const graph = makeGraph([
      createApiNode('StaticOne', priceBadge('{"type":"usd","usd":0.10}'))
    ])
    const aggregate = useGraphCostAggregator(graph)

    void aggregate.value // schedule eval
    await flushPricingEval()

    expect(aggregate.value).toEqual({
      min: expect.closeTo(0.1, 2),
      max: expect.closeTo(0.1, 2),
      hasRange: false,
      pricedNodeCount: 1,
      unpricedNodeCount: 0
    })
  })

  it('ignores non-api-nodes when aggregating', async () => {
    const graph = makeGraph([
      createApiNode('ApiOne', priceBadge('{"type":"usd","usd":0.05}')),
      createPlainNode('RegularNode'),
      createPlainNode('AnotherRegular')
    ])
    const aggregate = useGraphCostAggregator(graph)

    void aggregate.value
    await flushPricingEval()

    expect(aggregate.value).toEqual({
      min: expect.closeTo(0.05, 2),
      max: expect.closeTo(0.05, 2),
      hasRange: false,
      pricedNodeCount: 1,
      unpricedNodeCount: 0
    })
  })

  it('marks hasRange true for range-priced nodes', async () => {
    const graph = makeGraph([
      createApiNode(
        'RangeNode',
        priceBadge('{"type":"range_usd","min_usd":0.05,"max_usd":0.20}')
      )
    ])
    const aggregate = useGraphCostAggregator(graph)

    void aggregate.value
    await flushPricingEval()

    expect(aggregate.value).toEqual({
      min: expect.closeTo(0.05, 2),
      max: expect.closeTo(0.2, 2),
      hasRange: true,
      pricedNodeCount: 1,
      unpricedNodeCount: 0
    })
  })

  it('clamps inverted min_usd > max_usd from a malformed range_usd rule', async () => {
    // Regression guard for extractNumericPrice's Math.min/max clamp.
    // JSONata can emit { min_usd: 0.20, max_usd: 0.05 } from a swapped-
    // fields or off-by-one branch. Without the clamp, the aggregator
    // would feed an inverted range into hasRange (it would still flip
    // true) and the chip would render `~104.6-42.2` — credit text that
    // reads larger-then-smaller. The fix swaps min/max at extraction so
    // downstream consumers always see well-ordered bounds.
    const graph = makeGraph([
      createApiNode(
        'InvertedRangeNode',
        priceBadge('{"type":"range_usd","min_usd":0.20,"max_usd":0.05}')
      )
    ])
    const aggregate = useGraphCostAggregator(graph)

    void aggregate.value
    await flushPricingEval()

    expect(aggregate.value).toEqual({
      min: expect.closeTo(0.05, 2),
      max: expect.closeTo(0.2, 2),
      hasRange: true,
      pricedNodeCount: 1,
      unpricedNodeCount: 0
    })
  })

  it('sums many sub-display-precision nodes without collapsing to zero', async () => {
    // Regression guard for the quantize-after-sum contract. Each node
    // priced at $0.04 quantizes to 0 credits individually (below the
    // one-decimal-credit display precision), so a sum-quantized-per-node
    // aggregator would total zero. The aggregator stores raw USD, so the
    // real total is 50 × $0.04 = $2.00 (rendered by the display layer as
    // 422 credits at CREDITS_PER_USD=211). If someone "fixes" the
    // aggregator to match per-row displays by quantizing-before-summing,
    // this test catches it.
    const nodes = Array.from({ length: 50 }, (_, i) =>
      createApiNode(`SubDisplay${i}`, priceBadge('{"type":"usd","usd":0.04}'))
    )
    const graph = makeGraph(nodes)
    const aggregate = useGraphCostAggregator(graph)

    void aggregate.value
    await flushPricingEval()

    expect(aggregate.value?.min).toBeCloseTo(2.0, 2)
    expect(aggregate.value?.max).toBeCloseTo(2.0, 2)
    expect(aggregate.value?.pricedNodeCount).toBe(50)
    expect(aggregate.value?.min).toBeGreaterThan(0)
  })

  it('sums two api-nodes and preserves hasRange across them', async () => {
    const graph = makeGraph([
      createApiNode('FlatNode', priceBadge('{"type":"usd","usd":0.10}')),
      createApiNode(
        'SpreadNode',
        priceBadge('{"type":"range_usd","min_usd":0.05,"max_usd":0.15}')
      )
    ])
    const aggregate = useGraphCostAggregator(graph)

    void aggregate.value
    await flushPricingEval()

    expect(aggregate.value).toEqual({
      min: expect.closeTo(0.15, 2),
      max: expect.closeTo(0.25, 2),
      hasRange: true,
      pricedNodeCount: 2,
      unpricedNodeCount: 0
    })
  })

  it('folds list_usd pricing as alternatives-pick-one (bounds span cheapest/most-expensive choice)', async () => {
    // Regression guard: list_usd's semantic is "user picks one option of
    // several" — think quality presets or model-size dropdowns — so the
    // aggregate bounds should be [min, max] of the list, not a sum.
    // A summing fold would over-report the cost of every workflow that
    // uses a list-priced node by N-1× the average-per-choice. Test with
    // a 3-option list: the bounds should be the first and last values.
    const graph = makeGraph([
      createApiNode(
        'ListPriced',
        priceBadge('{"type":"list_usd","usd":[0.05,0.10,0.20]}')
      )
    ])
    const aggregate = useGraphCostAggregator(graph)

    void aggregate.value
    await flushPricingEval()

    expect(aggregate.value).toEqual({
      min: expect.closeTo(0.05, 2),
      max: expect.closeTo(0.2, 2),
      hasRange: true,
      pricedNodeCount: 1,
      unpricedNodeCount: 0
    })
  })

  it('sums list_usd bounds across multiple nodes rather than flattening them', async () => {
    // Two list-priced nodes in the same graph should have their per-node
    // bounds sum into the aggregate; the fold stays alternatives-pick-one
    // at the node level but the graph-level total is still the sum of
    // each node's chosen cost.
    const graph = makeGraph([
      createApiNode(
        'ListPricedA',
        priceBadge('{"type":"list_usd","usd":[0.05,0.10]}')
      ),
      createApiNode(
        'ListPricedB',
        priceBadge('{"type":"list_usd","usd":[0.20,0.30]}')
      )
    ])
    const aggregate = useGraphCostAggregator(graph)

    void aggregate.value
    await flushPricingEval()

    // node A: [0.05, 0.10], node B: [0.20, 0.30] → sum: [0.25, 0.40]
    expect(aggregate.value).toEqual({
      min: expect.closeTo(0.25, 2),
      max: expect.closeTo(0.4, 2),
      hasRange: true,
      pricedNodeCount: 2,
      unpricedNodeCount: 0
    })
  })

  it('recurses into subgraphs when counting api-nodes', async () => {
    const innerApi = createApiNode(
      'InnerPriced',
      priceBadge('{"type":"usd","usd":0.08}')
    )
    const subgraphNode = createMockSubgraphNode([innerApi])
    const outerApi = createApiNode(
      'OuterPriced',
      priceBadge('{"type":"usd","usd":0.02}')
    )
    const graph = makeGraph([outerApi, subgraphNode])

    const aggregate = useGraphCostAggregator(graph)

    void aggregate.value
    await flushPricingEval()

    expect(aggregate.value).toEqual({
      min: expect.closeTo(0.1, 2),
      max: expect.closeTo(0.1, 2),
      hasRange: false,
      pricedNodeCount: 2,
      unpricedNodeCount: 0
    })
  })

  it('counts api-nodes with text pricing as unpriced rather than skipping them', async () => {
    // Regression guard: text-priced api-nodes used to be invisible to the
    // aggregator, which made the total look exact even when the graph
    // contained a node whose cost couldn't be summed. The aggregator now
    // tracks unpricedNodeCount separately so consumers can render a "+"
    // suffix on the total to indicate a lower bound.
    const graph = makeGraph([
      createApiNode('PricedOne', priceBadge('{"type":"usd","usd":0.05}')),
      createApiNode(
        'TextPriced',
        priceBadge('{"type":"text","text":"Varies by resolution"}')
      )
    ])
    const aggregate = useGraphCostAggregator(graph)

    void aggregate.value
    await flushPricingEval()

    expect(aggregate.value).toEqual({
      min: expect.closeTo(0.05, 2),
      max: expect.closeTo(0.05, 2),
      hasRange: false,
      pricedNodeCount: 1,
      unpricedNodeCount: 1
    })
  })

  it('returns a non-null aggregate when only unpriced api-nodes exist', async () => {
    // A workflow composed entirely of text-priced api-nodes should still
    // produce an aggregate (with zero min/max and a positive unpriced
    // count) so the UI can surface "+N nodes, cost unknown" rather than
    // hiding the chip entirely.
    const graph = makeGraph([
      createApiNode('TextOnly', priceBadge('{"type":"text","text":"Varies"}'))
    ])
    const aggregate = useGraphCostAggregator(graph)

    void aggregate.value
    await flushPricingEval()

    expect(aggregate.value).toEqual({
      min: 0,
      max: 0,
      hasRange: false,
      pricedNodeCount: 0,
      unpricedNodeCount: 1
    })
  })

  it('derives hasRange from quantized bounds rather than raw bounds', async () => {
    // Regression guard: if per-node bounds differ at sub-display precision
    // (e.g. 0.00012 vs 0.00015 USD), quantization collapses them to the
    // same displayed credit value. hasRange must follow the quantized
    // bounds so the "~" prefix on the total only appears when the
    // displayed total actually spans more than one credit.
    const graph = makeGraph([
      createApiNode(
        'SubDisplayRange',
        priceBadge('{"type":"range_usd","min_usd":0.00012,"max_usd":0.00015}')
      )
    ])
    const aggregate = useGraphCostAggregator(graph)

    void aggregate.value
    await flushPricingEval()

    expect(aggregate.value?.hasRange).toBe(false)
    expect(aggregate.value?.pricedNodeCount).toBe(1)
  })

  it('skips api-nodes whose async evaluation has not yet produced a value', () => {
    // First synchronous access returns null: eval is scheduled but not resolved.
    const graph = makeGraph([
      createApiNode('PendingNode', priceBadge('{"type":"usd","usd":0.05}'))
    ])
    const aggregate = useGraphCostAggregator(graph)

    // Synchronous read: the node is api_node: true with an eval pending,
    // so it lands in unpricedNodeCount rather than the null-return path.
    expect(aggregate.value).toEqual({
      min: 0,
      max: 0,
      hasRange: false,
      pricedNodeCount: 0,
      unpricedNodeCount: 1
    })
  })

  it('recomputes when a widget-signature change forces re-evaluation', async () => {
    const badge = priceBadge('{"type":"usd","usd": widgets.count * 0.01}', [
      { name: 'count', type: 'INT' }
    ])
    const node = createApiNode('DynamicNode', badge, [
      { name: 'count', value: 5 }
    ])
    const graph = makeGraph([node])
    const aggregate = useGraphCostAggregator(graph)

    void aggregate.value
    await flushPricingEval()
    expect(aggregate.value).toEqual({
      min: expect.closeTo(0.05, 2),
      max: expect.closeTo(0.05, 2),
      hasRange: false,
      pricedNodeCount: 1,
      unpricedNodeCount: 0
    })

    // Mutate widget value — signature changes, cache entry becomes stale.
    node.widgets![0].value = 20

    // Plain-object mutation is not reactive; the aggregate computed stays cached
    // until pricingRevision bumps. In production, upstream widget-change handlers
    // call triggerPriceRecalculation / getNodeNumericPrice to schedule a fresh
    // evaluation, whose resolution bumps pricingRevision. Do the same here.
    const { getNodeNumericPrice } = useNodePricing()
    getNodeNumericPrice(node)
    await flushPricingEval()

    expect(aggregate.value).toEqual({
      min: expect.closeTo(0.2, 2),
      max: expect.closeTo(0.2, 2),
      hasRange: false,
      pricedNodeCount: 1,
      unpricedNodeCount: 0
    })
  })

  it('invalidates when workflowStore.activeWorkflow changes, even if the graph instance is reused', async () => {
    // Regression guard: ComfyApp reuses a single LGraph instance and
    // repopulates it with each loaded workflow; `app.rootGraph`'s identity
    // never changes. If a user swaps from a workflow with priced api-nodes
    // to one with zero, the aggregator must still invalidate. The fix
    // wires activeWorkflow as an internal dep; this test locks that in.
    const { useWorkflowStore } =
      await import('@/platform/workflow/management/stores/workflowStore')
    const workflowStore = useWorkflowStore()

    const graph = makeGraph([
      createApiNode('PricedOnce', priceBadge('{"type":"usd","usd":0.10}'))
    ])
    const aggregate = useGraphCostAggregator(graph)

    void aggregate.value
    await flushPricingEval()
    expect(aggregate.value).not.toBeNull()

    // Swap graph contents in place and bump activeWorkflow — this is what
    // ComfyApp.loadGraphData does in production (content swap, not reference
    // swap). Without the activeWorkflow dep, the aggregator would stay stuck
    // at the previous non-null value because pricingTick never bumps for a
    // graph with no api-nodes.
    ;(graph as unknown as { nodes: LGraphNode[] }).nodes = []
    workflowStore.activeWorkflow = {
      path: 'different',
      key: 'different'
    } as unknown as typeof workflowStore.activeWorkflow

    // Allow Vue to flush the reactive update.
    await flushPricingEval()
    expect(aggregate.value).toBeNull()
  })

  it('recomputes in VueNodes mode when async evaluation completes', async () => {
    // Regression guard: scheduleEvaluation previously bumped only the
    // per-node revision ref in VueNodes mode, leaving pricingTick frozen.
    // useGraphCostAggregator subscribes to pricingAggregateRevision
    // (intentionally coarse — any node's eval completing should wake the
    // total), so under VueNodes mode the aggregate would stay null forever
    // on first dialog open. This test locks the fix in.
    const originalMode = LiteGraph.vueNodesMode
    LiteGraph.vueNodesMode = true
    try {
      const graph = makeGraph([
        createApiNode(
          'VueNodeModeTest',
          priceBadge('{"type":"usd","usd":0.10}')
        )
      ])
      const aggregate = useGraphCostAggregator(graph)

      // Synchronous first access triggers eval scheduling; the aggregate
      // reports the node as unpriced until the async cache populates.
      expect(aggregate.value?.unpricedNodeCount).toBe(1)

      await flushPricingEval()

      expect(aggregate.value).toEqual({
        min: expect.closeTo(0.1, 2),
        max: expect.closeTo(0.1, 2),
        hasRange: false,
        pricedNodeCount: 1,
        unpricedNodeCount: 0
      })
    } finally {
      LiteGraph.vueNodesMode = originalMode
    }
  })
})

describe('formatAggregateTotal', () => {
  it('returns null for a null aggregate', () => {
    expect(formatAggregateTotal(null, mockT)).toBeNull()
  })

  it('renders a flat total without the range prefix', () => {
    const result = formatAggregateTotal(
      {
        min: 0.1,
        max: 0.1,
        hasRange: false,
        pricedNodeCount: 1,
        unpricedNodeCount: 0
      },
      mockT
    )
    expect(result?.hasRange).toBe(false)
    expect(result?.label.startsWith('~')).toBe(false)
    expect(result?.label).not.toContain('+')
  })

  it('renders a ranged total with the approximate prefix', () => {
    const result = formatAggregateTotal(
      {
        min: 0.1,
        max: 0.3,
        hasRange: true,
        pricedNodeCount: 2,
        unpricedNodeCount: 0
      },
      mockT
    )
    expect(result?.hasRange).toBe(true)
    expect(result?.label.startsWith('~')).toBe(true)
  })

  it('appends a + suffix when the aggregate includes unpriced api-nodes', () => {
    const result = formatAggregateTotal(
      {
        min: 0.05,
        max: 0.05,
        hasRange: false,
        pricedNodeCount: 1,
        unpricedNodeCount: 1
      },
      mockT
    )
    expect(result?.label).toContain('+')
  })

  it('returns null when the aggregate has no priced nodes', () => {
    // A "0+ credits" total reads as "free-but-not-quite" to users;
    // omitting the total row reads correctly as "we can't name a total
    // here." Consumers (sign-in dialog, actionbar popover) both hide the
    // total row on null while still rendering the per-row breakdown, so
    // unpriced-only workflows surface a named list without a misleading
    // numeric summary.
    const result = formatAggregateTotal(
      {
        min: 0,
        max: 0,
        hasRange: false,
        pricedNodeCount: 0,
        unpricedNodeCount: 2
      },
      mockT
    )
    expect(result).toBeNull()
  })

  it('delegates the final "N credits" wrap to the i18n translate function', () => {
    // The composable no longer hardcodes "credits" — proof that swapping
    // the translate function gives us a localized label with the numeric
    // payload substituted back in.
    const frenchT = (key: string, values?: Record<string, unknown>): string =>
      key === 'apiNodesCostBreakdown.creditsValue'
        ? `${values?.value ?? ''} crédits`
        : key
    const result = formatAggregateTotal(
      {
        min: 0.1,
        max: 0.1,
        hasRange: false,
        pricedNodeCount: 1,
        unpricedNodeCount: 0
      },
      frenchT
    )
    expect(result?.label.endsWith(' crédits')).toBe(true)
  })
})
