import { render, screen, waitFor } from '@testing-library/vue'
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import MaskEditorContent from '@/components/maskeditor/MaskEditorContent.vue'

const mockKeyboard = vi.hoisted(() => ({
  addListeners: vi.fn(),
  removeListeners: vi.fn()
}))

const mockPanZoom = vi.hoisted(() => ({
  initializeCanvasPanZoom: vi.fn().mockResolvedValue(undefined),
  invalidatePanZoom: vi.fn().mockResolvedValue(undefined)
}))

const mockBrushDrawing = vi.hoisted(() => ({
  initGPUResources: vi.fn().mockResolvedValue(undefined),
  initPreviewCanvas: vi.fn(),
  saveBrushSettings: vi.fn()
}))

const mockToolManager = vi.hoisted(() => ({
  brushDrawing: mockBrushDrawing
}))

const mockImageLoader = vi.hoisted(() => ({
  loadImages: vi.fn().mockResolvedValue({ width: 100, height: 100 })
}))

const mockMaskEditorLoader = vi.hoisted(() => ({
  loadFromNode: vi.fn().mockResolvedValue(undefined)
}))

const mockCanvasHistory = vi.hoisted(() => ({
  saveInitialState: vi.fn(),
  clearStates: vi.fn()
}))

const initialMockStore = () =>
  reactive({
    activeLayer: 'mask' as 'mask' | 'rgb',
    maskCanvas: null as HTMLCanvasElement | null,
    rgbCanvas: null as HTMLCanvasElement | null,
    imgCanvas: null as HTMLCanvasElement | null,
    canvasContainer: null as HTMLElement | null,
    canvasBackground: null as HTMLElement | null,
    canvasHistory: mockCanvasHistory,
    resetState: vi.fn()
  })

let mockStore: ReturnType<typeof initialMockStore>

const mockDataStore = vi.hoisted(() => ({
  reset: vi.fn()
}))

const mockDialogStore = vi.hoisted(() => ({
  closeDialog: vi.fn()
}))

vi.mock('@/composables/maskeditor/useKeyboard', () => ({
  useKeyboard: () => mockKeyboard
}))

vi.mock('@/composables/maskeditor/usePanAndZoom', () => ({
  usePanAndZoom: () => mockPanZoom
}))

vi.mock('@/composables/maskeditor/useToolManager', () => ({
  useToolManager: () => mockToolManager
}))

vi.mock('@/composables/maskeditor/useImageLoader', () => ({
  useImageLoader: () => mockImageLoader
}))

vi.mock('@/composables/maskeditor/useMaskEditorLoader', () => ({
  useMaskEditorLoader: () => mockMaskEditorLoader
}))

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: () => mockStore
}))

vi.mock('@/stores/maskEditorDataStore', () => ({
  useMaskEditorDataStore: () => mockDataStore
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => mockDialogStore
}))

vi.mock('@/components/common/LoadingOverlay.vue', () => ({
  default: {
    name: 'LoadingOverlayStub',
    props: ['loading', 'size'],
    template: `<div data-testid="loading-overlay" :data-loading="loading" />`
  }
}))

vi.mock('@/components/maskeditor/ToolPanel.vue', () => ({
  default: {
    name: 'ToolPanelStub',
    props: ['toolManager'],
    template: '<div data-testid="tool-panel-stub" />'
  }
}))

vi.mock('@/components/maskeditor/PointerZone.vue', () => ({
  default: {
    name: 'PointerZoneStub',
    props: ['toolManager', 'panZoom'],
    template: '<div data-testid="pointer-zone-stub" />'
  }
}))

vi.mock('@/components/maskeditor/SidePanel.vue', () => ({
  default: {
    name: 'SidePanelStub',
    props: ['toolManager'],
    template: '<div data-testid="side-panel-stub" />'
  }
}))

vi.mock('@/components/maskeditor/BrushCursor.vue', () => ({
  default: {
    name: 'BrushCursorStub',
    props: ['containerRef'],
    template: '<div data-testid="brush-cursor-stub" />'
  }
}))

const observeSpy = vi.fn()
const disconnectSpy = vi.fn()
let lastResizeCallback: ResizeObserverCallback | null = null

class MockResizeObserver {
  observe = observeSpy
  disconnect = disconnectSpy
  unobserve = vi.fn()
  constructor(cb: ResizeObserverCallback) {
    lastResizeCallback = cb
  }
}

// `node` only flows into mocked `loader.loadFromNode`, so a typed sentinel
// with a stable identity is enough — we never read its fields.
const fakeNode = { id: 1, title: 'test-node' } as unknown as LGraphNode

const renderContent = () =>
  render(MaskEditorContent, { props: { node: fakeNode } })

let originalResizeObserver: typeof ResizeObserver | undefined

describe('MaskEditorContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore = initialMockStore()
    mockMaskEditorLoader.loadFromNode.mockResolvedValue(undefined)
    mockImageLoader.loadImages.mockResolvedValue({ width: 100, height: 100 })
    mockPanZoom.initializeCanvasPanZoom.mockResolvedValue(undefined)
    mockBrushDrawing.initGPUResources.mockResolvedValue(undefined)
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver
  })

  afterEach(() => {
    globalThis.ResizeObserver =
      originalResizeObserver as unknown as typeof ResizeObserver
  })

  describe('mount', () => {
    it('should add keyboard listeners on mount', () => {
      renderContent()
      expect(mockKeyboard.addListeners).toHaveBeenCalledTimes(1)
    })

    it('should observe the container with a ResizeObserver', async () => {
      renderContent()
      await waitFor(() => expect(observeSpy).toHaveBeenCalledTimes(1))
    })

    it('should invalidate pan/zoom on resize', async () => {
      renderContent()
      await waitFor(() => expect(observeSpy).toHaveBeenCalled())
      mockPanZoom.invalidatePanZoom.mockClear()

      lastResizeCallback?.([], {} as ResizeObserver)
      await new Promise((r) => setTimeout(r, 0))

      expect(mockPanZoom.invalidatePanZoom).toHaveBeenCalledTimes(1)
    })

    it('should assign canvas refs to the store before init', async () => {
      renderContent()
      await waitFor(() => expect(mockStore.maskCanvas).not.toBeNull())
      expect(mockStore.rgbCanvas).not.toBeNull()
      expect(mockStore.imgCanvas).not.toBeNull()
      expect(mockStore.canvasContainer).not.toBeNull()
      expect(mockStore.canvasBackground).not.toBeNull()
    })
  })

  describe('init flow', () => {
    it('should run the init chain in the documented order', async () => {
      renderContent()

      await waitFor(() => {
        expect(mockBrushDrawing.initPreviewCanvas).toHaveBeenCalled()
      })

      const orderOf = (fn: { mock: { invocationCallOrder: number[] } }) =>
        fn.mock.invocationCallOrder[0]

      expect(orderOf(mockMaskEditorLoader.loadFromNode)).toBeLessThan(
        orderOf(mockImageLoader.loadImages)
      )
      expect(orderOf(mockImageLoader.loadImages)).toBeLessThan(
        orderOf(mockPanZoom.initializeCanvasPanZoom)
      )
      expect(orderOf(mockPanZoom.initializeCanvasPanZoom)).toBeLessThan(
        orderOf(mockCanvasHistory.saveInitialState)
      )
      expect(orderOf(mockCanvasHistory.saveInitialState)).toBeLessThan(
        orderOf(mockBrushDrawing.initGPUResources)
      )
      expect(orderOf(mockBrushDrawing.initGPUResources)).toBeLessThan(
        orderOf(mockBrushDrawing.initPreviewCanvas)
      )
      expect(mockMaskEditorLoader.loadFromNode).toHaveBeenCalledWith(fakeNode)
    })

    it('should reveal the child UI components after init succeeds', async () => {
      renderContent()

      expect(await screen.findByTestId('tool-panel-stub')).toBeInTheDocument()
      expect(await screen.findByTestId('pointer-zone-stub')).toBeInTheDocument()
      expect(await screen.findByTestId('side-panel-stub')).toBeInTheDocument()
      expect(await screen.findByTestId('brush-cursor-stub')).toBeInTheDocument()
    })

    it('should size the GPU preview canvas to match the mask canvas', async () => {
      // Force the mask canvas to non-default dimensions during init so the
      // assertion below proves the source actually copies width/height across
      // (default 300x150 on both would make the test tautological).
      mockBrushDrawing.initGPUResources.mockImplementationOnce(async () => {
        if (mockStore.maskCanvas) {
          mockStore.maskCanvas.width = 999
          mockStore.maskCanvas.height = 777
        }
      })
      renderContent()

      await waitFor(() => {
        expect(mockBrushDrawing.initPreviewCanvas).toHaveBeenCalled()
      })

      const previewCanvas = mockBrushDrawing.initPreviewCanvas.mock
        .calls[0][0] as HTMLCanvasElement
      expect(previewCanvas.width).toBe(999)
      expect(previewCanvas.height).toBe(777)
    })
  })

  describe('init error', () => {
    it('should close the dialog and log when loader.loadFromNode rejects', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockMaskEditorLoader.loadFromNode.mockRejectedValueOnce(
        new Error('load failed')
      )

      renderContent()

      await waitFor(() => {
        expect(mockDialogStore.closeDialog).toHaveBeenCalledTimes(1)
      })
      expect(errorSpy).toHaveBeenCalledWith(
        '[MaskEditorContent] Initialization failed:',
        expect.any(Error)
      )
      errorSpy.mockRestore()
    })

    it('should close the dialog and log when initializeCanvasPanZoom rejects', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockPanZoom.initializeCanvasPanZoom.mockRejectedValueOnce(
        new Error('panzoom failed')
      )

      renderContent()

      await waitFor(() => {
        expect(mockDialogStore.closeDialog).toHaveBeenCalledTimes(1)
      })
      expect(errorSpy).toHaveBeenCalledWith(
        '[MaskEditorContent] Initialization failed:',
        expect.any(Error)
      )
      errorSpy.mockRestore()
    })
  })

  describe('drag handling', () => {
    it('should prevent default on dragstart with Ctrl held', () => {
      renderContent()
      const root = screen.getByTestId('mask-editor-root')

      const event = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true
      })
      // happy-dom doesn't propagate ctrlKey through the DragEvent constructor.
      Object.defineProperty(event, 'ctrlKey', { value: true })
      root.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
    })

    it('should not prevent default on plain dragstart without Ctrl', () => {
      renderContent()
      const root = screen.getByTestId('mask-editor-root')

      const event = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true
      })
      Object.defineProperty(event, 'ctrlKey', { value: false })
      root.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)
    })
  })

  describe('unmount cleanup', () => {
    it('should run the full cleanup chain on unmount', async () => {
      const { unmount } = renderContent()
      await waitFor(() =>
        expect(mockBrushDrawing.initGPUResources).toHaveBeenCalled()
      )

      unmount()

      expect(mockBrushDrawing.saveBrushSettings).toHaveBeenCalledTimes(1)
      expect(mockKeyboard.removeListeners).toHaveBeenCalledTimes(1)
      expect(mockCanvasHistory.clearStates).toHaveBeenCalledTimes(1)
      expect(mockStore.resetState).toHaveBeenCalledTimes(1)
      expect(mockDataStore.reset).toHaveBeenCalledTimes(1)
    })
  })
})
