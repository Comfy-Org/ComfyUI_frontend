import { readFile } from 'node:fs/promises'
import { crc32, deflateSync } from 'node:zlib'
import { useMaskEditorDataStore } from '@/renderer/extensions/maskEditor/stores/maskEditorDataStore'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { encodeRgbaAsPng } from '@/utils/pngEncodeUtil'
import { decodePng } from '@/utils/__fixtures__/decodePng'
import { useMaskEditorSaver } from './useMaskEditorSaver'
import { useMaskEditorLoader } from './useMaskEditorLoader'
import { reportError } from '@comfyorg/telemetry/reportError'

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
vi.mock(import('@comfyorg/telemetry/reportError'))

vi.mock(import('@/scripts/app'))

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: false }))

vi.mock<unknown>(import('@/utils/graphTraversalUtil'), () => ({
  executionIdToNodeLocatorId: vi.fn((_rootGraph: unknown, id: string) => id)
}))

function textChunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(data.length + 12)
  new DataView(bytes.buffer).setUint32(0, data.length)
  bytes.set(Buffer.from(type), 4)
  bytes.set(data, 8)
  new DataView(bytes.buffer).setUint32(
    data.length + 8,
    crc32(bytes.subarray(4, data.length + 8))
  )
  return bytes
}

async function savedPng(blob: Blob | undefined) {
  assert.exists(blob)
  return decodePng(new Uint8Array(await blob.arrayBuffer()))
}

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

  it('preserves source PNG metadata after saving and reopening for another edit', async () => {
    const original = await readFile(
      'src/scripts/metadata/__fixtures__/with_metadata.png'
    )
    const originalBlob = new Blob(
      [
        original.subarray(0, 33),
        textChunk('tEXt', Buffer.from('description\0café', 'latin1')),
        textChunk(
          'zTXt',
          Buffer.concat([
            Buffer.from('compressed\0\0'),
            deflateSync('compressed workflow')
          ])
        ),
        textChunk('iTXt', Buffer.from('parameters\0\0\0\0\0中文提示词')),
        original.subarray(33)
      ],
      { type: 'image/png' }
    )

    mockDataStore.inputData!.sourceRef = {
      filename: 'with metadata #1.png',
      subfolder: 'my inputs',
      type: 'input'
    }
    mockNode.previewMediaType = 'image'
    const append = FormData.prototype.append
    vi.spyOn(FormData.prototype, 'append').mockImplementation(
      function (this: FormData, name, value, filename) {
        append.call(
          this,
          name,
          value instanceof Blob
            ? new File([value], filename ?? 'blob', { type: value.type })
            : value
        )
      }
    )
    const uploaded = new Map<string, Blob>([
      ['with metadata #1.png', originalBlob]
    ])
    vi.mocked(api.fetchApi).mockImplementation(async (route, options) => {
      if (route.startsWith('/view?')) {
        const filename = new URLSearchParams(route.slice(6)).get('filename')
        const file = uploaded.get(filename ?? '')
        return file ? new Response(file) : new Response(null, { status: 404 })
      }
      const data = options?.body
      if (!(data instanceof FormData))
        return new Response(null, { status: 400 })
      const file = data.get('image')
      if (!(file instanceof File)) return new Response(null, { status: 400 })
      uploaded.set(file.name, file)
      return Response.json({
        name: file.name,
        subfolder: 'clipspace',
        type: 'input'
      })
    })

    await useMaskEditorSaver().save()
    assert.exists(mockDataStore.outputData)
    const firstPng = await savedPng(
      uploaded.get(mockDataStore.outputData.paintedMaskedImage.ref.filename)
    )

    await useMaskEditorLoader().loadFromNode(mockNode)
    expect(mockDataStore.inputData?.sourceRef.filename).toMatch(
      /^clipspace-mask-\d+\.png$/
    )
    await useMaskEditorSaver().save()

    assert.exists(mockDataStore.outputData)
    const secondPng = await savedPng(
      uploaded.get(mockDataStore.outputData.paintedMaskedImage.ref.filename)
    )
    const maskPng = await savedPng(
      uploaded.get(mockDataStore.outputData.maskedImage.ref.filename)
    )
    const expected = [
      { type: 'zTXt', keyword: 'compressed', text: 'compressed workflow' },
      { type: 'tEXt', keyword: 'description', text: 'café' },
      { type: 'iTXt', keyword: 'parameters', text: '中文提示词' },
      {
        type: 'tEXt',
        keyword: 'prompt',
        text: '{"1":{"class_type":"KSampler","inputs":{}}}'
      },
      {
        type: 'tEXt',
        keyword: 'workflow',
        text: '{"nodes":[{"id":1,"type":"KSampler","pos":[100,100],"size":[200,200]}]}'
      }
    ]
    expect(
      [firstPng, secondPng, maskPng].map((png) =>
        png.textChunks.toSorted((a, b) => a.keyword.localeCompare(b.keyword))
      )
    ).toEqual([expected, expected, expected])
  })

  it.for([
    {
      name: 'http',
      response: () => Promise.resolve(new Response(null, { status: 404 })),
      message: 'Failed to read mask editor source image (404)'
    },
    {
      name: 'network',
      response: () => Promise.reject(new TypeError('offline')),
      message: 'offline'
    },
    {
      name: 'body',
      response: () => {
        const response = new Response()
        vi.spyOn(response, 'arrayBuffer').mockRejectedValue(
          new Error('body read failed')
        )
        return Promise.resolve(response)
      },
      message: 'body read failed'
    },
    ...[12, 8].map((missingBytes) => ({
      name: `truncated-png-${missingBytes}`,
      response: async () =>
        new Response(
          (
            await encodeRgbaAsPng({
              data: new Uint8ClampedArray([10, 20, 30, 255]),
              width: 1,
              height: 1
            })
          ).slice(0, -missingBytes)
        ),
      message: 'Invalid mask editor source PNG'
    })),
    {
      name: 'invalid-png',
      response: () =>
        Promise.resolve(
          new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))
        ),
      message: 'Invalid mask editor source PNG'
    }
  ])(
    'reports a $name source failure once and still saves the edited pixels',
    async ({ response, message }) => {
      mockEditorStore.imgCanvas = createMockCanvas(
        Uint8ClampedArray.from(
          { length: CANVAS_BYTES },
          (_, i) => [10, 20, 30, 255][i % 4]
        )
      )
      const request = vi.mocked(api.fetchApi).getMockImplementation()!
      vi.mocked(api.fetchApi).mockImplementation((route, options) =>
        route.startsWith('/view?') ? response() : request(route, options)
      )

      await useMaskEditorSaver().save()

      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ message }),
        {
          errorType: 'error_loading_mask_editor_source_image',
          surface: 'graph'
        }
      )
      assert.exists(mockDataStore.outputData)
      const png = await savedPng(
        mockDataStore.outputData.paintedMaskedImage.blob
      )
      expect(Array.from(png.pixels.slice(0, 4))).toEqual([10, 20, 30, 255])
      expect(png.textChunks).toEqual([])
      expect(
        vi
          .mocked(api.fetchApi)
          .mock.calls.filter(([, options]) => options?.method === 'POST')
      ).toHaveLength(4)
      expect(mockNode.widgets?.[0].value).toBe(
        'clipspace-painted-masked-123.png [input]'
      )
      expect(api.fetchApi).toHaveBeenCalledWith(
        '/upload/image',
        expect.anything()
      )
    }
  )

  it('captures the originating pixels before a pending source read outlives its editor canvases', async () => {
    let resolveSource!: (response: Response) => void
    let sourceStarted!: () => void
    const source = new Promise<Response>((resolve) => {
      resolveSource = resolve
    })
    const started = new Promise<void>((resolve) => {
      sourceStarted = resolve
    })
    const request = vi.mocked(api.fetchApi).getMockImplementation()!
    vi.mocked(api.fetchApi).mockImplementation((route, options) => {
      if (route.startsWith('/view?')) {
        sourceStarted()
        return source
      }
      return request(route, options)
    })
    mockEditorStore.imgCanvas = createMockCanvas(
      Uint8ClampedArray.from(
        { length: CANVAS_BYTES },
        (_, i) => [10, 20, 30, 255][i % 4]
      )
    )
    const save = useMaskEditorSaver().save()
    await started
    mockEditorStore.imgCanvas = createMockCanvas(
      Uint8ClampedArray.from(
        { length: CANVAS_BYTES },
        (_, i) => [99, 88, 77, 255][i % 4]
      )
    )
    resolveSource(
      new Response(
        await encodeRgbaAsPng({
          data: new Uint8ClampedArray([1, 2, 3, 255]),
          width: 1,
          height: 1
        })
      )
    )
    await save
    assert.exists(mockDataStore.outputData)
    const png = await savedPng(mockDataStore.outputData.paintedMaskedImage.blob)
    expect(Array.from(png.pixels.slice(0, 4))).toEqual([10, 20, 30, 255])
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
