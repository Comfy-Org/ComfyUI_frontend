import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  extractWidgetStringValue,
  useMaskEditorLoader
} from '@/composables/maskeditor/useMaskEditorLoader'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'

interface MockInputData {
  baseLayer: { url: string }
  maskLayer: { url: string }
  paintLayer?: { url: string }
  sourceRef: { filename: string; subfolder?: string; type?: string }
  nodeId: unknown
}

const mockDataStore = vi.hoisted(() => ({
  inputData: undefined as unknown,
  sourceNode: undefined as unknown,
  setLoading: vi.fn()
}))

const mockNodeOutputStore = vi.hoisted(() => ({
  getNodeOutputs: vi.fn()
}))

const mockCloudState = vi.hoisted(() => ({
  isCloud: false
}))

vi.mock('@/stores/maskEditorDataStore', () => ({
  useMaskEditorDataStore: () => mockDataStore
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => mockNodeOutputStore
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockCloudState.isCloud
  }
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn((path: string) => `http://comfy.test${path}`),
    fetchApi: vi.fn()
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    getPreviewFormatParam: vi.fn(() => '&preview=png'),
    getRandParam: vi.fn(() => '&rand=1')
  }
}))

function createMockImageClass(handler: 'onload' | 'onerror') {
  return class {
    crossOrigin = ''
    onerror: (() => void) | null = null
    onload: (() => void) | null = null
    private imageSrc = ''

    get src() {
      return this.imageSrc
    }

    set src(value: string) {
      this.imageSrc = value
      queueMicrotask(() => this[handler]?.())
    }
  }
}

const MockImage = createMockImageClass('onload')

function makeNode(overrides: object = {}): LGraphNode {
  const imgObj: unknown = {
    src: 'http://images.test/render.png?filename=render.png'
  }
  const node: unknown = {
    id: 42,
    imgs: [imgObj as HTMLImageElement],
    imageIndex: 0,
    ...overrides
  }
  return node as LGraphNode
}

function getInputData(): MockInputData {
  return mockDataStore.inputData as MockInputData
}

describe('extractWidgetStringValue', () => {
  it('extracts strings and filename objects', () => {
    expect(extractWidgetStringValue('image.png')).toBe('image.png')
    expect(extractWidgetStringValue({ filename: 'object.png' })).toBe(
      'object.png'
    )
    expect(extractWidgetStringValue({ filename: 123 })).toBeUndefined()
    expect(extractWidgetStringValue(null)).toBeUndefined()
  })
})

describe('useMaskEditorLoader', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', MockImage)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(api.apiURL).mockClear()
    vi.mocked(api.fetchApi).mockReset()
    mockDataStore.inputData = undefined
    mockDataStore.sourceNode = undefined
    mockDataStore.setLoading.mockClear()
    mockNodeOutputStore.getNodeOutputs.mockReset()
    mockCloudState.isCloud = false
  })

  it('loads base and mask layers from a node image reference', async () => {
    const node = makeNode({
      images: [
        {
          filename: 'node-output.png',
          subfolder: 'outputs',
          type: 'output'
        }
      ]
    })

    await useMaskEditorLoader().loadFromNode(node)

    expect(mockDataStore.setLoading).toHaveBeenNthCalledWith(1, true)
    expect(mockDataStore.setLoading).toHaveBeenLastCalledWith(false)
    expect(mockDataStore.sourceNode).toBe(node)
    expect(mockDataStore.inputData).toMatchObject({
      nodeId: 42,
      sourceRef: {
        filename: 'node-output.png',
        subfolder: 'outputs',
        type: 'output'
      },
      paintLayer: undefined
    })
    expect(getInputData().baseLayer.url).toContain('channel=rgb')
    expect(getInputData().maskLayer.url).toContain('channel=a')
  })

  it('uses a concrete image widget value instead of a stale node image', async () => {
    await useMaskEditorLoader().loadFromNode(
      makeNode({
        images: [{ filename: 'stale.png', type: 'output', subfolder: '' }],
        widgets: [
          {
            name: 'image',
            value: 'clipspace/current.png [input]'
          }
        ]
      })
    )

    expect(getInputData().sourceRef).toMatchObject({
      filename: 'current.png',
      subfolder: 'clipspace',
      type: 'input'
    })
    expect(getInputData().baseLayer.url).toContain('filename=current.png')
  })

  it('keeps internal widget references from replacing the node image', async () => {
    await useMaskEditorLoader().loadFromNode(
      makeNode({
        images: [{ filename: 'real-output.png', type: 'output' }],
        widgets: [{ name: 'image', value: '$35-0' }]
      })
    )

    expect(getInputData().sourceRef.filename).toBe('real-output.png')
  })

  it('loads image references from node output store data', async () => {
    mockNodeOutputStore.getNodeOutputs.mockReturnValue({
      images: [
        {
          filename: 'store-output.png',
          subfolder: 'store',
          type: 'temp'
        }
      ]
    })

    await useMaskEditorLoader().loadFromNode(
      makeNode({
        images: undefined,
        imgs: [{ src: 'data:image/png;base64,abc' }]
      })
    )

    expect(getInputData().sourceRef).toMatchObject({
      filename: 'store-output.png',
      subfolder: 'store',
      type: 'temp'
    })
  })

  it('uses the current non-data preview image when no image reference exists', async () => {
    await useMaskEditorLoader().loadFromNode(
      makeNode({
        images: undefined,
        imageIndex: 1,
        imgs: [
          { src: 'http://images.test/first.png?filename=first.png' },
          { src: '/view?filename=second.png&type=input' }
        ]
      })
    )

    expect(getInputData().sourceRef).toMatchObject({
      filename: 'second.png',
      type: 'input'
    })
  })

  it('uses cloud mask layer metadata when available', async () => {
    mockCloudState.isCloud = true
    vi.mocked(api.fetchApi).mockResolvedValue(
      fromPartial<Response>({
        ok: true,
        json: vi.fn().mockResolvedValue({
          painted_masked: 'painted-masked.png',
          painted: 'painted.png',
          paint: 'paint.png'
        })
      })
    )

    await useMaskEditorLoader().loadFromNode(
      makeNode({
        images: [{ filename: 'cloud.png', type: 'output' }]
      })
    )

    expect(api.fetchApi).toHaveBeenCalledWith(
      '/files/mask-layers?filename=cloud.png'
    )
    expect(getInputData().sourceRef.filename).toBe('painted-masked.png')
    expect(getInputData().paintLayer?.url).toContain('filename=paint.png')
  })

  it('loads clipspace layer filenames from painted-masked images', async () => {
    await useMaskEditorLoader().loadFromNode(
      makeNode({
        images: [
          {
            filename: 'clipspace-painted-masked-123.png',
            subfolder: 'clipspace',
            type: 'input'
          }
        ]
      })
    )

    expect(getInputData().sourceRef).toMatchObject({
      filename: 'clipspace-mask-123.png',
      subfolder: 'clipspace',
      type: 'input'
    })
    expect(getInputData().paintLayer?.url).toContain(
      'filename=clipspace-paint-123.png'
    )
  })

  it('uses painted cloud metadata when painted-masked metadata is absent', async () => {
    mockCloudState.isCloud = true
    vi.mocked(api.fetchApi).mockResolvedValue(
      fromPartial<Response>({
        ok: true,
        json: vi.fn().mockResolvedValue({ painted: 'painted-only.png' })
      })
    )

    await useMaskEditorLoader().loadFromNode(
      makeNode({
        images: [{ filename: 'cloud.png', type: 'output' }]
      })
    )

    expect(getInputData().sourceRef.filename).toBe('painted-only.png')
    expect(getInputData().paintLayer).toBeUndefined()
  })

  it('keeps the node image when cloud mask metadata is unavailable', async () => {
    mockCloudState.isCloud = true
    vi.mocked(api.fetchApi).mockResolvedValue({
      ok: false
    } as Response)

    await useMaskEditorLoader().loadFromNode(
      makeNode({
        images: [{ filename: 'cloud.png', type: 'output' }]
      })
    )

    expect(getInputData().sourceRef.filename).toBe('cloud.png')
    expect(getInputData().paintLayer).toBeUndefined()
  })

  it('keeps the node image when cloud mask metadata lookup rejects', async () => {
    mockCloudState.isCloud = true
    vi.mocked(api.fetchApi).mockRejectedValue(new Error('offline'))

    await useMaskEditorLoader().loadFromNode(
      makeNode({
        images: [{ filename: 'cloud.png', type: 'output' }]
      })
    )

    expect(getInputData().sourceRef.filename).toBe('cloud.png')
  })

  it('loads widget filenames without explicit folder metadata as inputs', async () => {
    await useMaskEditorLoader().loadFromNode(
      makeNode({
        images: [{ filename: 'stale.png', type: 'output' }],
        widgets: [
          {
            name: 'image',
            value: 'plain.png'
          }
        ]
      })
    )

    expect(getInputData().sourceRef).toMatchObject({
      filename: 'plain.png',
      type: 'input'
    })
    expect(getInputData().sourceRef.subfolder).toBeUndefined()
  })

  it('surfaces validation failures and clears loading state', async () => {
    await expect(
      useMaskEditorLoader().loadFromNode(makeNode({ imgs: [], images: [] }))
    ).rejects.toThrow('Node has no images')

    expect(mockDataStore.setLoading).toHaveBeenNthCalledWith(1, true)
    expect(mockDataStore.setLoading).toHaveBeenLastCalledWith(
      false,
      'Node has no images'
    )
  })

  it('surfaces null node validation failures', async () => {
    const nullNode: unknown = null
    await expect(
      useMaskEditorLoader().loadFromNode(nullNode as LGraphNode)
    ).rejects.toThrow('Node is null or undefined')
  })

  it('surfaces missing output filenames', async () => {
    mockNodeOutputStore.getNodeOutputs.mockReturnValue({
      images: [
        {
          filename: '',
          type: 'output'
        }
      ]
    })

    await expect(
      useMaskEditorLoader().loadFromNode(
        makeNode({
          images: undefined,
          imgs: [{ src: 'data:image/png;base64,abc' }]
        })
      )
    ).rejects.toThrow('nodeOutputStore image missing filename')
  })

  it('rejects data previews without output metadata', async () => {
    await expect(
      useMaskEditorLoader().loadFromNode(
        makeNode({
          images: undefined,
          imgs: [{ src: 'data:image/png;base64,abc' }]
        })
      )
    ).rejects.toThrow('Unable to get image URL from node')
  })

  it('rejects preview URLs without filename metadata', async () => {
    await expect(
      useMaskEditorLoader().loadFromNode(
        makeNode({
          images: undefined,
          imgs: [{ src: '/view?type=input' }]
        })
      )
    ).rejects.toThrow('Invalid image URL: /view?type=input')
  })

  it('propagates image load failures', async () => {
    vi.stubGlobal('Image', createMockImageClass('onerror'))

    await expect(
      useMaskEditorLoader().loadFromNode(
        makeNode({
          images: [{ filename: 'broken.png', type: 'output' }]
        })
      )
    ).rejects.toThrow('Failed to load image:')
  })
})
