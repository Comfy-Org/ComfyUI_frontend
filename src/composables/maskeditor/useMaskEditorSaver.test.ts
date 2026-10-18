import { readFile } from 'node:fs/promises'
import { useMaskEditorDataStore } from '@/stores/maskEditorDataStore'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { encodeRgbaAsPng } from '@/utils/pngEncodeUtil'
import { decodePng } from '@/utils/__fixtures__/decodePng'
import { useMaskEditorSaver } from './useMaskEditorSaver'

let mockDataStore: ReturnType<typeof useMaskEditorDataStore>

const CANVAS_SIZE = 4
const CANVAS_BYTES = CANVAS_SIZE * CANVAS_SIZE * 4
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

  beforeEach(async () => {
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

    const original = await encodeRgbaAsPng({
      data: new Uint8ClampedArray([20, 30, 40, 255]),
      width: 1,
      height: 1
    })
    vi.mocked(api.fetchApi).mockImplementation(async (route) => {
      if (route.startsWith('/view?')) return new Response(original)
      return Response.json({
        name: 'clipspace-painted-masked-123.png',
        subfolder: 'clipspace',
        type: 'input'
      })
    })

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

  it('preserves source PNG prompt and workflow metadata in the edited image', async () => {
    const original = await readFile(
      'src/scripts/metadata/__fixtures__/with_metadata.png'
    )
    const originalBlob = new Blob([original], { type: 'image/png' })

    mockDataStore.inputData!.sourceRef = {
      filename: 'with metadata #1.png',
      subfolder: 'my inputs',
      type: 'input'
    }
    const uploaded: File[] = []
    vi.mocked(api.fetchApi).mockImplementation(async (route, options) => {
      if (route.startsWith('/view?')) return new Response(originalBlob)
      const data = options?.body
      if (!(data instanceof FormData))
        return new Response(null, { status: 400 })
      const file = data.get('image')
      if (!(file instanceof File)) return new Response(null, { status: 400 })
      uploaded.push(file)
      return Response.json({
        name: file.name,
        subfolder: 'clipspace',
        type: 'input'
      })
    })

    await useMaskEditorSaver().save()

    expect(api.fetchApi).toHaveBeenCalledWith(
      '/view?filename=with+metadata+%231.png&type=input&subfolder=my+inputs'
    )
    const edited = uploaded.at(-1)
    expect(edited).toBeDefined()
    const text = new TextDecoder().decode(await edited!.arrayBuffer())
    expect(text).toContain(
      'prompt\0{"1":{"class_type":"KSampler","inputs":{}}}'
    )
    expect(text).toContain(
      'workflow\0{"nodes":[{"id":1,"type":"KSampler","pos":[100,100],"size":[200,200]}]}'
    )
  })

  it.for(['http', 'network', 'invalid-png'] as const)(
    'refuses to discard metadata after a %s source failure',
    async (failure) => {
      const request = vi.mocked(api.fetchApi).getMockImplementation()!
      const invalidPng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
      vi.mocked(api.fetchApi).mockImplementation((route, options) => {
        if (!route.startsWith('/view?')) return request(route, options)
        if (failure === 'network')
          return Promise.reject(new TypeError('offline'))
        return Promise.resolve(
          failure === 'http'
            ? new Response(null, { status: 404 })
            : new Response(invalidPng)
        )
      })

      expect(await useMaskEditorSaver().save()).toBe(false)

      expect(mockDataStore.outputData).toBeNull()
      expect(mockNode.widgets?.[0].value).toBe('original.png [input]')
      expect(api.fetchApi).not.toHaveBeenCalledWith(
        '/upload/image',
        expect.anything()
      )
    }
  )

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
    const request = vi.mocked(api.fetchApi).getMockImplementation()!
    vi.mocked(api.fetchApi).mockImplementation(async (route, options) => {
      if (options?.method === 'POST') mockNode.graph = null
      return request(route, options)
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
    const [, init] = vi
      .mocked(api.fetchApi)
      .mock.calls.find(([, options]) => options?.method === 'POST')!
    const body = init?.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('type')).toBe('input')
    expect(body.get('subfolder')).toBeNull()
  })

  it('uploads masked layers with inverted mask alpha and preserved RGB', async () => {
    const imgPixels = new Uint8ClampedArray(CANVAS_BYTES)
    for (let p = 0; p < CANVAS_BYTES / 4; p++) {
      imgPixels[p * 4] = (p * 7) % 256
      imgPixels[p * 4 + 1] = (p * 11) % 256
      imgPixels[p * 4 + 2] = (p * 13) % 256
      imgPixels[p * 4 + 3] = 255
    }
    const maskPixels = new Uint8ClampedArray(CANVAS_BYTES)
    for (let p = 0; p < CANVAS_BYTES / 8; p++) {
      maskPixels[p * 4 + 3] = 255
    }
    mockEditorStore.imgCanvas = createMockCanvas(imgPixels)
    mockEditorStore.maskCanvas = createMockCanvas(maskPixels)
    mockEditorStore.rgbCanvas = createMockCanvas()

    const { save } = useMaskEditorSaver()
    await save()

    expect(api.fetchApi).toHaveBeenCalledTimes(5)
    const decodedUploads = []
    for (const [, init] of vi
      .mocked(api.fetchApi)
      .mock.calls.filter(([, options]) => options?.method === 'POST')) {
      const body = init?.body as FormData
      const file = body.get('image') as Blob
      try {
        decodedUploads.push(decodePng(new Uint8Array(await file.arrayBuffer())))
      } catch {
        continue
      }
    }

    expect(decodedUploads).toHaveLength(2)
    for (const { width, height, pixels } of decodedUploads) {
      expect(width).toBe(CANVAS_SIZE)
      expect(height).toBe(CANVAS_SIZE)
      for (let i = 0; i < pixels.length; i += 4) {
        expect(pixels[i + 3]).toBe(255 - maskPixels[i + 3])
        expect(pixels[i]).toBe(imgPixels[i])
        expect(pixels[i + 1]).toBe(imgPixels[i + 1])
        expect(pixels[i + 2]).toBe(imgPixels[i + 2])
      }
    }
  })
})
