import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import { useFocusNode } from '@/composables/canvas/useFocusNode'
import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

function createMockNode(boundingRect: [number, number, number, number]) {
  const graph = {} as LGraph
  return {
    graph,
    boundingRect
  } as unknown as LGraphNode
}

describe('useFocusNode', () => {
  it('animates the canvas to the node bounds when the node is on the current graph', async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const canvasStore = useCanvasStore()
    const node = createMockNode([10, 20, 100, 80])
    const animateToBounds = vi.fn()
    canvasStore.canvas = {
      graph: node.graph,
      animateToBounds
    } as unknown as LGraphCanvas

    const { focusNodeInstance } = useFocusNode()
    await focusNodeInstance(node)

    expect(animateToBounds).toHaveBeenCalledWith(node.boundingRect)
  })

  it('does nothing when there is no active canvas', async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const node = createMockNode([0, 0, 10, 10])

    const { focusNodeInstance } = useFocusNode()

    await expect(focusNodeInstance(node)).resolves.toBeUndefined()
  })
})
