import { render, screen, waitFor } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import type { useKeyboard } from '#/useKeyboard'
import type { usePanAndZoom } from '#/usePanAndZoom'
import type { useToolManager } from '#/useToolManager'
import { useMaskEditorStore } from '#/maskEditorStore'
import EditorCanvas from './EditorCanvas.vue'

const mockKeyboard = vi.hoisted(() => ({
  addListeners: vi.fn(),
  removeListeners: vi.fn()
}))
const mockPanZoom = vi.hoisted(() => ({
  initializeCanvasPanZoom: vi.fn(async () => undefined),
  invalidatePanZoom: vi.fn(async () => undefined)
}))
const mockBrushDrawing = vi.hoisted(() => ({
  initGPUResources: vi.fn(async (): Promise<void> => undefined),
  initPreviewCanvas: vi.fn<(canvas: HTMLCanvasElement) => void>()
}))

vi.mock(import('#/useKeyboard'), () => ({
  useKeyboard: () => fromPartial<ReturnType<typeof useKeyboard>>(mockKeyboard)
}))
vi.mock(import('#/usePanAndZoom'), () => ({
  usePanAndZoom: () =>
    fromPartial<ReturnType<typeof usePanAndZoom>>(mockPanZoom)
}))
vi.mock(import('#/useToolManager'), () => ({
  useToolManager: () =>
    fromPartial<ReturnType<typeof useToolManager>>({
      brushDrawing: mockBrushDrawing
    })
}))

const observeSpy = vi.fn()
const disconnectSpy = vi.fn()
const resizeObserver: ResizeObserver = {
  observe: observeSpy,
  disconnect: disconnectSpy,
  unobserve: vi.fn()
}
let resizeCallback: ResizeObserverCallback

function getCanvasContext(this: HTMLCanvasElement, contextId: 'webgpu'): null
function getCanvasContext(
  this: HTMLCanvasElement,
  contextId: string
): CanvasRenderingContext2D | null
function getCanvasContext(this: HTMLCanvasElement, contextId: string) {
  if (contextId !== '2d') return null
  return fromPartial<CanvasRenderingContext2D>({
    canvas: this,
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: () =>
      fromPartial<ImageData>({
        data: new Uint8ClampedArray(this.width * this.height * 4),
        width: this.width,
        height: this.height
      }),
    putImageData: vi.fn()
  })
}

function renderCanvas(baseImage = new Image(3, 2)) {
  return render(EditorCanvas, {
    props: { baseImage, maskImage: new Image(3, 2) },
    global: {
      stubs: {
        ToolPanel: { template: '<div data-testid="tool-panel-stub" />' },
        PointerZone: { template: '<div data-testid="pointer-zone-stub" />' },
        SidePanel: { template: '<div data-testid="side-panel-stub" />' },
        BrushCursor: { template: '<div data-testid="brush-cursor-stub" />' },
        LoadingOverlay: true
      }
    }
  })
}

describe('EditorCanvas', () => {
  beforeEach(() => {
    const store = useMaskEditorStore()
    vi.mocked(store.resetState).mockImplementation(() => {})
    vi.spyOn(store.canvasHistory, 'saveInitialState').mockImplementation(
      () => {}
    )
    vi.spyOn(store.canvasHistory, 'clearStates').mockImplementation(() => {})
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      getCanvasContext
    )
    vi.stubGlobal(
      'ResizeObserver',
      class implements ResizeObserver {
        observe: ResizeObserver['observe'] = observeSpy
        disconnect: ResizeObserver['disconnect'] = disconnectSpy
        unobserve: ResizeObserver['unobserve'] = vi.fn()
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback
          return resizeObserver
        }
      }
    )
  })

  it('attaches keyboard input and observes the editor viewport', async () => {
    renderCanvas()

    expect(mockKeyboard.addListeners).toHaveBeenCalledTimes(1)
    expect(observeSpy).toHaveBeenCalledWith(
      screen.getByTestId('mask-editor-root')
    )
    await screen.findByTestId('tool-panel-stub')
  })

  it('updates pan and zoom when the viewport resizes', async () => {
    renderCanvas()
    resizeCallback([], resizeObserver)

    await waitFor(() =>
      expect(mockPanZoom.invalidatePanZoom).toHaveBeenCalledTimes(1)
    )
    await screen.findByTestId('tool-panel-stub')
  })

  it('initializes decoded images after the store attaches canvas contexts', async () => {
    const image = new Image(3, 2)
    const { emitted } = renderCanvas(image)
    const store = useMaskEditorStore()

    await waitFor(() => expect(emitted('ready')).toEqual([[]]))

    expect(emitted('error')).toBeUndefined()
    expect(store.image).toBe(image)
    expect(
      [store.imgCanvas, store.maskCanvas, store.rgbCanvas].map((canvas) => [
        canvas?.width,
        canvas?.height
      ])
    ).toEqual([
      [3, 2],
      [3, 2],
      [3, 2]
    ])
    expect([store.imgCtx, store.maskCtx, store.rgbCtx]).toEqual([
      expect.objectContaining({ canvas: store.imgCanvas }),
      expect.objectContaining({ canvas: store.maskCanvas }),
      expect.objectContaining({ canvas: store.rgbCanvas })
    ])
  })

  it('keeps child controls hidden until GPU resources are ready', async () => {
    let resolveGPU = () => {}
    const gpuReady = new Promise<void>((resolve) => {
      resolveGPU = resolve
    })
    mockBrushDrawing.initGPUResources.mockReturnValueOnce(gpuReady)
    const { emitted } = renderCanvas()

    await waitFor(() =>
      expect(mockBrushDrawing.initGPUResources).toHaveBeenCalledTimes(1)
    )
    expect(screen.queryByTestId('tool-panel-stub')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pointer-zone-stub')).not.toBeInTheDocument()
    expect(screen.queryByTestId('side-panel-stub')).not.toBeInTheDocument()
    expect(screen.queryByTestId('brush-cursor-stub')).not.toBeInTheDocument()

    resolveGPU()

    expect(await screen.findByTestId('tool-panel-stub')).toBeInTheDocument()
    expect(screen.getByTestId('pointer-zone-stub')).toBeInTheDocument()
    expect(screen.getByTestId('side-panel-stub')).toBeInTheDocument()
    expect(screen.getByTestId('brush-cursor-stub')).toBeInTheDocument()
    expect(emitted('ready')).toEqual([[]])
    expect(
      useMaskEditorStore().canvasHistory.saveInitialState
    ).toHaveBeenCalledTimes(1)
  })

  it('sizes the GPU preview to the initialized mask dimensions', async () => {
    const store = useMaskEditorStore()
    mockBrushDrawing.initGPUResources.mockImplementationOnce(async () => {
      expect(store.maskCanvas).toBeInstanceOf(HTMLCanvasElement)
      expect(store.rgbCanvas).toBeInstanceOf(HTMLCanvasElement)
      expect(store.imgCanvas).toBeInstanceOf(HTMLCanvasElement)
      expect(store.canvasContainer).toBeInstanceOf(HTMLElement)
      expect(store.canvasBackground).toBeInstanceOf(HTMLElement)
      assert.exists(store.maskCanvas)
      store.maskCanvas.width = 999
      store.maskCanvas.height = 777
    })
    renderCanvas()

    await waitFor(() =>
      expect(mockBrushDrawing.initPreviewCanvas).toHaveBeenCalledTimes(1)
    )
    const [previewCanvas] = mockBrushDrawing.initPreviewCanvas.mock.calls[0]
    expect([previewCanvas.width, previewCanvas.height]).toEqual([999, 777])
  })

  it('emits an error without revealing controls when canvas contexts are unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { emitted } = renderCanvas()

    await waitFor(() =>
      expect(emitted('error')).toEqual([
        [new Error('Canvas elements or contexts not available')]
      ])
    )
    expect(emitted('ready')).toBeUndefined()
    expect(screen.queryByTestId('tool-panel-stub')).not.toBeInTheDocument()
  })

  it.for(['pan zoom', 'GPU'] as const)(
    'emits an error without revealing controls when %s initialization fails',
    async (stage) => {
      const error = new Error(`${stage} failed`)
      const initialize = {
        'pan zoom': mockPanZoom.initializeCanvasPanZoom,
        GPU: mockBrushDrawing.initGPUResources
      }[stage]
      initialize.mockRejectedValueOnce(error)
      const { emitted } = renderCanvas()

      await waitFor(() => expect(emitted('error')).toEqual([[error]]))
      expect(emitted('ready')).toBeUndefined()
      expect(screen.queryByTestId('tool-panel-stub')).not.toBeInTheDocument()
    }
  )

  it.for([
    { ctrlKey: true, prevented: true },
    { ctrlKey: false, prevented: false }
  ])(
    'drag with Ctrl=$ctrlKey is prevented=$prevented',
    async ({ ctrlKey, prevented }) => {
      renderCanvas()
      const event = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true
      })
      Object.defineProperty(event, 'ctrlKey', { value: ctrlKey })

      screen.getByTestId('mask-editor-root').dispatchEvent(event)

      expect(event.defaultPrevented).toBe(prevented)
      await screen.findByTestId('tool-panel-stub')
    }
  )

  it('releases keyboard, observer, history and engine state on unmount', async () => {
    const store = useMaskEditorStore()
    const { unmount } = renderCanvas()
    await screen.findByTestId('tool-panel-stub')

    unmount()

    expect(mockKeyboard.removeListeners).toHaveBeenCalledTimes(1)
    expect(disconnectSpy).toHaveBeenCalledTimes(1)
    expect(store.canvasHistory.clearStates).toHaveBeenCalledTimes(1)
    expect(store.resetState).toHaveBeenCalledTimes(1)
  })
})
