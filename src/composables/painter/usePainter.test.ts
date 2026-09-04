import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { api } from '@/scripts/api'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

import { usePainter } from './usePainter'

vi.mock('@vueuse/core', () => ({
  useElementSize: vi.fn(() => ({
    width: ref(512),
    height: ref(512)
  }))
}))

vi.mock('@/composables/maskeditor/StrokeProcessor', () => ({
  StrokeProcessor: vi.fn(() => ({
    addPoint: vi.fn(() => []),
    endStroke: vi.fn(() => [])
  }))
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/updates/common/toastStore', () => {
  const store = { addAlert: vi.fn() }
  return { useToastStore: () => store }
})

vi.mock('@/stores/nodeOutputStore', () => {
  const store = {
    getNodeImageUrls: vi.fn(() => undefined),
    nodeOutputs: {},
    nodePreviewImages: {}
  }
  return { useNodeOutputStore: () => store }
})

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn((path: string) => `http://localhost:8188${path}`),
    fetchApi: vi.fn()
  }
}))

const fixture = vi.hoisted((): { node: LGraphNode | null } => ({ node: null }))

vi.mock('@/scripts/app', () => ({
  app: { canvas: { graph: { getNodeById: () => fixture.node } } }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

const mockIsInputConnected = vi.fn(() => false)
const mockGetInputNode = vi.fn(() => null)

interface PaintWidgetSpec {
  name: string
  type: 'number' | 'string' | 'color'
  value: string | number
}

function makePaintNode(widgets: PaintWidgetSpec[] = []) {
  const graph = new LGraph()
  const node = new LGraphNode('PainterTestNode')
  graph.add(node)
  const callbacks: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const { name, type, value } of widgets) {
    const callback = vi.fn()
    callbacks[name] = callback
    node.addWidget(type, name, value, callback)
  }
  node.isInputConnected = mockIsInputConnected
  node.getInputNode = mockGetInputNode
  fixture.node = node
  return { node, callbacks }
}

function paintNode(): LGraphNode {
  if (!fixture.node) throw new Error('Expected a paint node')
  return fixture.node
}

function widgetOf(name: string): IBaseWidget {
  const widget = paintNode().widgets?.find((w) => w.name === name)
  if (!widget) throw new Error(`Expected a '${name}' widget on the paint node`)
  return widget
}

function storedValue(name: string): unknown {
  const id = widgetOf(name).widgetId
  return id ? useWidgetValueStore().getWidget(id)?.value : undefined
}

type PainterResult = ReturnType<typeof usePainter>

/**
 * Mounts a thin wrapper component so Vue lifecycle hooks fire.
 */
function mountPainter(
  nodeId: NodeId = toNodeId('test-node'),
  initialModelValue = ''
) {
  let painter!: PainterResult
  const canvasEl = ref<HTMLCanvasElement | null>(null)
  const cursorEl = ref<HTMLElement | null>(null)
  const modelValue = ref(initialModelValue)

  const Wrapper = defineComponent({
    setup() {
      painter = usePainter(nodeId, {
        canvasEl,
        cursorEl,
        modelValue
      })
      return {}
    },
    render() {
      return null
    }
  })

  render(Wrapper, { global: { plugins: [i18n] } })
  return { painter, canvasEl, cursorEl, modelValue }
}

describe('usePainter', () => {
  beforeEach(() => {
    makePaintNode()
    mockIsInputConnected.mockReturnValue(false)
    mockGetInputNode.mockReturnValue(null)
  })

  describe('canvas size projections', () => {
    it('reads width/height from widget values on initialization', () => {
      makePaintNode([
        { name: 'width', type: 'number', value: 1024 },
        { name: 'height', type: 'number', value: 768 }
      ])

      const { painter } = mountPainter()

      expect(painter.canvasWidth.value).toBe(1024)
      expect(painter.canvasHeight.value).toBe(768)
    })

    it('defaults to 512 when widgets are missing', () => {
      const { painter } = mountPainter()

      expect(painter.canvasWidth.value).toBe(512)
      expect(painter.canvasHeight.value).toBe(512)
    })

    it('resizes the canvas and preserves its content on external store writes', async () => {
      makePaintNode([{ name: 'width', type: 'number', value: 512 }])
      const mainCtx = fromPartial<CanvasRenderingContext2D>({
        drawImage: vi.fn()
      })
      const fakeCanvas = fromPartial<HTMLCanvasElement>({
        width: 4,
        height: 4,
        getContext: fromAny<HTMLCanvasElement['getContext'], unknown>(
          () => mainCtx
        )
      })
      const { painter, canvasEl } = mountPainter()
      canvasEl.value = fakeCanvas

      const tmpCtx = fromPartial<CanvasRenderingContext2D>({
        drawImage: vi.fn()
      })
      const tmpCanvas = fromPartial<HTMLCanvasElement>({
        getContext: fromAny<HTMLCanvasElement['getContext'], unknown>(
          () => tmpCtx
        )
      })
      const createElement = vi
        .spyOn(document, 'createElement')
        .mockReturnValue(tmpCanvas)

      useWidgetValueStore().setValue(widgetOf('width').widgetId!, 2048)
      await nextTick()
      createElement.mockRestore()

      expect(painter.canvasWidth.value).toBe(2048)
      expect(fakeCanvas.width).toBe(2048)
      expect(fakeCanvas.height).toBe(512)
      expect(tmpCtx.drawImage).toHaveBeenCalledWith(fakeCanvas, 0, 0)
      expect(mainCtx.drawImage).toHaveBeenCalledWith(tmpCanvas, 0, 0)
    })

    it('writes size edits through the widget notification lifecycle', async () => {
      const { node, callbacks } = makePaintNode([
        { name: 'width', type: 'number', value: 512 },
        { name: 'height', type: 'number', value: 512 }
      ])
      node.onWidgetChanged = vi.fn()

      const { painter } = mountPainter()

      painter.canvasWidth.value = 800
      painter.canvasHeight.value = 600
      await nextTick()

      expect(storedValue('width')).toBe(800)
      expect(storedValue('height')).toBe(600)
      expect(callbacks['width']).toHaveBeenCalledWith(800)
      expect(callbacks['height']).toHaveBeenCalledWith(600)
      expect(node.onWidgetChanged).toHaveBeenCalledWith(
        'width',
        800,
        512,
        widgetOf('width')
      )
    })

    it('skips the widget callback when the value is unchanged', () => {
      const { callbacks } = makePaintNode([
        { name: 'width', type: 'number', value: 512 }
      ])

      const { painter } = mountPainter()

      painter.canvasWidth.value = 512

      expect(callbacks['width']).not.toHaveBeenCalled()
    })
  })

  describe('restoreSettingsFromProperties', () => {
    it('restores tool and brush settings from node properties on init', () => {
      const { node } = makePaintNode()
      node.properties.painterTool = 'eraser'
      node.properties.painterBrushSize = 42
      node.properties.painterBrushColor = '#ff0000'
      node.properties.painterBrushOpacity = 0.5
      node.properties.painterBrushHardness = 0.8

      const { painter } = mountPainter()

      expect(painter.tool.value).toBe('eraser')
      expect(painter.brushSize.value).toBe(42)
      expect(painter.brushColor.value).toBe('#ff0000')
      expect(painter.brushOpacity.value).toBe(0.5)
      expect(painter.brushHardness.value).toBe(0.8)
    })

    it('restores backgroundColor from the bg_color widget', () => {
      makePaintNode([{ name: 'bg_color', type: 'color', value: '#123456' }])

      const { painter } = mountPainter()

      expect(painter.backgroundColor.value).toBe('#123456')
    })

    it('keeps defaults when no properties are stored', () => {
      const { painter } = mountPainter()

      expect(painter.tool.value).toBe('brush')
      expect(painter.brushSize.value).toBe(20)
      expect(painter.brushColor.value).toBe('#ffffff')
      expect(painter.brushOpacity.value).toBe(1)
      expect(painter.brushHardness.value).toBe(1)
    })
  })

  describe('saveSettingsToProperties', () => {
    it('persists tool settings to node properties when they change', async () => {
      const { node } = makePaintNode()
      const { painter } = mountPainter()

      painter.tool.value = 'eraser'
      painter.brushSize.value = 50
      painter.brushColor.value = '#00ff00'
      painter.brushOpacity.value = 0.7
      painter.brushHardness.value = 0.3

      await nextTick()

      expect(node.properties.painterTool).toBe('eraser')
      expect(node.properties.painterBrushSize).toBe(50)
      expect(node.properties.painterBrushColor).toBe('#00ff00')
      expect(node.properties.painterBrushOpacity).toBe(0.7)
      expect(node.properties.painterBrushHardness).toBe(0.3)
    })
  })

  describe('background color projection', () => {
    it('writes color edits through the widget and notifies its callback', async () => {
      const { callbacks } = makePaintNode([
        { name: 'bg_color', type: 'color', value: '#000000' }
      ])

      const { painter } = mountPainter()

      painter.backgroundColor.value = '#ff00ff'
      await nextTick()

      expect(storedValue('bg_color')).toBe('#ff00ff')
      expect(callbacks['bg_color']).toHaveBeenCalledWith('#ff00ff')
    })

    it('projects external background color store writes', async () => {
      makePaintNode([{ name: 'bg_color', type: 'color', value: '#000000' }])
      const { painter } = mountPainter()

      useWidgetValueStore().setValue(widgetOf('bg_color').widgetId!, '#123456')
      await nextTick()

      expect(painter.backgroundColor.value).toBe('#123456')
    })
  })

  describe('updateInputImageUrl', () => {
    it('sets isImageInputConnected to false when input is not connected', () => {
      const { painter } = mountPainter()

      expect(painter.isImageInputConnected.value).toBe(false)
      expect(painter.inputImageUrl.value).toBeNull()
    })

    it('sets isImageInputConnected to true when input is connected', () => {
      mockIsInputConnected.mockReturnValue(true)

      const { painter } = mountPainter()

      expect(painter.isImageInputConnected.value).toBe(true)
    })
  })

  describe('handleInputImageLoad', () => {
    it('updates canvas size widgets from loaded image dimensions', () => {
      const { callbacks } = makePaintNode([
        { name: 'width', type: 'number', value: 512 },
        { name: 'height', type: 'number', value: 512 }
      ])

      const { painter } = mountPainter()

      const fakeEvent = {
        target: {
          naturalWidth: 1920,
          naturalHeight: 1080
        }
      } as unknown as Event

      painter.handleInputImageLoad(fakeEvent)

      expect(painter.canvasWidth.value).toBe(1920)
      expect(painter.canvasHeight.value).toBe(1080)
      expect(storedValue('width')).toBe(1920)
      expect(storedValue('height')).toBe(1080)
      expect(callbacks['width']).toHaveBeenCalledWith(1920)
      expect(callbacks['height']).toHaveBeenCalledWith(1080)
    })
  })

  describe('cursor visibility', () => {
    it('sets cursorVisible to true on pointer enter', () => {
      const { painter } = mountPainter()

      painter.handlePointerEnter()
      expect(painter.cursorVisible.value).toBe(true)
    })

    it('sets cursorVisible to false on pointer leave', () => {
      const { painter } = mountPainter()

      painter.handlePointerEnter()
      painter.handlePointerLeave()
      expect(painter.cursorVisible.value).toBe(false)
    })
  })

  describe('displayBrushSize', () => {
    it('scales brush size by canvas display ratio', () => {
      const { painter } = mountPainter()

      // canvasDisplayWidth=512, canvasWidth=512 → ratio=1
      // hardness=1 → effectiveRadius = radius * 1.0
      // displayBrushSize = (20/2) * 1.0 * 2 * 1 = 20
      expect(painter.displayBrushSize.value).toBe(20)
    })

    it('increases for soft brush hardness', () => {
      const { painter } = mountPainter()

      painter.brushHardness.value = 0
      // hardness=0 → effectiveRadius = 10 * 1.5 = 15
      // displayBrushSize = 15 * 2 * 1 = 30
      expect(painter.displayBrushSize.value).toBe(30)
    })
  })

  describe('activeHardness (via displayBrushSize)', () => {
    it('returns 1 for eraser regardless of brushHardness', () => {
      const { painter } = mountPainter()

      painter.brushHardness.value = 0.3
      painter.tool.value = 'eraser'

      // eraser hardness=1 → displayBrushSize = 10 * 1.0 * 2 = 20
      expect(painter.displayBrushSize.value).toBe(20)
    })

    it('uses brushHardness for brush tool', () => {
      const { painter } = mountPainter()

      painter.tool.value = 'brush'
      painter.brushHardness.value = 0.5
      // hardness=0.5 → scale=1.25 → 10*1.25*2 = 25
      expect(painter.displayBrushSize.value).toBe(25)
    })
  })

  describe('registerWidgetSerialization', () => {
    it('attaches serializeValue to the mask widget on init', () => {
      makePaintNode([{ name: 'mask', type: 'string', value: '' }])

      mountPainter()

      expect(widgetOf('mask').serializeValue).toBeTypeOf('function')
    })
  })

  describe('serializeValue', () => {
    it('returns existing modelValue when not dirty (preserves workflow-restored mask reference across WidgetPainter remount)', async () => {
      makePaintNode([{ name: 'mask', type: 'string', value: '' }])

      mountPainter(toNodeId('test-node'), 'painter/existing.png [temp]')

      const result = await widgetOf('mask').serializeValue!(paintNode(), 0)
      expect(result).toBe('painter/existing.png [temp]')
    })

    it('uploads the current canvas when no cached modelValue is present, even if nothing has been painted yet', async () => {
      makePaintNode([{ name: 'mask', type: 'string', value: '' }])

      const fetchApiMock = vi.mocked(api.fetchApi)
      fetchApiMock.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ name: 'uploaded.png' })
      } as Response)

      const fakeCanvas = fromPartial<HTMLCanvasElement>({
        width: 4,
        height: 4,
        toBlob: (cb: BlobCallback) => cb(new Blob(['x']))
      })

      const { canvasEl } = mountPainter(toNodeId('test-node'), '')
      canvasEl.value = fakeCanvas
      await nextTick()

      const result = await widgetOf('mask').serializeValue!(paintNode(), 0)
      expect(fetchApiMock).toHaveBeenCalledWith(
        '/upload/image',
        expect.objectContaining({ method: 'POST' })
      )
      expect(result).toBe('uploaded.png [input]')

      const [, init] = fetchApiMock.mock.calls[0]
      const body = init?.body as FormData
      expect(body).toBeInstanceOf(FormData)
      expect(body.get('type')).toBe('input')
      expect(body.get('subfolder')).toBeNull()
    })

    it('throws when the upload response is missing a name', async () => {
      makePaintNode([{ name: 'mask', type: 'string', value: '' }])

      vi.mocked(api.fetchApi).mockResolvedValueOnce({
        status: 200,
        json: async () => ({})
      } as Response)

      const fakeCanvas = fromPartial<HTMLCanvasElement>({
        width: 4,
        height: 4,
        toBlob: (cb: BlobCallback) => cb(new Blob(['x']))
      })

      const { canvasEl } = mountPainter(toNodeId('test-node'), '')
      canvasEl.value = fakeCanvas
      await nextTick()

      await expect(
        widgetOf('mask').serializeValue!(paintNode(), 0)
      ).rejects.toThrow(/missing 'name'/)
    })

    it('throws when the upload response body is not valid JSON', async () => {
      makePaintNode([{ name: 'mask', type: 'string', value: '' }])

      vi.mocked(api.fetchApi).mockResolvedValueOnce({
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token')
        }
      } as unknown as Response)

      const fakeCanvas = fromPartial<HTMLCanvasElement>({
        width: 4,
        height: 4,
        toBlob: (cb: BlobCallback) => cb(new Blob(['x']))
      })

      const { canvasEl } = mountPainter(toNodeId('test-node'), '')
      canvasEl.value = fakeCanvas
      await nextTick()

      await expect(
        widgetOf('mask').serializeValue!(paintNode(), 0)
      ).rejects.toThrow(/painter\.uploadError/)
    })

    it('returns existing modelValue when canvas element is unmounted at serialize time', async () => {
      makePaintNode([{ name: 'mask', type: 'string', value: '' }])

      mountPainter(toNodeId('test-node'), 'painter/cached.png [temp]')

      const result = await widgetOf('mask').serializeValue!(paintNode(), 0)
      expect(result).toBe('painter/cached.png [temp]')
    })

    it('clears the cached upload reference when the user clears the canvas', () => {
      makePaintNode([{ name: 'mask', type: 'string', value: '' }])

      const fakeCanvas = fromPartial<HTMLCanvasElement>({
        width: 4,
        height: 4,
        getContext: fromAny<HTMLCanvasElement['getContext'], unknown>(() =>
          fromPartial<CanvasRenderingContext2D>({ clearRect: vi.fn() })
        )
      })

      const { painter, canvasEl, modelValue } = mountPainter(
        toNodeId('test-node'),
        'painter/old-upload.png [temp]'
      )
      canvasEl.value = fakeCanvas

      painter.handleClear()

      expect(modelValue.value).toBe('')
    })
  })

  describe('restoreCanvas', () => {
    it('calls api.apiURL with parsed filename params when modelValue is set', () => {
      vi.mocked(api.apiURL).mockClear()

      mountPainter(toNodeId('test-node'), 'painter/my-image.png [temp]')

      expect(api.apiURL).toHaveBeenCalledWith(
        expect.stringContaining('filename=my-image.png')
      )
      expect(api.apiURL).toHaveBeenCalledWith(
        expect.stringContaining('subfolder=painter')
      )
      expect(api.apiURL).toHaveBeenCalledWith(
        expect.stringContaining('type=temp')
      )
    })
  })

  describe('handleClear', () => {
    it('does not throw when canvas element is null', () => {
      const { painter } = mountPainter()

      expect(() => painter.handleClear()).not.toThrow()
    })
  })

  describe('handlePointerDown', () => {
    it('ignores non-primary button clicks', () => {
      const { painter } = mountPainter()

      const mockSetPointerCapture = vi.fn()
      const event = new PointerEvent('pointerdown', {
        button: 2
      })
      Object.defineProperty(event, 'target', {
        value: {
          setPointerCapture: mockSetPointerCapture
        }
      })

      painter.handlePointerDown(event)

      expect(mockSetPointerCapture).not.toHaveBeenCalled()
    })

    it('tolerates setPointerCapture throwing for synthetic events', () => {
      const { painter } = mountPainter()

      const event = new PointerEvent('pointerdown', { button: 0, pointerId: 1 })
      Object.defineProperty(event, 'target', {
        value: {
          setPointerCapture: vi.fn(() => {
            throw new DOMException('NotFoundError')
          }),
          getBoundingClientRect: vi.fn(() => ({
            left: 0,
            top: 0,
            width: 100,
            height: 100
          }))
        }
      })

      expect(() => painter.handlePointerDown(event)).not.toThrow()
    })
  })

  describe('handlePointerUp', () => {
    it('ignores non-primary button releases', () => {
      const { painter } = mountPainter()

      const mockReleasePointerCapture = vi.fn()
      const event = {
        button: 2,
        target: {
          releasePointerCapture: mockReleasePointerCapture
        }
      } as unknown as PointerEvent

      painter.handlePointerUp(event)

      expect(mockReleasePointerCapture).not.toHaveBeenCalled()
    })

    it('tolerates releasePointerCapture throwing for synthetic events', () => {
      const { painter } = mountPainter()

      const event = {
        button: 0,
        pointerId: 1,
        target: {
          releasePointerCapture: vi.fn(() => {
            throw new DOMException('NotFoundError')
          })
        }
      } as unknown as PointerEvent

      expect(() => painter.handlePointerUp(event)).not.toThrow()
    })
  })
})
