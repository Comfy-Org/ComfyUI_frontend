import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

const mockSettingStore = vi.hoisted(() => ({
  get: vi.fn(() => false)
}))

const mockCanvas = vi.hoisted(() => ({
  graph_mouse: [0, 0] as [number, number],
  pointer_is_down: false,
  canvas: { style: { cursor: '' } },
  setDirty: vi.fn()
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => mockSettingStore
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => mockCanvas
  })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      emitBeforeChange: vi.fn(),
      emitAfterChange: vi.fn(),
      isDragging: false,
      processSelect: vi.fn(),
      graph: {
        beforeChange: vi.fn(),
        afterChange: vi.fn(),
        snapToGrid: vi.fn()
      },
      setDirty: vi.fn()
    }
  }
}))

vi.mock('@/scripts/ui/imagePreview', () => ({
  calculateImageGrid: vi.fn(() => ({
    cellWidth: 100,
    cellHeight: 100,
    cols: 2,
    rows: 1,
    shiftX: 0
  }))
}))

vi.mock('@/utils/imageUtil', () => ({
  is_all_same_aspect_ratio: vi.fn(() => true)
}))

vi.mock('@/stores/widgetValueStore', () => ({
  useWidgetValueStore: () => ({
    registerWidget: vi.fn((_graphId: string, state: object) => state)
  })
}))

vi.mock('@/stores/promotionStore', () => ({
  usePromotionStore: () => ({
    isPromotedByAny: vi.fn(() => false)
  })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

import { calculateImageGrid } from '@/scripts/ui/imagePreview'
import { is_all_same_aspect_ratio } from '@/utils/imageUtil'

import { useImagePreviewWidget } from './useImagePreviewWidget'

function createMockCtx(): CanvasRenderingContext2D {
  const transform = new DOMMatrix()
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    drawImage: vi.fn(),
    getTransform: vi.fn(() => transform),
    setTransform: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    textAlign: 'left',
    font: '',
    filter: 'none'
  } as unknown as CanvasRenderingContext2D
}

function createMockNode(overrides: Record<string, unknown> = {}): LGraphNode {
  return {
    id: 1,
    size: [300, 400],
    pos: [0, 0],
    imgs: [],
    imageIndex: null,
    pointerDown: null,
    overIndex: null,
    imageRects: [],
    isUploading: false,
    widgets: [],
    graph: { setDirtyCanvas: vi.fn(), rootGraph: { id: 'test-graph' } },
    addCustomWidget: vi.fn((w) => w),
    ...overrides
  } as unknown as LGraphNode
}

function createMockImage(width: number, height: number): HTMLImageElement {
  return {
    naturalWidth: width,
    naturalHeight: height,
    width,
    height
  } as HTMLImageElement
}

function getWidget(node: LGraphNode): BaseWidget {
  return vi.mocked(node.addCustomWidget).mock.calls[0][0] as BaseWidget
}

const defaultInputSpec: InputSpec = {
  name: 'preview',
  type: 'CUSTOM'
} as InputSpec

describe('useImagePreviewWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas.graph_mouse = [0, 0]
    mockCanvas.pointer_is_down = false
    mockCanvas.canvas.style.cursor = ''
  })

  describe('widget construction', () => {
    it('returns a widget constructor function', () => {
      const constructor = useImagePreviewWidget()
      expect(typeof constructor).toBe('function')
    })

    it('creates a widget with correct name and type', () => {
      const constructor = useImagePreviewWidget()
      const node = createMockNode()
      constructor(node, defaultInputSpec)

      expect(node.addCustomWidget).toHaveBeenCalledTimes(1)
      const widget = getWidget(node)
      expect(widget.name).toBe('preview')
      expect(widget.type).toBe('custom')
    })

    it('creates a non-serialized widget', () => {
      const constructor = useImagePreviewWidget()
      const node = createMockNode()
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      expect(widget.serialize).toBe(false)
    })

    it('widget options include serialize false and canvasOnly', () => {
      const constructor = useImagePreviewWidget()
      const node = createMockNode()
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      expect(widget.options).toMatchObject({
        serialize: false,
        canvasOnly: true
      })
    })
  })

  describe('computeLayoutSize', () => {
    it('returns minHeight 220 and minWidth 1', () => {
      const constructor = useImagePreviewWidget()
      const node = createMockNode()
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      const size = widget.computeLayoutSize!(node)
      expect(size).toEqual({ minHeight: 220, minWidth: 1 })
    })
  })

  describe('createCopyForNode', () => {
    it('creates a copy bound to a new node', () => {
      const constructor = useImagePreviewWidget()
      const node1 = createMockNode({ id: 1 })
      constructor(node1, defaultInputSpec)

      const widget = getWidget(node1)
      const node2 = createMockNode({ id: 2 })
      const copy = widget.createCopyForNode!(node2)

      expect(copy.name).toBe('preview')
      expect(copy.type).toBe('custom')
    })
  })

  describe('drawWidget — upload spinner', () => {
    it('renders spinner when node.isUploading is true', () => {
      vi.useFakeTimers()
      vi.setSystemTime(500)

      const constructor = useImagePreviewWidget()
      const node = createMockNode({ isUploading: true })
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      const ctx = createMockCtx()

      widget.drawWidget(ctx, { width: 300 })

      expect(ctx.save).toHaveBeenCalled()
      expect(ctx.beginPath).toHaveBeenCalled()
      expect(ctx.arc).toHaveBeenCalled()
      expect(ctx.stroke).toHaveBeenCalled()
      expect(ctx.restore).toHaveBeenCalled()
      expect(node.graph!.setDirtyCanvas).toHaveBeenCalledWith(true)

      vi.useRealTimers()
    })

    it('uses LiteGraph.NODE_TEXT_COLOR for spinner stroke', () => {
      vi.useFakeTimers()
      vi.setSystemTime(0)

      const constructor = useImagePreviewWidget()
      const node = createMockNode({ isUploading: true })
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      const ctx = createMockCtx()

      widget.drawWidget(ctx, { width: 300 })

      expect(ctx.strokeStyle).toBe(LiteGraph.NODE_TEXT_COLOR)

      vi.useRealTimers()
    })
  })

  describe('drawWidget — single image', () => {
    it('draws a single image when imageIndex is 0', async () => {
      const constructor = useImagePreviewWidget()
      const img = createMockImage(200, 100)
      const node = createMockNode({
        imgs: [img],
        imageIndex: 0
      })
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      widget.computedHeight = 220
      const ctx = createMockCtx()

      widget.drawWidget(ctx, { width: 300 })

      // Deferred render: flush microtask queue
      await vi.waitFor(() => {
        expect(ctx.drawImage).toHaveBeenCalled()
      })
    })

    it('auto-sets imageIndex to 0 for single image with null index', () => {
      const constructor = useImagePreviewWidget()
      const img = createMockImage(200, 100)
      const node = createMockNode({
        imgs: [img],
        imageIndex: null
      })
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      widget.computedHeight = 220
      const ctx = createMockCtx()

      widget.drawWidget(ctx, { width: 300 })

      expect(node.imageIndex).toBe(0)
    })

    it('does not draw when imgs is empty', () => {
      const constructor = useImagePreviewWidget()
      const node = createMockNode({ imgs: [], imageIndex: null })
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      widget.computedHeight = 220
      const ctx = createMockCtx()

      widget.drawWidget(ctx, { width: 300 })

      expect(ctx.drawImage).not.toHaveBeenCalled()
    })

    it('does not draw when node.size is undefined', () => {
      const constructor = useImagePreviewWidget()
      const node = createMockNode({
        size: undefined as unknown as [number, number],
        imgs: [createMockImage(100, 100)],
        imageIndex: 0
      })
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      const ctx = createMockCtx()

      widget.drawWidget(ctx, { width: 300 })

      expect(ctx.drawImage).not.toHaveBeenCalled()
    })
  })

  describe('drawWidget — image size text', () => {
    it('draws image size text when setting is enabled', async () => {
      mockSettingStore.get.mockReturnValue(true)

      const constructor = useImagePreviewWidget()
      const img = createMockImage(512, 768)
      const node = createMockNode({
        imgs: [img],
        imageIndex: 0
      })
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      widget.computedHeight = 235
      const ctx = createMockCtx()

      widget.drawWidget(ctx, { width: 300 })

      expect(ctx.fillText).toHaveBeenCalledWith(
        '512 × 768',
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('does not draw image size text when setting is disabled', async () => {
      mockSettingStore.get.mockReturnValue(false)

      const constructor = useImagePreviewWidget()
      const img = createMockImage(512, 768)
      const node = createMockNode({
        imgs: [img],
        imageIndex: 0
      })
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      widget.computedHeight = 220
      const ctx = createMockCtx()

      widget.drawWidget(ctx, { width: 300 })

      expect(ctx.fillText).not.toHaveBeenCalled()
    })
  })

  describe('drawWidget — multi-image thumbnail grid', () => {
    it('renders thumbnail grid when imageIndex is null', () => {
      vi.mocked(is_all_same_aspect_ratio).mockReturnValue(true)

      const constructor = useImagePreviewWidget()
      const imgs = [createMockImage(100, 100), createMockImage(100, 100)]
      const node = createMockNode({ imgs, imageIndex: null })
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      widget.computedHeight = 220
      const ctx = createMockCtx()

      widget.drawWidget(ctx, { width: 300 })

      expect(calculateImageGrid).toHaveBeenCalledWith(imgs, 300, 220)
      expect(node.imageRects).toHaveLength(2)
    })

    it('uses non-compact mode for mixed aspect ratios', () => {
      vi.mocked(is_all_same_aspect_ratio).mockReturnValue(false)

      const constructor = useImagePreviewWidget()
      const imgs = [createMockImage(200, 100), createMockImage(100, 200)]
      const node = createMockNode({ imgs, imageIndex: null })
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      widget.computedHeight = 220
      const ctx = createMockCtx()

      widget.drawWidget(ctx, { width: 300 })

      // Non-compact mode draws stroke rects for cell borders
      expect(ctx.strokeRect).toHaveBeenCalled()
    })

    it('does not draw cell borders in compact mode', () => {
      vi.mocked(is_all_same_aspect_ratio).mockReturnValue(true)

      const constructor = useImagePreviewWidget()
      const imgs = [createMockImage(100, 100), createMockImage(100, 100)]
      const node = createMockNode({ imgs, imageIndex: null })
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      widget.computedHeight = 220
      const ctx = createMockCtx()

      widget.drawWidget(ctx, { width: 300 })

      expect(ctx.strokeRect).not.toHaveBeenCalled()
    })
  })

  describe('drawWidget — pointer interaction', () => {
    it('clears pointerDown when pointer is released without movement', () => {
      const constructor = useImagePreviewWidget()
      const imgs = [createMockImage(100, 100)]
      const node = createMockNode({
        imgs,
        imageIndex: 0,
        pointerDown: { index: 0, pos: [50, 50] }
      })
      constructor(node, defaultInputSpec)

      mockCanvas.pointer_is_down = false
      mockCanvas.graph_mouse = [50, 50]

      const widget = getWidget(node)
      widget.computedHeight = 220
      const ctx = createMockCtx()

      widget.drawWidget(ctx, { width: 300 })

      expect(node.imageIndex).toBe(0)
      expect(node.pointerDown).toBeNull()
    })

    it('resets overIndex when no thumbnail is hovered', () => {
      vi.mocked(is_all_same_aspect_ratio).mockReturnValue(true)

      // Place mouse far outside any cell
      mockCanvas.graph_mouse = [9999, 9999]

      const constructor = useImagePreviewWidget()
      const imgs = [createMockImage(100, 100), createMockImage(100, 100)]
      const node = createMockNode({
        imgs,
        imageIndex: null,
        overIndex: 1
      })
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      widget.computedHeight = 220
      const ctx = createMockCtx()

      widget.drawWidget(ctx, { width: 300 })

      expect(node.overIndex).toBeNull()
      expect(node.pointerDown).toBeNull()
    })
  })

  describe('drawWidget — previewImages override', () => {
    it('uses previewImages from options when provided', async () => {
      const constructor = useImagePreviewWidget()
      const nodeImg = createMockImage(100, 100)
      const previewImg = createMockImage(200, 200)
      const node = createMockNode({
        imgs: [nodeImg],
        imageIndex: 0
      })
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      widget.computedHeight = 220
      const ctx = createMockCtx()

      widget.drawWidget(ctx, {
        width: 300,
        previewImages: [previewImg]
      })

      await vi.waitFor(() => {
        expect(ctx.drawImage).toHaveBeenCalled()
      })

      const drawCall = vi.mocked(ctx.drawImage).mock.calls[0]
      expect(drawCall[0]).toBe(previewImg)
    })
  })

  describe('onPointerDown', () => {
    it('returns true to indicate the event is handled', () => {
      const constructor = useImagePreviewWidget()
      const node = createMockNode()
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      const pointer = {
        onDragStart: null as (() => void) | null,
        onDragEnd: null as ((e: MouseEvent) => void) | null,
        finally: null as (() => void) | null,
        eDown: new MouseEvent('pointerdown')
      }

      const result = widget.onPointerDown!(
        pointer as never,
        node,
        mockCanvas as never
      )
      expect(result).toBe(true)
    })

    it('sets up drag handlers on the pointer', () => {
      const constructor = useImagePreviewWidget()
      const node = createMockNode()
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      const pointer = {
        onDragStart: null as (() => void) | null,
        onDragEnd: null as ((e: MouseEvent) => void) | null,
        finally: null as (() => void) | null,
        eDown: new MouseEvent('pointerdown')
      }

      widget.onPointerDown!(pointer as never, node, mockCanvas as never)

      expect(pointer.onDragStart).toBeTypeOf('function')
      expect(pointer.onDragEnd).toBeTypeOf('function')
    })
  })

  describe('onClick', () => {
    it('is a no-op', () => {
      const constructor = useImagePreviewWidget()
      const node = createMockNode()
      constructor(node, defaultInputSpec)

      const widget = getWidget(node)
      // Should not throw
      expect(() => widget.onClick({} as never)).not.toThrow()
    })
  })
})
