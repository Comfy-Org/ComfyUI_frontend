import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

async function loadPrimitiveNode() {
  return (await import('./widgetInputs')).PrimitiveNode
}

describe('PrimitiveNode', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('resets itself when the store reports a link the graph cannot resolve', async () => {
    const PrimitiveNode = await loadPrimitiveNode()
    const graph = new LGraph()
    const node = new PrimitiveNode('Primitive')
    graph.add(node)
    useLinkStore().registerLink(graphScopeOf(graph), {
      id: toLinkId(999),
      originNodeId: node.id,
      originSlot: 0,
      targetNodeId: toNodeId(42),
      targetSlot: 0,
      type: '*'
    })
    const onLastDisconnect = vi.spyOn(node, 'onLastDisconnect')

    node.onAfterGraphConfigured()

    expect(onLastDisconnect).toHaveBeenCalled()
  }, 30_000)
})
