import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { StrokeProcessor } from '@/composables/maskeditor/StrokeProcessor'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

import { usePainter } from './usePainter'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      painter: {
        uploadError: 'Failed to upload painter image: {status} - {statusText}'
      }
    }
  }
})

vi.mock('@vueuse/core', () => ({
  useElementSize: vi.fn(() => ({
    width: ref(512),
    height: ref(512)
  }))
}))

vi.mock('@/composables/maskeditor/StrokeProcessor', () => ({
  StrokeProcessor: vi.fn(function StrokeProcessor() {
    return {
      addPoint: vi.fn(() => []),
      endStroke: vi.fn(() => [])
    }
  })
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/updates/common/toastStore', () => {
  const store = { addAlert: vi.fn() }
  return { useToastStore: () => store }
})

const mockNodeOutputStore = vi.hoisted(() => ({
  getNodeImageUrls: vi.fn(() => undefined as string[] | undefined),
  nodeOutputs: {},
  nodePreviewImages: {}
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => mockNodeOutputStore
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn((path: string) => `http://localhost:8188${path}`),
    fetchApi: vi.fn()
  }
}))

const mockWidgets: IBaseWidget[] = []
const mockProperties: Record<string, unknown> = {}
const mockIsInputConnected = vi.fn(() => false)
const mockGetInputNode = vi.fn((): LGraphNode | null => null)

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      graph: {
        getNodeById: vi.fn(() => ({
          get widgets() {
            return mockWidgets
          },
          get properties() {
            return mockProperties
          },
          isInputConnected: mockIsInputConnected,
          getInputNode: mockGetInputNode
        }))
      }
    }
  }
}))

type PainterResult = ReturnType<typeof usePainter>

function makeWidget(
  name: string,
  value: boolean | number | string | object | undefined = undefined
): IBaseWidget {
  return fromPartial<IBaseWidget>({
    name,
    value,
    callback: vi.fn(),
    serializeValue: undefined
  })
}

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

  const rendered = render(Wrapper, { global: { plugins: [i18n] } })
  return { painter, canvasEl, cursorEl, modelValue, unmount: rendered.unmount }
}

function createCanvasContext() {
  const gradient = { addColorStop: vi.fn() }
  return fromPartial<CanvasRenderingContext2D>({
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    globalCompositeOperation: '' as GlobalCompositeOperation,
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter'
  })
}

function createCanvasElement(
  ctx: CanvasRenderingContext2D,
  width = 100,
  height = 100
) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  vi.spyOn(canvas, 'getContext').mockReturnValue(fromPartial(ctx))
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: vi.fn()
  })
  vi.spyOn(canvas, 'toBlob').mockImplementation((cb) => cb(new Blob(['x'])))
  return canvas
}

async function mountPainterWithMaskCanvas({
  modelValue = '',
  toBlob = (cb: BlobCallback) => cb(new Blob(['x']))
}: {
  modelValue?: string
  toBlob?: (cb: BlobCallback) => void
} = {}) {
  const maskWidget = makeWidget('mask', '')
  mockWidgets.push(maskWidget)

  const fakeCanvas = fromPartial<HTMLCanvasElement>({
    width: 4,
    height: 4,
    getContext: vi.fn(() => ({ clearRect: vi.fn() })),
    toBlob
  })

  const mounted = mountPainter(toNodeId('test-node'), modelValue)
  mounted.canvasEl.value = fakeCanvas
  await nextTick()

  return { maskWidget, ...mounted }
}

function stubFakeImage() {
  const images: Array<{
    onload: (() => void) | null
    onerror: (() => void) | null
  }> = []
  class FakeImage {
    crossOrigin = ''
    naturalWidth = 64
    naturalHeight = 32
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    src = ''

    constructor() {
      images.push(this)
    }
  }
  vi.stubGlobal('Image', FakeImage)
  return images
}

function createPointerEvent(
  type: string,
  values: {
    clientX?: number
    clientY?: number
    offsetX?: number
    offsetY?: number
    button?: number
    pointerId?: number
    target?: Pick<HTMLElement, 'setPointerCapture' | 'releasePointerCapture'>
  } = {}
) {
  const event = new PointerEvent(type, {
    button: values.button ?? 0,
    clientX: values.clientX ?? 0,
    clientY: values.clientY ?? 0,
    pointerId: values.pointerId ?? 1
  })
  Object.defineProperty(event, 'offsetX', { value: values.offsetX ?? 0 })
  Object.defineProperty(event, 'offsetY', { value: values.offsetY ?? 0 })
  Object.defineProperty(event, 'target', {
    value:
      values.target ??
      ({
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn()
      } as Pick<HTMLElement, 'setPointerCapture' | 'releasePointerCapture'>)
  })
  return event
}

describe('usePainter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.resetAllMocks()
    mockWidgets.length = 0
    for (const key of Object.keys(mockProperties)) {
      delete mockProperties[key]
    }
    mockIsInputConnected.mockReturnValue(false)
    mockGetInputNode.mockReturnValue(null)
    mockNodeOutputStore.getNodeImageUrls.mockReturnValue(undefined)
  })

  describe('syncCanvasSizeFromWidgets', () => {
    it('reads width/height from widget values on initialization', () => {
      mockWidgets.push(makeWidget('width', 1024), makeWidget('height', 768))

      const { painter } = mountPainter()

      expect(painter.canvasWidth.value).toBe(1024)
      expect(painter.canvasHeight.value).toBe(768)
    })

    it('defaults to 512 when widgets are missing', () => {
      const { painter } = mountPainter()

      expect(painter.canvasWidth.value).toBe(512)
      expect(painter.canvasHeight.value).toBe(512)
    })

    it('keeps defaults when the node id is empty', async () => {
      const maskWidget = makeWidget('mask', '')
      mockWidgets.push(maskWidget)

      const { painter } = mountPainter(toNodeId(''))

      expect(app.canvas.graph!.getNodeById).not.toHaveBeenCalled()
      expect(painter.canvasWidth.value).toBe(512)
      expect(painter.canvasHeight.value).toBe(512)
      expect(painter.inputImageUrl.value).toBeNull()
      expect(painter.isImageInputConnected.value).toBe(false)
      expect(maskWidget.serializeValue).toBeUndefined()

      painter.brushSize.value = 36
      await nextTick()

      expect(mockProperties.painterBrushSize).toBeUndefined()
    })
  })

  describe('restoreSettingsFromProperties', () => {
    it('restores tool and brush settings from node properties on init', () => {
      mockProperties.painterTool = 'eraser'
      mockProperties.painterBrushSize = 42
      mockProperties.painterBrushColor = '#ff0000'
      mockProperties.painterBrushOpacity = 0.5
      mockProperties.painterBrushHardness = 0.8

      const { painter } = mountPainter()

      expect(painter.tool.value).toBe('eraser')
      expect(painter.brushSize.value).toBe(42)
      expect(painter.brushColor.value).toBe('#ff0000')
      expect(painter.brushOpacity.value).toBe(0.5)
      expect(painter.brushHardness.value).toBe(0.8)
    })

    it('restores backgroundColor from bg_color widget', () => {
      mockWidgets.push(makeWidget('bg_color', '#123456'))

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
      const { painter } = mountPainter()

      painter.tool.value = 'eraser'
      painter.brushSize.value = 50
      painter.brushColor.value = '#00ff00'
      painter.brushOpacity.value = 0.7
      painter.brushHardness.value = 0.3

      await nextTick()

      expect(mockProperties.painterTool).toBe('eraser')
      expect(mockProperties.painterBrushSize).toBe(50)
      expect(mockProperties.painterBrushColor).toBe('#00ff00')
      expect(mockProperties.painterBrushOpacity).toBe(0.7)
      expect(mockProperties.painterBrushHardness).toBe(0.3)
    })
  })

  describe('syncCanvasSizeToWidgets', () => {
    it('syncs canvas dimensions to widgets when size changes', async () => {
      const widthWidget = makeWidget('width', 512)
      const heightWidget = makeWidget('height', 512)
      mockWidgets.push(widthWidget, heightWidget)

      const { painter } = mountPainter()

      painter.canvasWidth.value = 800
      painter.canvasHeight.value = 600
      await nextTick()

      expect(widthWidget.value).toBe(800)
      expect(heightWidget.value).toBe(600)
      expect(widthWidget.callback).toHaveBeenCalledWith(800)
      expect(heightWidget.callback).toHaveBeenCalledWith(600)
    })

    it('skips widget callbacks when dimensions are unchanged', async () => {
      const widthWidget = makeWidget('width', 512)
      const heightWidget = makeWidget('height', 512)
      mockWidgets.push(widthWidget, heightWidget)

      mountPainter()
      await nextTick()

      expect(widthWidget.callback).not.toHaveBeenCalled()
      expect(heightWidget.callback).not.toHaveBeenCalled()
    })
  })

  describe('syncBackgroundColorToWidget', () => {
    it('syncs background color to widget when color changes', async () => {
      const bgWidget = makeWidget('bg_color', '#000000')
      mockWidgets.push(bgWidget)

      const { painter } = mountPainter()

      painter.backgroundColor.value = '#ff00ff'
      await nextTick()

      expect(bgWidget.value).toBe('#ff00ff')
      expect(bgWidget.callback).toHaveBeenCalledWith('#ff00ff')
    })

    it('skips widget callbacks when the background color is unchanged', async () => {
      const bgWidget = makeWidget('bg_color', '#000000')
      mockWidgets.push(bgWidget)

      mountPainter()
      await nextTick()

      expect(bgWidget.callback).not.toHaveBeenCalled()
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

    it('sets inputImageUrl from the connected input node output', () => {
      const inputNode = {} as LGraphNode
      mockIsInputConnected.mockReturnValue(true)
      mockGetInputNode.mockReturnValue(inputNode)
      mockNodeOutputStore.getNodeImageUrls.mockReturnValue([
        'http://localhost:8188/view?filename=input.png'
      ])

      const { painter } = mountPainter()

      expect(mockNodeOutputStore.getNodeImageUrls).toHaveBeenCalledWith(
        inputNode
      )
      expect(painter.inputImageUrl.value).toBe(
        'http://localhost:8188/view?filename=input.png'
      )
    })

    it('keeps inputImageUrl null when a connected input has no images', () => {
      mockIsInputConnected.mockReturnValue(true)
      mockGetInputNode.mockReturnValue({} as LGraphNode)
      mockNodeOutputStore.getNodeImageUrls.mockReturnValue([])

      const { painter } = mountPainter()

      expect(painter.inputImageUrl.value).toBeNull()
    })
  })

  describe('handleInputImageLoad', () => {
    it('updates canvas size and widgets from loaded image dimensions', () => {
      const widthWidget = makeWidget('width', 512)
      const heightWidget = makeWidget('height', 512)
      mockWidgets.push(widthWidget, heightWidget)

      const { painter } = mountPainter()

      const fakeEvent = fromPartial<Event>({
        target: { naturalWidth: 1920, naturalHeight: 1080 } as HTMLImageElement
      })

      painter.handleInputImageLoad(fakeEvent)

      expect(painter.canvasWidth.value).toBe(1920)
      expect(painter.canvasHeight.value).toBe(1080)
      expect(widthWidget.value).toBe(1920)
      expect(heightWidget.value).toBe(1080)
    })

    it('updates canvas size when dimension widgets are absent', () => {
      const { painter } = mountPainter()

      painter.handleInputImageLoad(
        fromPartial<Event>({
          target: { naturalWidth: 320, naturalHeight: 240 } as HTMLImageElement
        })
      )

      expect(painter.canvasWidth.value).toBe(320)
      expect(painter.canvasHeight.value).toBe(240)
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

    it('positions the custom cursor on pointer movement', () => {
      const { painter, cursorEl } = mountPainter()
      cursorEl.value = document.createElement('div')

      painter.handlePointerMove(
        createPointerEvent('pointermove', { offsetX: 25, offsetY: 30 })
      )

      expect(cursorEl.value.style.transform).toBe('translate(15px, 20px)')
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
      const maskWidget = makeWidget('mask', '')
      mockWidgets.push(maskWidget)

      mountPainter()

      expect(maskWidget.serializeValue).toBeTypeOf('function')
    })
  })

  describe('serializeValue', () => {
    it('returns existing modelValue when not dirty (preserves workflow-restored mask reference across WidgetPainter remount)', async () => {
      const maskWidget = makeWidget('mask', '')
      mockWidgets.push(maskWidget)

      mountPainter(toNodeId('test-node'), 'painter/existing.png [temp]')

      const result = await maskWidget.serializeValue!({} as LGraphNode, 0)
      expect(result).toBe('painter/existing.png [temp]')
    })

    it('uploads the current canvas when no cached modelValue is present, even if nothing has been painted yet', async () => {
      const fetchApiMock = vi.mocked(api.fetchApi)
      fetchApiMock.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ name: 'uploaded.png' })
      } as Response)

      const { maskWidget } = await mountPainterWithMaskCanvas()

      const result = await maskWidget.serializeValue!({} as LGraphNode, 0)
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
      vi.mocked(api.fetchApi).mockResolvedValueOnce({
        status: 200,
        json: async () => ({})
      } as Response)

      const { maskWidget } = await mountPainterWithMaskCanvas()

      await expect(
        maskWidget.serializeValue!({} as LGraphNode, 0)
      ).rejects.toThrow(/missing 'name'/)
    })

    it('throws when the upload request fails', async () => {
      vi.mocked(api.fetchApi).mockRejectedValueOnce(new Error('offline'))

      const { maskWidget } = await mountPainterWithMaskCanvas()

      await expect(
        maskWidget.serializeValue!({} as LGraphNode, 0)
      ).rejects.toThrow(/Failed to upload painter image/)
    })

    it('reports non-error upload rejections', async () => {
      vi.mocked(api.fetchApi).mockRejectedValueOnce('offline')

      const { maskWidget } = await mountPainterWithMaskCanvas()

      await expect(
        maskWidget.serializeValue!({} as LGraphNode, 0)
      ).rejects.toThrow(/offline/)
    })

    it('throws when the upload response is not successful', async () => {
      vi.mocked(api.fetchApi).mockResolvedValueOnce({
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'upload failed'
      } as Response)

      const { maskWidget } = await mountPainterWithMaskCanvas()

      await expect(
        maskWidget.serializeValue!({} as LGraphNode, 0)
      ).rejects.toThrow(/upload failed/)
    })

    it('uses statusText when an unsuccessful upload response has no body', async () => {
      vi.mocked(api.fetchApi).mockResolvedValueOnce({
        status: 502,
        statusText: 'Bad Gateway',
        text: async () => ''
      } as Response)

      const { maskWidget } = await mountPainterWithMaskCanvas()

      await expect(
        maskWidget.serializeValue!({} as LGraphNode, 0)
      ).rejects.toThrow(/Bad Gateway/)
    })

    it('uses unknown error when an unsuccessful upload response has no detail', async () => {
      vi.mocked(api.fetchApi).mockResolvedValueOnce({
        status: 500,
        statusText: '',
        text: async () => ''
      } as Response)

      const { maskWidget } = await mountPainterWithMaskCanvas()

      await expect(
        maskWidget.serializeValue!({} as LGraphNode, 0)
      ).rejects.toThrow(/unknown error/)
    })

    it('throws when the upload response body is not valid JSON', async () => {
      vi.mocked(api.fetchApi).mockResolvedValueOnce(
        fromPartial<Response>({
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token')
          }
        })
      )

      const { maskWidget } = await mountPainterWithMaskCanvas()

      await expect(
        maskWidget.serializeValue!({} as LGraphNode, 0)
      ).rejects.toThrow(/Failed to upload painter image/)
    })

    it('reports non-error JSON parse failures', async () => {
      vi.mocked(api.fetchApi).mockResolvedValueOnce(
        fromPartial<Response>({
          status: 200,
          json: async () => {
            throw 'bad json'
          }
        })
      )

      const { maskWidget } = await mountPainterWithMaskCanvas()

      await expect(
        maskWidget.serializeValue!({} as LGraphNode, 0)
      ).rejects.toThrow(/bad json/)
    })

    it('returns modelValue when dirty canvas serialization produces no blob', async () => {
      const { painter, maskWidget } = await mountPainterWithMaskCanvas({
        toBlob: (cb) => cb(null)
      })

      painter.handleClear()
      await nextTick()

      const result = await maskWidget.serializeValue!({} as LGraphNode, 0)

      expect(result).toBe('')
      expect(api.fetchApi).not.toHaveBeenCalled()
    })

    it('returns existing modelValue when canvas serialization produces no blob', async () => {
      const toBlob = vi.fn((cb: BlobCallback) => cb(null))
      const { painter, maskWidget, modelValue } =
        await mountPainterWithMaskCanvas({
          modelValue: 'painter/cached.png [temp]',
          toBlob
        })

      // handleClear marks the canvas dirty; restore the cached value it wipes
      painter.handleClear()
      modelValue.value = 'painter/cached.png [temp]'
      await nextTick()

      const result = await maskWidget.serializeValue!({} as LGraphNode, 0)

      expect(toBlob).toHaveBeenCalled()
      expect(result).toBe('painter/cached.png [temp]')
      expect(api.fetchApi).not.toHaveBeenCalled()
    })

    it('returns existing modelValue when canvas element is unmounted at serialize time', async () => {
      const maskWidget = makeWidget('mask', '')
      mockWidgets.push(maskWidget)

      mountPainter(toNodeId('test-node'), 'painter/cached.png [temp]')

      const result = await maskWidget.serializeValue!({} as LGraphNode, 0)
      expect(result).toBe('painter/cached.png [temp]')
    })

    it('clears the cached upload reference when the user clears the canvas', () => {
      const maskWidget = makeWidget('mask', '')
      mockWidgets.push(maskWidget)

      const fakeCanvas = fromPartial<HTMLCanvasElement>({
        width: 4,
        height: 4,
        getContext: vi.fn(() => ({
          clearRect: vi.fn()
        }))
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

    it('defaults restored mask type to input when no type suffix exists', () => {
      vi.mocked(api.apiURL).mockClear()

      mountPainter(toNodeId('test-node'), 'plain.png')

      expect(api.apiURL).toHaveBeenCalledWith(
        expect.stringContaining('filename=plain.png')
      )
      expect(api.apiURL).toHaveBeenCalledWith(
        expect.stringContaining('type=input')
      )
      expect(api.apiURL).not.toHaveBeenCalledWith(
        expect.stringContaining('subfolder=')
      )
    })

    it('does not restore a canvas when the mask value is blank', () => {
      vi.mocked(api.apiURL).mockClear()

      mountPainter(toNodeId('test-node'), '   ')

      expect(api.apiURL).not.toHaveBeenCalled()
    })

    it('draws a restored mask after the image loads', () => {
      const images = stubFakeImage()
      const ctx = createCanvasContext()
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        fromPartial(ctx)
      )

      const { painter, canvasEl } = mountPainter(
        toNodeId('test-node'),
        'painter/mask.png [temp]'
      )
      canvasEl.value = createCanvasElement(ctx)
      images[0].onload?.()

      expect(painter.canvasWidth.value).toBe(64)
      expect(painter.canvasHeight.value).toBe(32)
      expect(ctx.drawImage).toHaveBeenCalled()
    })

    it('ignores restored image loads after the canvas unmounts', () => {
      const images = stubFakeImage()
      const ctx = createCanvasContext()
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        fromPartial(ctx)
      )

      const { painter, canvasEl, unmount } = mountPainter(
        toNodeId('test-node'),
        'painter/mask.png [temp]'
      )
      canvasEl.value = createCanvasElement(ctx)
      unmount()
      // Vue clears template refs on unmount
      canvasEl.value = null
      images[0].onload?.()

      expect(painter.canvasWidth.value).toBe(512)
      expect(painter.canvasHeight.value).toBe(512)
      expect(ctx.drawImage).not.toHaveBeenCalled()
    })

    it('clears stale modelValue when restored image loading fails', () => {
      const images = stubFakeImage()

      const { modelValue } = mountPainter(
        toNodeId('test-node'),
        'painter/mask.png [temp]'
      )
      images[0].onerror?.()

      expect(modelValue.value).toBe('')
    })
  })

  describe('handleClear', () => {
    it('does not throw when canvas element is null', () => {
      const { painter } = mountPainter()

      expect(() => painter.handleClear()).not.toThrow()
    })

    it('clears the canvas and marks the current mask dirty', async () => {
      const maskWidget = makeWidget('mask', '')
      const ctx = createCanvasContext()
      mockWidgets.push(maskWidget)
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        fromPartial(ctx)
      )

      const { painter, canvasEl, modelValue } = mountPainter(
        toNodeId('test-node'),
        'painter/cached.png [temp]'
      )
      canvasEl.value = createCanvasElement(ctx, 50, 40)

      painter.handleClear()
      await nextTick()

      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 50, 40)
      expect(modelValue.value).toBe('')

      vi.mocked(api.fetchApi).mockResolvedValueOnce({
        status: 200,
        json: async () => ({ name: 'cleared.png' })
      } as Response)

      await expect(
        maskWidget.serializeValue!({} as LGraphNode, 0)
      ).resolves.toBe('cleared.png [input]')
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

    it('draws a hard brush stroke across pointer events', () => {
      const ctx = createCanvasContext()
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        fromPartial(ctx)
      )
      const { painter, canvasEl } = mountPainter()
      canvasEl.value = createCanvasElement(ctx)

      painter.handlePointerDown(
        createPointerEvent('pointerdown', { clientX: 10, clientY: 10 })
      )
      painter.handlePointerMove(
        createPointerEvent('pointermove', {
          clientX: 60,
          clientY: 10,
          offsetX: 60,
          offsetY: 10
        })
      )
      painter.handlePointerUp(createPointerEvent('pointerup'))

      expect(ctx.arc).toHaveBeenCalled()
      expect(ctx.moveTo).toHaveBeenCalled()
      expect(ctx.lineTo).toHaveBeenCalled()
      expect(ctx.stroke).toHaveBeenCalled()
      expect(ctx.drawImage).toHaveBeenCalled()
    })

    it('draws a soft brush stroke with radial dabs', () => {
      const ctx = createCanvasContext()
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        fromPartial(ctx)
      )
      const { painter, canvasEl } = mountPainter()
      canvasEl.value = createCanvasElement(ctx)
      painter.brushHardness.value = 0.5

      painter.handlePointerDown(
        createPointerEvent('pointerdown', { clientX: 10, clientY: 10 })
      )
      painter.handlePointerMove(
        createPointerEvent('pointermove', { clientX: 70, clientY: 10 })
      )
      painter.handlePointerUp(createPointerEvent('pointerup'))

      expect(ctx.createRadialGradient).toHaveBeenCalled()
      expect(ctx.arc).toHaveBeenCalled()
      expect(ctx.drawImage).toHaveBeenCalled()
    })

    it('uses destination-out composition for eraser strokes', () => {
      const ctx = createCanvasContext()
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        fromPartial(ctx)
      )
      const { painter, canvasEl } = mountPainter()
      canvasEl.value = createCanvasElement(ctx)
      painter.tool.value = 'eraser'

      painter.handlePointerDown(
        createPointerEvent('pointerdown', { clientX: 10, clientY: 10 })
      )

      expect(ctx.globalCompositeOperation).toBe('destination-out')
    })

    it('does not start drawing when a canvas context is unavailable', () => {
      const canvas = document.createElement('canvas')
      vi.spyOn(canvas, 'getContext').mockReturnValue(null)
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: vi.fn()
      })
      const { painter, canvasEl } = mountPainter()
      canvasEl.value = canvas

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        expect(() => {
          painter.handlePointerDown(
            createPointerEvent('pointerdown', { clientX: 10, clientY: 10 })
          )
          painter.handlePointerMove(
            createPointerEvent('pointermove', { clientX: 20, clientY: 20 })
          )
          painter.handlePointerUp(createPointerEvent('pointerup'))
        }).not.toThrow()

        expect(canvas.getContext).toHaveBeenCalledWith('2d')
        expect(errorSpy).not.toHaveBeenCalled()
      } finally {
        errorSpy.mockRestore()
      }
    })

    it('uses one animation frame for pending pointer movement', () => {
      const ctx = createCanvasContext()
      let frameCallback: FrameRequestCallback | undefined
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
        (callback) => {
          frameCallback = callback
          return 7
        }
      )
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        fromPartial(ctx)
      )
      const { painter, canvasEl } = mountPainter()
      canvasEl.value = createCanvasElement(ctx)

      painter.handlePointerDown(
        createPointerEvent('pointerdown', { clientX: 10, clientY: 10 })
      )
      painter.handlePointerMove(
        createPointerEvent('pointermove', { clientX: 20, clientY: 20 })
      )
      painter.handlePointerMove(
        createPointerEvent('pointermove', { clientX: 30, clientY: 30 })
      )

      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1)

      frameCallback?.(0)

      expect(ctx.lineTo).toHaveBeenCalled()
    })

    it('flushes a pending pointer movement when leaving the canvas', () => {
      const ctx = createCanvasContext()
      vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(7)
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        fromPartial(ctx)
      )
      const { painter, canvasEl } = mountPainter()
      canvasEl.value = createCanvasElement(ctx)

      painter.handlePointerDown(
        createPointerEvent('pointerdown', { clientX: 10, clientY: 10 })
      )
      painter.handlePointerMove(
        createPointerEvent('pointermove', { clientX: 20, clientY: 20 })
      )
      painter.handlePointerLeave()

      expect(window.cancelAnimationFrame).toHaveBeenCalledWith(7)
      expect(ctx.lineTo).toHaveBeenCalled()
    })

    it('cancels a pending pointer movement when unmounted', () => {
      const ctx = createCanvasContext()
      vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(7)
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        fromPartial(ctx)
      )
      const { painter, canvasEl, unmount } = mountPainter()
      canvasEl.value = createCanvasElement(ctx)

      painter.handlePointerDown(
        createPointerEvent('pointerdown', { clientX: 10, clientY: 10 })
      )
      painter.handlePointerMove(
        createPointerEvent('pointermove', { clientX: 20, clientY: 20 })
      )
      unmount()

      expect(window.cancelAnimationFrame).toHaveBeenCalledWith(7)
    })
  })

  describe('handlePointerUp', () => {
    it('ignores non-primary button releases', () => {
      const { painter } = mountPainter()

      const mockReleasePointerCapture = vi.fn()
      const event = createPointerEvent('pointerup', {
        button: 2,
        target: {
          setPointerCapture: vi.fn(),
          releasePointerCapture: mockReleasePointerCapture
        }
      })

      painter.handlePointerUp(event)

      expect(mockReleasePointerCapture).not.toHaveBeenCalled()
    })

    it('tolerates releasePointerCapture throwing for synthetic events', () => {
      const { painter } = mountPainter()

      const event = createPointerEvent('pointerup', {
        button: 0,
        pointerId: 1,
        target: {
          setPointerCapture: vi.fn(),
          releasePointerCapture: vi.fn(() => {
            throw new DOMException('NotFoundError')
          })
        }
      })

      expect(() => painter.handlePointerUp(event)).not.toThrow()
    })

    it('draws final stroke processor points on release', () => {
      const ctx = createCanvasContext()
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        fromPartial(ctx)
      )
      vi.mocked(StrokeProcessor).mockImplementationOnce(
        class extends StrokeProcessor {
          constructor() {
            super(1)
          }
          override addPoint = vi.fn(() => [])
          override endStroke = vi.fn(() => [
            { x: 40, y: 10 },
            { x: 80, y: 10 }
          ])
        }
      )
      const { painter, canvasEl } = mountPainter()
      canvasEl.value = createCanvasElement(ctx)

      painter.handlePointerDown(
        createPointerEvent('pointerdown', { clientX: 10, clientY: 10 })
      )
      painter.handlePointerUp(createPointerEvent('pointerup'))

      expect(ctx.moveTo).toHaveBeenCalledWith(10, 10)
      expect(ctx.lineTo).toHaveBeenCalledWith(40, 10)
      expect(ctx.lineTo).toHaveBeenCalledWith(80, 10)
    })
  })
})
