import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useErrorResolutionStore } from '@/stores/workspace/errorResolutionStore'
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

const settingsMock = vi.hoisted(() => {
  const values = new Map<string, unknown>()
  return {
    values,
    get: vi.fn((key: string) => values.get(key)),
    set: vi.fn((key: string, value: unknown) => {
      values.set(key, value)
      return Promise.resolve()
    })
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => settingsMock
}))

const executeCommandMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: executeCommandMock })
}))

function createSelectedCanvas({ width = 800, height = 600 } = {}) {
  const graph = new LGraph()
  const canvasElement = document.createElement('canvas')
  canvasElement.width = width
  canvasElement.height = height
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
    settingsMock.values.clear()
    executeCommandMock.mockResolvedValue(undefined)
    setActivePinia(createPinia())
    apiMock.getSettings.mockResolvedValue({})
    apiMock.storeSetting.mockResolvedValue(undefined)
    apiMock.storeSettings.mockResolvedValue(undefined)
  })

  it('enters the error-resolution view when coming from app mode', async () => {
    const canvasStore = useCanvasStore()
    const executionErrorStore = useExecutionErrorStore()
    const errorResolutionStore = useErrorResolutionStore()
    const rightSidePanelStore = useRightSidePanelStore()
    const workflowStore = useWorkflowStore()
    const { canvas, node } = createSelectedCanvas()
    workflowStore.activeWorkflow = {
      activeMode: 'app'
    } as typeof workflowStore.activeWorkflow
    canvasStore.canvas = canvas
    canvasStore.selectedItems = [node]
    executionErrorStore.showErrorOverlay()
    settingsMock.values.set('Comfy.Minimap.Visible', true)

    useViewErrorsInGraph().viewErrorsInGraph()

    expect(node.selected).toBe(false)
    expect(canvasStore.linearMode).toBe(false)
    expect(canvasStore.selectedItems).toEqual([])
    expect(errorResolutionStore.isActive).toBe(true)
    expect(rightSidePanelStore.isOpen).toBeFalsy()
    expect(executionErrorStore.isErrorOverlayOpen).toBe(false)

    expect(
      settingsMock.set,
      'entering the view must not mutate persisted settings'
    ).not.toHaveBeenCalled()
    await vi.waitFor(() => {
      expect(
        executeCommandMock,
        'the graph is fit into view on entry'
      ).toHaveBeenCalledWith('Comfy.Canvas.FitView')
    })
  })

  it('skips FitView when the canvas never re-measures', async () => {
    const canvasStore = useCanvasStore()
    const workflowStore = useWorkflowStore()
    const { canvas } = createSelectedCanvas({ width: 0, height: 0 })
    workflowStore.activeWorkflow = {
      activeMode: 'app'
    } as typeof workflowStore.activeWorkflow
    canvasStore.canvas = canvas

    useViewErrorsInGraph().viewErrorsInGraph()
    // Outlast the 30-frame resize wait
    await new Promise((resolve) => setTimeout(resolve, 700))

    expect(executeCommandMock).not.toHaveBeenCalled()
  })

  it('skips FitView when the view is exited during the resize wait', async () => {
    const canvasStore = useCanvasStore()
    const errorResolutionStore = useErrorResolutionStore()
    const workflowStore = useWorkflowStore()
    const { canvas } = createSelectedCanvas()
    workflowStore.activeWorkflow = {
      activeMode: 'app'
    } as typeof workflowStore.activeWorkflow
    canvasStore.canvas = canvas

    useViewErrorsInGraph().viewErrorsInGraph()
    errorResolutionStore.exit()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(executeCommandMock).not.toHaveBeenCalled()
  })

  it('opens the errors panel when already in graph mode', () => {
    const canvasStore = useCanvasStore()
    const executionErrorStore = useExecutionErrorStore()
    const errorResolutionStore = useErrorResolutionStore()
    const rightSidePanelStore = useRightSidePanelStore()
    const workflowStore = useWorkflowStore()
    const { canvas, node } = createSelectedCanvas()
    workflowStore.activeWorkflow = {
      activeMode: 'graph'
    } as typeof workflowStore.activeWorkflow
    canvasStore.canvas = canvas
    canvasStore.selectedItems = [node]
    executionErrorStore.showErrorOverlay()

    useViewErrorsInGraph().viewErrorsInGraph()

    expect(node.selected).toBe(false)
    expect(errorResolutionStore.isActive).toBe(false)
    expect(rightSidePanelStore.activeTab).toBe('errors')
    expect(rightSidePanelStore.isOpen).toBe(true)
    expect(executionErrorStore.isErrorOverlayOpen).toBe(false)
    expect(executeCommandMock).not.toHaveBeenCalled()
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
