import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import {
  extractWidgetStringValue,
  useMaskEditorLoader
} from '@/composables/maskeditor/useMaskEditorLoader'

const mockDataStore = vi.hoisted(() => ({
  setLoading: vi.fn(),
  inputData: null as unknown,
  sourceNode: null as unknown
}))

const mockNodeOutputStore = vi.hoisted(() => ({
  getNodeOutputs: vi.fn().mockReturnValue(undefined)
}))

const mockApi = vi.hoisted(() => ({
  apiURL: vi.fn(
    (path: string) => `https://api.example.com${path}`
  ) as unknown as (p: string) => string,
  // Default to a non-OK response so any test that hits the cloud branch
  // without explicit setup falls through cleanly.
  fetchApi: vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({})
  })
}))

const mockApp = vi.hoisted(() => ({
  getPreviewFormatParam: vi.fn(() => ''),
  getRandParam: vi.fn(() => '')
}))

const mockIsCloud = vi.hoisted(() => ({ value: false }))

const mockParseImageWidgetValue = vi.hoisted(() =>
  vi.fn((raw: string) => ({
    filename: raw,
    subfolder: '',
    type: 'input'
  }))
)

vi.mock('@/stores/maskEditorDataStore', () => ({
  useMaskEditorDataStore: () => mockDataStore
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => mockNodeOutputStore
}))

vi.mock('@/scripts/api', () => ({
  api: mockApi
}))

vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('@/utils/imageUtil', () => ({
  parseImageWidgetValue: mockParseImageWidgetValue
}))

let originalImage: typeof Image | undefined

const installImageMock = (loadable: boolean = true) => {
  class MockImage {
    crossOrigin = ''
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    private _src = ''
    get src(): string {
      return this._src
    }
    set src(value: string) {
      this._src = value
      // Fire load/error asynchronously to mirror real Image behavior.
      queueMicrotask(() => {
        if (loadable) this.onload?.()
        else this.onerror?.()
      })
    }
  }
  globalThis.Image = MockImage as unknown as typeof Image
}

// `validateNode` only accepts nodes with non-empty `imgs` or
// `previewMediaType === 'image'`. Default to `previewMediaType: 'image'`
// so callers focused on URL-resolution paths don't have to repeat it.
type ImageRefShape = { filename?: string; type?: string; subfolder?: string }
type WidgetShape = { name: string; value: unknown }
type NodeShape = {
  id?: number
  images?: ImageRefShape[]
  imgs?: { src: string }[]
  imageIndex?: number
  previewMediaType?: string
  widgets?: WidgetShape[]
}

const node = (overrides: NodeShape = {}): LGraphNode =>
  ({
    id: 1,
    images: undefined,
    imgs: undefined,
    imageIndex: 0,
    previewMediaType: 'image',
    widgets: undefined,
    ...overrides
  }) as unknown as LGraphNode

describe('useMaskEditorLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDataStore.inputData = null
    mockDataStore.sourceNode = null
    mockIsCloud.value = false
    mockNodeOutputStore.getNodeOutputs.mockReturnValue(undefined)
    originalImage = globalThis.Image
    installImageMock(true)
  })

  afterEach(() => {
    if (originalImage) {
      globalThis.Image = originalImage
    }
  })

  describe('extractWidgetStringValue', () => {
    it('should return string values as-is', () => {
      expect(extractWidgetStringValue('foo.png')).toBe('foo.png')
    })

    it('should return filename from object values', () => {
      expect(extractWidgetStringValue({ filename: 'bar.png' })).toBe('bar.png')
    })

    it('should return undefined for unsupported shapes', () => {
      expect(extractWidgetStringValue(undefined)).toBeUndefined()
      expect(extractWidgetStringValue(null)).toBeUndefined()
      expect(extractWidgetStringValue(42)).toBeUndefined()
      expect(extractWidgetStringValue({ noFilename: true })).toBeUndefined()
      expect(extractWidgetStringValue({ filename: 7 })).toBeUndefined()
    })
  })

  describe('loadFromNode', () => {
    describe('validation', () => {
      it('should throw and flag the loading error when node is null', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { loadFromNode } = useMaskEditorLoader()

        await expect(
          loadFromNode(null as unknown as LGraphNode)
        ).rejects.toThrow('Node is null or undefined')

        expect(mockDataStore.setLoading).toHaveBeenLastCalledWith(
          false,
          'Node is null or undefined'
        )
        errorSpy.mockRestore()
      })

      it('should throw when node has neither images nor previewMediaType=image', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { loadFromNode } = useMaskEditorLoader()

        await expect(
          loadFromNode(node({ imgs: [], previewMediaType: undefined }))
        ).rejects.toThrow('Node has no images')
        errorSpy.mockRestore()
      })
    })

    describe('image URL resolution', () => {
      it('should build the URL from node.images[0] when available', async () => {
        const { loadFromNode } = useMaskEditorLoader()
        const n = node({
          images: [{ filename: 'a.png', type: 'output', subfolder: 'sub' }]
        })

        await loadFromNode(n)

        expect(mockApi.apiURL).toHaveBeenCalledWith(
          '/view?filename=a.png&type=output&subfolder=sub'
        )
        expect(mockDataStore.inputData).toMatchObject({ nodeId: 1 })
      })

      it('should fall back to nodeOutputStore when node.images is missing', async () => {
        mockNodeOutputStore.getNodeOutputs.mockReturnValueOnce({
          images: [{ filename: 'b.png', type: 'output', subfolder: '' }]
        })
        const { loadFromNode } = useMaskEditorLoader()

        await loadFromNode(node())

        expect(mockApi.apiURL).toHaveBeenCalledWith(
          '/view?filename=b.png&type=output&subfolder='
        )
      })

      it('should throw when nodeOutputStore image is missing filename', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        mockNodeOutputStore.getNodeOutputs.mockReturnValueOnce({
          images: [{ type: 'output', subfolder: '' }]
        })
        const { loadFromNode } = useMaskEditorLoader()

        await expect(loadFromNode(node())).rejects.toThrow(
          'nodeOutputStore image missing filename'
        )
        errorSpy.mockRestore()
      })

      it('should fall back to node.imgs[0].src when other sources are missing', async () => {
        const { loadFromNode } = useMaskEditorLoader()
        const n = node({
          imgs: [
            { src: 'https://api.example.com/view?filename=c.png&type=input' }
          ]
        })

        await loadFromNode(n)

        expect(mockDataStore.inputData).toMatchObject({
          sourceRef: expect.objectContaining({ filename: 'c.png' })
        })
      })

      it('should parse relative URLs from node.imgs[0].src against the page origin', async () => {
        const { loadFromNode } = useMaskEditorLoader()
        const n = node({
          imgs: [{ src: '/view?filename=rel.png&type=input' }]
        })

        await loadFromNode(n)

        expect(mockDataStore.inputData).toMatchObject({
          sourceRef: expect.objectContaining({
            filename: 'rel.png',
            type: 'input'
          })
        })
      })

      it('should throw when the image URL has no filename parameter', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { loadFromNode } = useMaskEditorLoader()
        const n = node({
          imgs: [{ src: 'https://example.com/view?type=input' }]
        })

        await expect(loadFromNode(n)).rejects.toThrow(/Invalid image URL/)
        errorSpy.mockRestore()
      })

      it('should reject data: URLs from node.imgs and throw "Unable to get image URL"', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { loadFromNode } = useMaskEditorLoader()
        const n = node({ imgs: [{ src: 'data:image/png;base64,xyz' }] })

        await expect(loadFromNode(n)).rejects.toThrow(
          'Unable to get image URL from node'
        )
        errorSpy.mockRestore()
      })
    })

    describe('widget filename override', () => {
      it('should prefer widget filename over node image', async () => {
        mockParseImageWidgetValue.mockReturnValueOnce({
          filename: 'widget.png',
          subfolder: 'wsub',
          type: 'temp'
        })
        const { loadFromNode } = useMaskEditorLoader()
        const n = node({
          images: [{ filename: 'node.png', type: 'output', subfolder: '' }],
          widgets: [{ name: 'image', value: 'widget.png' }]
        })

        await loadFromNode(n)

        expect(mockDataStore.inputData).toMatchObject({
          sourceRef: expect.objectContaining({ filename: 'widget.png' })
        })
      })

      it('should ignore $-prefixed widget filename references', async () => {
        const { loadFromNode } = useMaskEditorLoader()
        const n = node({
          images: [{ filename: 'node.png', type: 'output', subfolder: '' }],
          widgets: [{ name: 'image', value: '$35-0' }]
        })

        await loadFromNode(n)

        expect(mockParseImageWidgetValue).not.toHaveBeenCalled()
        expect(mockDataStore.inputData).toMatchObject({
          sourceRef: expect.objectContaining({ filename: 'node.png' })
        })
      })
    })

    describe('clipspace-painted-masked- prefix', () => {
      it('should derive paint/painted/masked layers from a painted-masked filename', async () => {
        const { loadFromNode } = useMaskEditorLoader()
        const n = node({
          images: [
            {
              filename: 'clipspace-painted-masked-1234.png',
              type: 'input',
              subfolder: 'clipspace'
            }
          ]
        })

        await loadFromNode(n)

        expect(mockDataStore.inputData).toMatchObject({
          sourceRef: expect.objectContaining({
            filename: 'clipspace-mask-1234.png'
          })
        })
        const data = mockDataStore.inputData as { paintLayer: unknown }
        expect(data.paintLayer).toBeDefined()
      })
    })

    describe('cloud mask-layers API', () => {
      it('should use mask-layers response when isCloud is true', async () => {
        mockIsCloud.value = true
        mockApi.fetchApi.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            painted_masked: 'cloud-painted-masked.png',
            painted: 'cloud-painted.png',
            paint: 'cloud-paint.png',
            mask: 'cloud-mask.png'
          })
        })
        const { loadFromNode } = useMaskEditorLoader()
        const n = node({
          images: [{ filename: 'src.png', type: 'input', subfolder: '' }]
        })

        await loadFromNode(n)

        expect(mockApi.fetchApi).toHaveBeenCalledWith(
          '/files/mask-layers?filename=src.png'
        )
        expect(mockDataStore.inputData).toMatchObject({
          sourceRef: expect.objectContaining({
            filename: 'cloud-painted-masked.png'
          }),
          paintLayer: expect.anything()
        })
      })

      it('should swallow fetch errors and fall back to pattern matching', async () => {
        mockIsCloud.value = true
        mockApi.fetchApi.mockRejectedValueOnce(new Error('network'))
        const { loadFromNode } = useMaskEditorLoader()
        const n = node({
          images: [{ filename: 'src.png', type: 'input', subfolder: '' }]
        })

        await loadFromNode(n)

        expect(mockDataStore.inputData).toMatchObject({
          sourceRef: expect.objectContaining({ filename: 'src.png' })
        })
      })

      it('should ignore mask-layers response when fetch is not ok', async () => {
        mockIsCloud.value = true
        // Default fetchApi mock is already { ok: false }; no per-test setup needed.
        const { loadFromNode } = useMaskEditorLoader()
        const n = node({
          images: [{ filename: 'src.png', type: 'input', subfolder: '' }]
        })

        await loadFromNode(n)

        expect(mockDataStore.inputData).toMatchObject({
          sourceRef: expect.objectContaining({ filename: 'src.png' })
        })
      })
    })

    describe('image load failure', () => {
      it('should reject and log when an image fails to load', async () => {
        installImageMock(false)
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { loadFromNode } = useMaskEditorLoader()
        const n = node({
          images: [{ filename: 'broken.png', type: 'input', subfolder: '' }]
        })

        await expect(loadFromNode(n)).rejects.toThrow(/Failed to load image/)
        expect(errorSpy).toHaveBeenCalledWith(
          '[MaskEditorLoader]',
          expect.stringMatching(/Failed to load image/),
          expect.any(Error)
        )
        errorSpy.mockRestore()
      })
    })

    describe('side effects on success', () => {
      it('should set sourceNode and toggle loading on / off', async () => {
        const { loadFromNode } = useMaskEditorLoader()
        const n = node({
          images: [{ filename: 'x.png', type: 'input', subfolder: '' }]
        })

        await loadFromNode(n)

        expect(mockDataStore.sourceNode).toBe(n)
        expect(mockDataStore.setLoading).toHaveBeenNthCalledWith(1, true)
        expect(mockDataStore.setLoading).toHaveBeenLastCalledWith(false)
      })
    })
  })
})
