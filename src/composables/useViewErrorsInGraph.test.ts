import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import { useViewErrorsInGraph } from './useViewErrorsInGraph'

const apiMock = vi.hoisted(() => ({
  getSettings: vi.fn(),
  storeSetting: vi.fn(),
  storeSettings: vi.fn()
}))

vi.mock('@/scripts/api', () => ({
  api: apiMock
}))

const appMock = vi.hoisted(() => ({
  ui: {
    settings: {
      dispatchChange: vi.fn()
    }
  },
  rootGraph: {
    events: new EventTarget(),
    nodes: []
  }
}))

vi.mock('@/scripts/app', () => ({
  app: appMock
}))

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
  canvas.selectedItems.add(node)
  node.selected = true

  return { canvas, node }
}

describe('useViewErrorsInGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    apiMock.getSettings.mockResolvedValue({})
    apiMock.storeSetting.mockResolvedValue(undefined)
    apiMock.storeSettings.mockResolvedValue(undefined)
  })

  it('opens graph errors and clears app-mode error UI state', () => {
    const canvasStore = useCanvasStore()
    const executionErrorStore = useExecutionErrorStore()
    const rightSidePanelStore = useRightSidePanelStore()
    const workflowStore = useWorkflowStore()
    const { canvas, node } = createSelectedCanvas()
    workflowStore.activeWorkflow = {
      activeMode: 'app'
    } as typeof workflowStore.activeWorkflow
    canvasStore.canvas = canvas
    canvasStore.selectedItems = [node]
    executionErrorStore.showErrorOverlay()

    useViewErrorsInGraph().viewErrorsInGraph()

    expect(node.selected).toBe(false)
    expect(canvasStore.linearMode).toBe(false)
    expect(canvasStore.selectedItems).toEqual([])
    expect(rightSidePanelStore.activeTab).toBe('errors')
    expect(rightSidePanelStore.isOpen).toBe(true)
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
    expect(executionErrorStore.isErrorOverlayOpen).toBe(false)
  })
})
