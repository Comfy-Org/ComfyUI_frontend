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
import { useApiNodeRows } from '@/composables/node/useApiNodeRows'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { createMockSubgraphNode } from '@/utils/__tests__/litegraphTestUtils'

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useApiNodeRows', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetNodeIds()
  })

  it('returns an empty array for a null graph', () => {
    const rows = useApiNodeRows(null)
    expect(rows.value).toEqual([])
  })

  it('emits a row per api-node and skips non-api-nodes', async () => {
    const graph = makeGraph([
      createApiNode('ApiOne', priceBadge('{"type":"usd","usd":0.05}')),
      createPlainNode('Plain'),
      createApiNode('ApiTwo', priceBadge('{"type":"usd","usd":0.10}'))
    ])
    const rows = useApiNodeRows(graph)

    // Trigger evaluation, then wait for the aggregate tick to wake the computed.
    void rows.value
    await flushPricingEval()

    expect(rows.value.length).toBe(2)
    expect(rows.value.every((r) => r.name.startsWith('Api'))).toBe(true)
  })

  it('updates row labels in VueNodes mode after async eval completes', async () => {
    // Regression guard: useApiNodeRows previously subscribed to
    // pricingRevision (the canvas tick, Nodes-1.0-only). In VueNodes
    // mode pricingTick never bumps, so row labels stayed blank even
    // though async pricing had resolved. The fix switches the dep to
    // pricingAggregateRevision. If that regresses, the cost column
    // will be null after the flush below.
    const originalMode = LiteGraph.vueNodesMode
    LiteGraph.vueNodesMode = true
    try {
      const graph = makeGraph([
        createApiNode('VueNodePriced', priceBadge('{"type":"usd","usd":0.10}'))
      ])
      const rows = useApiNodeRows(graph)

      // Synchronous first read: cache miss, eval scheduled, cost null.
      expect(rows.value[0]?.cost).toBeNull()

      await flushPricingEval()

      // After async resolution, pricingAggregateRevision bumps and the
      // computed re-runs. The row now carries a non-null label — proving
      // the composable wakes up in VueNodes mode.
      expect(rows.value[0]?.cost).not.toBeNull()
      expect(rows.value[0]?.cost).toMatch(/\d/)
    } finally {
      LiteGraph.vueNodesMode = originalMode
    }
  })

  it('includes node id in the row shape for stable Vue keys', async () => {
    // Two nodes of the same type share a name but have distinct ids.
    const graph = makeGraph([
      createApiNode('SameName', priceBadge('{"type":"usd","usd":0.05}')),
      createApiNode('SameName', priceBadge('{"type":"usd","usd":0.05}'))
    ])
    const rows = useApiNodeRows(graph)
    void rows.value
    await flushPricingEval()

    expect(rows.value.length).toBe(2)
    const ids = rows.value.map((r) => r.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('dedupes rows when two SubgraphNode hosts reference the same Subgraph instance', async () => {
    // Regression guard: `reduceAllNodes` uses path-local visited semantics
    // so cost aggregation can re-traverse shared subgraph contents (N hosts
    // → N executions → cost counts N×). The row list, however, is "what API
    // endpoints will run" — a set, not a multiset. Without identity-dedupe
    // the same LGraphNode object would emit two rows with identical synthetic
    // graph ids and identical node ids → duplicate Vue keys → row-reuse glitches
    // and console warnings. The composable's `seen` set must collapse them
    // back to one row.
    const sharedInnerApi = createApiNode(
      'SharedInner',
      priceBadge('{"type":"usd","usd":0.05}')
    )
    sharedInnerApi.id = 99
    const sharedSubgraph = { nodes: [sharedInnerApi] } as unknown as LGraph
    sharedInnerApi.graph = sharedSubgraph

    const hostA = createMockSubgraphNode([])
    hostA.id = 1
    Object.assign(hostA, { subgraph: sharedSubgraph })

    const hostB = createMockSubgraphNode([])
    hostB.id = 2
    Object.assign(hostB, { subgraph: sharedSubgraph })

    const graph = makeGraph([hostA, hostB])
    const rows = useApiNodeRows(graph)
    void rows.value
    await flushPricingEval()

    expect(rows.value.length).toBe(1)
    expect(rows.value[0]?.name).toBe('SharedInner')
  })

  it('namespaces row ids so subgraph nodes do not collide with root-level ids', async () => {
    // Regression guard: reduceAllNodes flattens the hierarchy, and
    // LiteGraph node IDs are scoped per graph. A subgraph api-node can
    // share a numeric id with one at the root; without a graph-level
    // prefix, Vue emits duplicate-key warnings and recycles DOM rows
    // incorrectly. Row ids must be unique across the full traversal.
    const rootGraphMarker = { id: 'root-graph' } as unknown as LGraph
    const subgraphMarker = { id: 'sub-graph' } as unknown as LGraph

    const rootApi = createApiNode(
      'RootLevel',
      priceBadge('{"type":"usd","usd":0.05}')
    )
    rootApi.id = 42
    rootApi.graph = rootGraphMarker

    const innerApi = createApiNode(
      'InnerLevel',
      priceBadge('{"type":"usd","usd":0.05}')
    )
    innerApi.id = 42 // intentional collision — different graph scope
    innerApi.graph = subgraphMarker

    const graph = makeGraph([rootApi, createMockSubgraphNode([innerApi])])
    const rows = useApiNodeRows(graph)
    void rows.value
    await flushPricingEval()

    expect(rows.value.length).toBe(2)
    const ids = rows.value.map((r) => r.id)
    expect(new Set(ids).size).toBe(2)
  })
})
