import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import { useViewErrorsInGraph } from './useViewErrorsInGraph'

vi.mock(import('@/scripts/api'))

vi.mock(import('@/scripts/app'))

function createSelectedCanvas() {
  const graph = new LGraph()
  const canvasElement = document.createElement('canvas')
  canvasElement.width = 800
  canvasElement.height = 600
  canvasElement.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())

  const canvas = new LGraphCanvas(canvasElement, graph, {
    skip_events: true,
    skip_render: true
  })
  const node = new LGraphNode('Selected Node')
  graph.add(node)
  canvas.select(node)

  return { canvas, node }
}

describe('useViewErrorsInGraph', () => {
  it('opens graph errors and clears app-mode error UI state', async () => {
    const canvasStore = useCanvasStore()
    const executionErrorStore = useExecutionErrorStore()
    const rightSidePanelStore = useRightSidePanelStore()
    const workflowStore = useWorkflowStore()
    const { canvas, node } = createSelectedCanvas()
    workflowStore.activeWorkflow = {
      activeMode: 'app'
    } as typeof workflowStore.activeWorkflow
    canvasStore.canvas = canvas
    await nextTick()
    expect(canvasStore.selectedItems).toEqual([node])
    executionErrorStore.showErrorOverlay()

    useViewErrorsInGraph().viewErrorsInGraph(['execution:out_of_memory'])

    expect(node.selected).toBe(false)
    expect(canvasStore.linearMode).toBe(false)
    expect(canvasStore.selectedItems).toEqual([])
    expect(rightSidePanelStore.activeTab).toBe('errors')
    expect(rightSidePanelStore.isOpen).toBe(true)
    expect(rightSidePanelStore.errorDetailsRequest).toEqual([
      'execution:out_of_memory'
    ])
    expect(executionErrorStore.isErrorOverlayOpen).toBe(false)
  })

  it('opens graph errors when the canvas is not initialized', () => {
    const canvasStore = useCanvasStore()
    const executionErrorStore = useExecutionErrorStore()
    const rightSidePanelStore = useRightSidePanelStore()
    canvasStore.canvas = null
    executionErrorStore.showErrorOverlay()

    expect(() => useViewErrorsInGraph().viewErrorsInGraph()).not.toThrow()

    expect(rightSidePanelStore.activeTab).toBe('errors')
    expect(rightSidePanelStore.isOpen).toBe(true)
    expect(rightSidePanelStore.errorDetailsRequest).toEqual([])
    expect(executionErrorStore.isErrorOverlayOpen).toBe(false)
  })

  it('drops a details request when the user leaves the errors tab before it opens', async () => {
    const rightSidePanelStore = useRightSidePanelStore()

    useViewErrorsInGraph().viewErrorsInGraph(['missing_node'])
    rightSidePanelStore.activeTab = 'parameters'
    await nextTick()

    expect(rightSidePanelStore.errorDetailsRequest).toBeNull()
  })
})
