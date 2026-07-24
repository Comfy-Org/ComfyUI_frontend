import { createTestingPinia } from '@pinia/testing'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
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

function createMockCtx(
  maskAlpha = 0,
  onPutImageData?: (imageData: ImageData) => void
): CanvasRenderingContext2D {
  const data = new Uint8ClampedArray(4 * 4 * 4)
  for (let i = 3; i < data.length; i += 4) data[i] = maskAlpha

  return fromPartial<CanvasRenderingContext2D>({
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: data.slice(),
      width: 4,
      height: 4
    })),
    putImageData: vi.fn((imageData: ImageData) => onPutImageData?.(imageData)),
    globalCompositeOperation: 'source-over'
  })
}

function createMockCanvas(
  maskAlpha = 0,
  onPutImageData?: (imageData: ImageData) => void
): HTMLCanvasElement {
  const context = createMockCtx(maskAlpha, onPutImageData)

  return fromPartial<HTMLCanvasElement>({
    width: 4,
    height: 4,
    getContext: vi.fn(() => context),
    toBlob: vi.fn((cb: BlobCallback) => {
      cb(new Blob(['x'], { type: 'image/png' }))
    }),
    toDataURL: vi.fn(() => 'data:image/png;base64,mock')
  })
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
  let outputImageData: ImageData[]
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
    outputImageData = []

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
          return fromAny<HTMLCanvasElement, unknown>(
            createMockCanvas(0, (imageData) => outputImageData.push(imageData))
          )
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

  it('preserves RGB beneath transparent mask pixels during upload', async () => {
    const fetchApiMock = vi.mocked(api.fetchApi)
    const uploadedFilenames = new WeakMap<FormData, string>()
    const append = FormData.prototype.append
    vi.spyOn(FormData.prototype, 'append').mockImplementation(function (
      this: FormData,
      name: string,
      value: string | Blob,
      filename?: string
    ) {
      if (name === 'image' && filename) {
        uploadedFilenames.set(this, filename)
      }
      if (typeof value === 'string') {
        return (append as (name: string, value: string) => void).call(
          this,
          name,
          value
        )
      }
      return (
        append as (name: string, value: Blob, filename?: string) => void
      ).call(this, name, value, filename)
    })
    fetchApiMock.mockImplementation(async (_route, init) => {
      const body = init?.body as FormData
      const filename = uploadedFilenames.get(body)
      if (!filename) throw new Error('Missing uploaded image')

      return {
        ok: true,
        json: () =>
          Promise.resolve({
            name: filename,
            subfolder: '',
            type: 'input'
          })
      } as Response
    })

    const { save } = useMaskEditorSaver()
    await save()

    const requests = fetchApiMock.mock.calls.map(([route, init], index) => ({
      route,
      body: init?.body as FormData,
      index
    }))
    function uploadedFilename(body: FormData) {
      return uploadedFilenames.get(body) ?? ''
    }
    const paintedImageRequest = requests.find(
      ({ route, body }) =>
        route === '/upload/image' &&
        uploadedFilename(body).startsWith('clipspace-painted-')
    )
    if (!paintedImageRequest) throw new Error('Missing painted image upload')

    const maskRequests = requests.filter(
      ({ route }) => route === '/upload/mask'
    )
    expect(maskRequests).toHaveLength(2)
    const originalRefs = maskRequests.map(({ body }) =>
      JSON.parse(String(body.get('original_ref')))
    )
    expect(originalRefs).toEqual(
      expect.arrayContaining([
        {
          filename: 'original.png',
          subfolder: '',
          type: 'input'
        },
        {
          filename: uploadedFilename(paintedImageRequest.body),
          subfolder: '',
          type: 'input'
        }
      ])
    )

    const paintedMaskedRequest = maskRequests.find(({ body }) => {
      const originalRef = JSON.parse(String(body.get('original_ref')))
      return originalRef.filename === uploadedFilename(paintedImageRequest.body)
    })
    expect(paintedMaskedRequest?.index).toBeGreaterThan(
      paintedImageRequest.index
    )
  })

  it('exports full internal mask coverage as zero PNG alpha', async () => {
    mockEditorStore.maskCanvas = createMockCanvas(255)

    const { save } = useMaskEditorSaver()
    await save()

    expect(outputImageData[0]?.data[3]).toBe(0)
  })
})
