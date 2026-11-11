import { useMaskEditorDataStore } from '@/renderer/extensions/maskEditor/stores/maskEditorDataStore'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import * as imageOutput from '@comfyorg/mask-editor/imageOutput'
import { useMaskEditorSaver } from './useMaskEditorSaver'

let mockDataStore: ReturnType<typeof useMaskEditorDataStore>

const CANVAS_SIZE = 4
const CANVAS_BYTES = CANVAS_SIZE * CANVAS_SIZE * 4

// Pixel model: each mock canvas owns an RGBA buffer, and drawImage /
// getImageData / putImageData move real data so the saver's compositing and
// encoding can be asserted on pixel values. drawImage implements source-over
// for the binary-alpha (0 or 255) fixtures these tests use.
const canvasPixels = new WeakMap<HTMLCanvasElement, Uint8ClampedArray>()

function createMockCtx(
  canvas: HTMLCanvasElement,
  pixels: Uint8ClampedArray
): CanvasRenderingContext2D {
  return fromPartial<CanvasRenderingContext2D>({
    canvas,
    drawImage: vi.fn((source: CanvasImageSource) => {
      const sourcePixels = canvasPixels.get(source as HTMLCanvasElement)
      if (!sourcePixels) return
      for (let i = 0; i < pixels.length; i += 4) {
        if (sourcePixels[i + 3] === 255) {
          pixels.set(sourcePixels.subarray(i, i + 4), i)
        }
      }
    }),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(pixels),
      width: CANVAS_SIZE,
      height: CANVAS_SIZE
    })),
    putImageData: vi.fn((imageData: ImageData) => {
      pixels.set(imageData.data)
    }),
    globalCompositeOperation: 'source-over'
  })
}

function createMockCanvas(seed?: Uint8ClampedArray): HTMLCanvasElement {
  const pixels = seed ?? new Uint8ClampedArray(CANVAS_BYTES)
  const canvas = fromPartial<HTMLCanvasElement>({
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    getContext(this: HTMLCanvasElement) {
      return createMockCtx(this, pixels)
    },
    toBlob: vi.fn((cb: BlobCallback) => {
      cb(new Blob(['x'], { type: 'image/png' }))
    }),
    toDataURL: vi.fn(() => 'data:image/png;base64,mock')
  })
  canvasPixels.set(canvas, pixels)
  return markRaw(canvas)
}

let mockEditorStore: ReturnType<typeof useMaskEditorStore>

vi.mock(import('@/scripts/api'))

vi.mock(import('@/scripts/app'))

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: false }))

vi.mock<unknown>(import('@/utils/graphTraversalUtil'), () => ({
  executionIdToNodeLocatorId: vi.fn((_rootGraph: unknown, id: string) => id)
}))

describe('useMaskEditorSaver', () => {
  let mockNode: LGraphNode
  const originalCreateElement = document.createElement.bind(document)

  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation(
      (route) => `http://localhost:8188${route}`
    )
    mockDataStore = useMaskEditorDataStore()
    mockEditorStore = useMaskEditorStore()

    mockNode = fromAny<LGraphNode, unknown>({
      id: 42,
      type: 'LoadImage',
      images: [],
      imgs: undefined,
      widgets: [
        { name: 'image', value: 'original.png [input]', callback: vi.fn() }
      ],
      widgets_values: ['original.png [input]'],
      properties: { image: 'original.png [input]' },
      graph: {
        setDirtyCanvas: vi.fn(),
        rootGraph: { id: 'maskeditor-saver-test' }
      }
    })
    useWidgetValueStore().registerWidget(
      widgetId('maskeditor-saver-test', toNodeId(42), 'image'),
      { type: 'string', value: 'original.png [input]', options: {} }
    )

    mockDataStore.sourceNode = mockNode
    mockDataStore.inputData = {
      baseLayer: { image: {} as HTMLImageElement, url: 'base.png' },
      maskLayer: { image: {} as HTMLImageElement, url: 'mask.png' },
      sourceRef: { filename: 'original.png', subfolder: '', type: 'input' },
      nodeId: toNodeId(42)
    }
    mockDataStore.outputData = null

    mockEditorStore.maskCanvas = createMockCanvas()
    mockEditorStore.rgbCanvas = createMockCanvas()
    mockEditorStore.imgCanvas = createMockCanvas()

    vi.mocked(api.fetchApi).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          name: 'clipspace-painted-masked-123.png',
          subfolder: 'clipspace',
          type: 'input'
        })
    } as Response)

    vi.spyOn(document, 'createElement').mockImplementation(
      (tagName: string, options?: ElementCreationOptions) => {
        if (tagName === 'canvas')
          return fromAny<HTMLCanvasElement, unknown>(createMockCanvas())
        return originalCreateElement(tagName, options)
      }
    )

    vi.stubGlobal(
      'Image',
      class MockImage {
        crossOrigin = ''
        onload: ((ev: Event) => void) | null = null
        onerror: ((ev: unknown) => void) | null = null
        private _src = ''
        get src() {
          return this._src
        }
        set src(value: string) {
          this._src = value
          queueMicrotask(() => this.onload?.(new Event('load')))
        }
      }
    )
  })

  it('registers node outputs in store after save for node without prior execution outputs', async () => {
    const store = useNodeOutputStore()
    const locatorId = String(mockNode.id)

    expect(app.nodeOutputs[locatorId]).toBeUndefined()

    const { save } = useMaskEditorSaver()
    await save()

    expect(store.nodeOutputs[locatorId]).toBeDefined()
    expect(store.nodeOutputs[locatorId]?.images?.length).toBeGreaterThan(0)
    expect(
      useWidgetValueStore().getWidget(
        widgetId('maskeditor-saver-test', toNodeId(42), 'image')
      )?.value
    ).toBe('clipspace-painted-masked-123.png [input]')
    expect(mockNode.properties['image']).toBe(
      'clipspace-painted-masked-123.png [input]'
    )
  })

  it('replaces a stale clipspace image with the saved image', async () => {
    mockNode.images = [
      {
        filename: 'pasted-before-edit.png',
        subfolder: 'clipspace',
        type: 'input'
      }
    ]

    await useMaskEditorSaver().save()

    expect(mockNode.images).toEqual([
      {
        filename: 'clipspace-painted-masked-123.png',
        subfolder: 'clipspace',
        type: 'input'
      }
    ])
  })

  it('does not write server references after the source node is detached', async () => {
    vi.mocked(api.fetchApi).mockImplementation(async () => {
      mockNode.graph = null
      return {
        ok: true,
        json: () =>
          Promise.resolve({
            name: 'clipspace-painted-masked-123.png',
            subfolder: 'clipspace',
            type: 'input'
          })
      } as Response
    })

    await useMaskEditorSaver().save()

    expect(useNodeOutputStore().nodeOutputs['42']).toBeUndefined()
    expect(mockNode.widgets?.[0].value).toBe('original.png [input]')
  })

  it('omits subfolder from the upload FormData under the unified contract', async () => {
    const { save } = useMaskEditorSaver()
    await save()

    expect(api.fetchApi).toHaveBeenCalledWith(
      '/upload/image',
      expect.objectContaining({ method: 'POST' })
    )
    const [, init] = vi.mocked(api.fetchApi).mock.calls[0]
    const body = init?.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('type')).toBe('input')
    expect(body.get('subfolder')).toBeNull()
  })

  it('uploads each named product after setting the local preview', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(456)
    const append = vi.spyOn(FormData.prototype, 'append')
    vi.spyOn(imageOutput, 'createImageOutput').mockResolvedValue({
      maskedImage: { canvas: createMockCanvas(), blob: new Blob(['mask']) },
      paintLayer: { canvas: createMockCanvas(), blob: new Blob(['paint']) },
      paintedImage: { canvas: createMockCanvas(), blob: new Blob(['painted']) },
      paintedMaskedImage: {
        canvas: createMockCanvas(),
        blob: new Blob(['painted-masked'])
      }
    })
    const uploads: Record<string, string> = {}
    vi.mocked(api.fetchApi).mockImplementation(async (_route, init) => {
      expect(mockNode.imgs?.[0].src).toBe('data:image/png;base64,mock')
      if (!(init?.body instanceof FormData)) throw new Error('Missing upload')
      const file = init.body.get('image')
      if (!(file instanceof File)) throw new Error('Missing image file')
      const imageAppend = append.mock.calls.find(
        ([name], index) =>
          name === 'image' && append.mock.contexts[index] === init.body
      )
      const filename = imageAppend?.[2]
      if (!filename) throw new Error('Missing image filename')
      uploads[filename] = await file.text()
      return Response.json({ name: `server-${filename}`, type: 'input' })
    })

    await useMaskEditorSaver().save()

    expect(uploads).toEqual({
      'clipspace-mask-456.png': 'mask',
      'clipspace-paint-456.png': 'paint',
      'clipspace-painted-456.png': 'painted',
      'clipspace-painted-masked-456.png': 'painted-masked'
    })
    expect(mockDataStore.outputData).toMatchObject({
      maskedImage: { ref: { filename: 'server-clipspace-mask-456.png' } },
      paintLayer: { ref: { filename: 'server-clipspace-paint-456.png' } },
      paintedImage: { ref: { filename: 'server-clipspace-painted-456.png' } },
      paintedMaskedImage: {
        ref: { filename: 'server-clipspace-painted-masked-456.png' }
      }
    })
    expect(mockNode.images?.[0].filename).toBe(
      'server-clipspace-painted-masked-456.png'
    )
  })

  it('retains the local preview without updating server references when an upload fails', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(456)
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(Response.json({ name: 'first-upload.png' }))
      .mockResolvedValueOnce(new Response('upload rejected', { status: 500 }))

    await expect(useMaskEditorSaver().save()).rejects.toThrow(
      'Failed to upload clipspace-paint-456.png (500: upload rejected)'
    )

    expect(api.fetchApi).toHaveBeenCalledTimes(2)
    expect(mockNode.imgs?.[0].src).toBe('data:image/png;base64,mock')
    expect(mockDataStore.outputData?.maskedImage.ref.filename).toBe(
      'clipspace-mask-456.png'
    )
    expect(mockNode.widgets?.[0].value).toBe('original.png [input]')
    expect(useNodeOutputStore().nodeOutputs['42']).toBeUndefined()
  })
})
