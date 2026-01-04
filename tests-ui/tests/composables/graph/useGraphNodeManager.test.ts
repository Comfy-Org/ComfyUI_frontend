import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, watch } from 'vue'

import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'

setActivePinia(createTestingPinia())

function createTestGraph() {
  const graph = new LGraph()
  const node = new LGraphNode('test')
  node.addInput('input', 'INT')
  node.addWidget('number', 'testnum', 2, () => undefined, {})
  graph.add(node)

  const { vueNodeData } = useGraphNodeManager(graph)
  const onReactivityUpdate = vi.fn()
  watch(vueNodeData, onReactivityUpdate)

  return [node, graph, onReactivityUpdate] as const
}

describe('Node Reactivity', () => {
  it('should trigger on callback', async () => {
    const [node, , onReactivityUpdate] = createTestGraph()

    node.widgets![0].callback!(2)
    await nextTick()
    expect(onReactivityUpdate).toHaveBeenCalledTimes(1)
  })

  it('should remain reactive after a connection is made', async () => {
    const [node, graph, onReactivityUpdate] = createTestGraph()

    graph.trigger('node:slot-links:changed', {
      nodeId: '1',
      slotType: NodeSlotType.INPUT
    })
    await nextTick()
    onReactivityUpdate.mockClear()

    node.widgets![0].callback!(2)
    await nextTick()
    expect(onReactivityUpdate).toHaveBeenCalledTimes(1)
  })
})
