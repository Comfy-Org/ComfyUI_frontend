import { createTestingPinia } from '@pinia/testing'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { decodePng } from '@/utils/__fixtures__/decodePng'
import { useMaskEditorSaver } from './useMaskEditorSaver'

// ---- Module Mocks ----

const mockDataStore: Record<string, unknown> = {
  sourceNode: null,
  inputData: null,
  outputData: null
}

vi.mock('@/stores/maskEditorDataStore', () => ({
  useMaskEditorDataStore: vi.fn(() => mockDataStore)
}))

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
  return canvas
}

const mockEditorStore: Record<string, HTMLCanvasElement | null> = {
  maskCanvas: null,
  rgbCanvas: null,
  imgCanvas: null
}

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: vi.fn(() => mockEditorStore)
}))

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    apiURL: vi.fn((route: string) => `http://localhost:8188${route}`)
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: { setDirty: vi.fn() },
    nodeOutputs: {} as Record<string, unknown>,
    nodePreviewImages: {} as Record<string, string[]>,
    getPreviewFormatParam: vi.fn(() => ''),
    getRandParam: vi.fn(() => '')
  }
}))

vi.mock('@/platform/distribution/types', () => ({ isCloud: false }))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    nodeIdToNodeLocatorId: vi.fn((id: string | number) => String(id)),
    nodeToNodeLocatorId: vi.fn((node: { id: number }) => String(node.id))
  }))
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  executionIdToNodeLocatorId: vi.fn((_rootGraph: unknown, id: string) => id)
}))

describe('useMaskEditorSaver', () => {
  let mockNode: LGraphNode
  const originalCreateElement = document.createElement.bind(document)

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()

    app.nodeOutputs = {}
    app.nodePreviewImages = {}

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
      graph: { setDirtyCanvas: vi.fn() }
    })

    mockDataStore.sourceNode = mockNode
    mockDataStore.inputData = {
      baseLayer: { image: {} as HTMLImageElement, url: 'base.png' },
      maskLayer: { image: {} as HTMLImageElement, url: 'mask.png' },
      sourceRef: { filename: 'original.png', subfolder: '', type: 'input' },
      nodeId: 42
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

    // Mock Image constructor so loadImageFromUrl resolves
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

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers node outputs in store after save for node without prior execution outputs', async () => {
    const store = useNodeOutputStore()
    const locatorId = String(mockNode.id)

    // Precondition: node has never been executed, no outputs exist
    expect(app.nodeOutputs[locatorId]).toBeUndefined()

    const { save } = useMaskEditorSaver()
    await save()

    // After mask editor save, the node must have outputs in the store
    // so the image preview displays correctly (not blank).
    // Bug: the old code used updateNodeImages which silently no-ops
    // when there are no pre-existing outputs for the node.
    expect(store.nodeOutputs[locatorId]).toBeDefined()
    expect(store.nodeOutputs[locatorId]?.images?.length).toBeGreaterThan(0)
  })

  it('omits subfolder from the upload FormData under the unified contract', async () => {
    const fetchApiMock = vi.mocked(api.fetchApi)

    const { save } = useMaskEditorSaver()
    await save()

    // The unified contract uploads to /upload/image with only image + type;
    // subfolder is intentionally omitted (the server assigns it). Assert it
    // here so the next reader knows the omission is deliberate, not accidental.
    expect(fetchApiMock).toHaveBeenCalledWith(
      '/upload/image',
      expect.objectContaining({ method: 'POST' })
    )
    const [, init] = fetchApiMock.mock.calls[0]
    const body = init?.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('type')).toBe('input')
    expect(body.get('subfolder')).toBeNull()
  })

  it('uploads masked layers with inverted mask alpha and preserved RGB', async () => {
    // Seed a distinct opaque color per pixel, mask the first half of the
    // canvas, then decode the uploaded blobs and verify both the applied
    // alpha and that the RGB survives where the alpha is 0 (the pixels a
    // canvas-derived blob would serialize as black).
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

    const fetchApiMock = vi.mocked(api.fetchApi)
    const { save } = useMaskEditorSaver()
    await save()

    expect(fetchApiMock).toHaveBeenCalledTimes(4)
    const decodedUploads = []
    for (const [, init] of fetchApiMock.mock.calls) {
      const body = init?.body as FormData
      const file = body.get('image') as Blob
      try {
        decodedUploads.push(decodePng(new Uint8Array(await file.arrayBuffer())))
      } catch {
        // not an encoder-produced PNG (canvas-derived layer)
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
