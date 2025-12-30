import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, watch } from 'vue'

import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'

setActivePinia(createTestingPinia())

describe('Node Reactivity', () => {
  it('should trigger on callback', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('input', 'INT')
    node.addWidget('number', 'testnum', 2, () => undefined, {})
    graph.add(node)

    const { vueNodeData } = useGraphNodeManager(graph)
    const onReactivityUpdate = vi.fn()
    watch(vueNodeData, onReactivityUpdate)
    expect(onReactivityUpdate).toHaveBeenCalledTimes(0)

    node.widgets![0].callback!(2)
    await nextTick()
    expect(onReactivityUpdate).toHaveBeenCalledTimes(1)
  })
  it('should remain reactive after a connection is made', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('input', 'INT')
    node.addWidget('number', 'testnum', 2, () => undefined, {})
    graph.add(node)

    const { vueNodeData } = useGraphNodeManager(graph)
    const onReactivityUpdate = vi.fn()
    graph.trigger('node:slot-links:changed', {
      nodeId: '1',
      slotType: NodeSlotType.INPUT
    })
    watch(vueNodeData, onReactivityUpdate)

    node.widgets![0].callback!(2)
    await nextTick()
    expect(onReactivityUpdate).toHaveBeenCalledTimes(1)
  })
})
