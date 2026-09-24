import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { graphScopeOf } from '@/types/graphScopeId'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportError
}))
vi.mock(import('@/services/litegraphService'))

// Rules out one hypothesis for the tab-switch node loss: that graph.serialize()
// silently drops a node whose nodeDataStore record is already gone. It does
// not — this pins the store/telemetry-owned side of that investigation,
// moved out of src/lib/litegraph (see LGraph.tabSwitchSnapshot.test.ts for
// the pure library-boundary half).
describe('LGraph serialize when the node data store has already diverged', () => {
  it('still emits a live node whose store record is gone, and reports the divergence', () => {
    const graph = new LGraph()
    const kept = new LGraphNode('kept')
    const divergent = new LGraphNode('divergent')
    graph.add(kept)
    graph.add(divergent)
    expect(
      useNodeDataStore().deleteNode(graphScopeOf(graph), divergent._state)
    ).toBe(true)

    const snapshot = graph.serialize()

    expect(snapshot.nodes.map((node) => String(node.id))).toEqual([
      String(kept.id),
      String(divergent.id)
    ])
    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'graph_serialization_state_mismatch'
      })
    )
  })
})
