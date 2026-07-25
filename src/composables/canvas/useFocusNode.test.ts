import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import { useFocusNode } from '@/composables/canvas/useFocusNode'
import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { useAgentPanelStore } from '@/platform/agent/stores/agentPanelStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

function createMockNode(boundingRect: [number, number, number, number]) {
  const graph = {} as LGraph
  return {
    graph,
    boundingRect
  } as unknown as LGraphNode
}

function mockCanvas(animateToBounds: ReturnType<typeof vi.fn>, graph: LGraph) {
  return {
    graph,
    canvas: { width: 1600, height: 900 },
    animateToBounds
  } as unknown as LGraphCanvas
}

describe('useFocusNode', () => {
  it('centers on the full canvas when the agent panel is closed', async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const canvasStore = useCanvasStore()
    const node = createMockNode([10, 20, 100, 80])
    const animateToBounds = vi.fn()
    canvasStore.canvas = mockCanvas(animateToBounds, node.graph as LGraph)

    const { focusNodeInstance } = useFocusNode()
    await focusNodeInstance(node)

    expect(animateToBounds).toHaveBeenCalledWith(node.boundingRect, {
      viewport: [0, 0, 1600, 900]
    })
  })

  it('excludes the agent panel width so the node centers in the visible area', async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const canvasStore = useCanvasStore()
    const agentPanelStore = useAgentPanelStore()
    agentPanelStore.isOpen = true
    agentPanelStore.width = 500
    const node = createMockNode([10, 20, 100, 80])
    const animateToBounds = vi.fn()
    canvasStore.canvas = mockCanvas(animateToBounds, node.graph as LGraph)

    const { focusNodeInstance } = useFocusNode()
    await focusNodeInstance(node)

    expect(animateToBounds).toHaveBeenCalledWith(node.boundingRect, {
      viewport: [0, 0, 1100, 900]
    })
  })

  it('does nothing when there is no active canvas', async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const node = createMockNode([0, 0, 10, 10])

    const { focusNodeInstance } = useFocusNode()

    await expect(focusNodeInstance(node)).resolves.toBeUndefined()
  })
})
