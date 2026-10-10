import { createTestingPinia } from '@pinia/testing'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useMaskEditorSaver } from './useMaskEditorSaver'

/**
 * Regression coverage for preview-before-upload ordering.
 *
 * src/composables/maskeditor/useMaskEditorSaver.ts:50-52 calls
 * updateNodePreview() BEFORE uploadAllLayers(), so a save whose upload fails
 * still leaves the node showing an edit the server never received.
 */

// ---- Module Mocks ----

const mockDataStore: Record<string, unknown> = {
  sourceNode: null,
  inputData: null,
  outputData: null
}

vi.mock('@/stores/maskEditorDataStore', () => ({
  useMaskEditorDataStore: vi.fn(() => mockDataStore)
}))

function createMockCtx(): CanvasRenderingContext2D {
  return fromPartial<CanvasRenderingContext2D>({
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4 * 4 * 4),
      width: 4,
      height: 4
    })),
    putImageData: vi.fn(),
    globalCompositeOperation: 'source-over'
  })
}

function createMockCanvas(): HTMLCanvasElement {
  return fromPartial<HTMLCanvasElement>({
    width: 4,
    height: 4,
    getContext: vi.fn(() => createMockCtx()),
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

describe('useMaskEditorSaver — save ordering on upload failure', () => {
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

  it('does not update the node preview when the upload fails', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('boom')
    } as Response)

    const { save } = useMaskEditorSaver()

    await expect(save()).rejects.toThrow(/Failed to upload/)

    // The node must not display an edit the server never accepted.
    expect(mockNode.imgs).toBeUndefined()
  })

  it('does not update the node preview when the upload response is unparseable', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('not json'))
    } as unknown as Response)

    const { save } = useMaskEditorSaver()

    await expect(save()).rejects.toThrow(/Invalid upload response/)

    expect(mockNode.imgs).toBeUndefined()
  })

  it('updates the node preview on a successful save (baseline)', async () => {
    const { save } = useMaskEditorSaver()

    await save()

    // updateNodeWithServerReferences clears imgs and routes through the
    // node output store, so a successful save ends with server references.
    expect(mockNode.images).toEqual([
      expect.objectContaining({ filename: 'clipspace-painted-masked-123.png' })
    ])
  })
})
