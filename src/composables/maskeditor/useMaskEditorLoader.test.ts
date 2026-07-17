import { fromAny } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useMaskEditorLoader } from './useMaskEditorLoader'

const mockDataStore: Record<string, unknown> = {
  inputData: null,
  sourceNode: null,
  setLoading: vi.fn()
}

vi.mock('@/stores/maskEditorDataStore', () => ({
  useMaskEditorDataStore: vi.fn(() => mockDataStore)
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: vi.fn(() => ({
    getNodeOutputs: vi.fn(() => undefined)
  }))
}))

vi.mock('@/platform/distribution/types', () => ({ isCloud: false }))

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    apiURL: vi.fn((route: string) => `http://localhost:8188/api${route}`)
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    getPreviewFormatParam: vi.fn(() => ''),
    getRandParam: vi.fn(() => '')
  }
}))

const requestedUrls: string[] = []
let failUrlPattern: RegExp | null = null

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
    requestedUrls.push(value)
    queueMicrotask(() => {
      if (failUrlPattern?.test(value)) this.onerror?.(new Event('error'))
      else this.onload?.(new Event('load'))
    })
  }
}

function createLoadImageNode(widgetValue: string): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id: 7,
    type: 'LoadImage',
    imgs: [{ src: 'http://localhost:8188/api/view?filename=whatever.png' }],
    images: undefined,
    widgets: [{ name: 'image', value: widgetValue }]
  })
}

function subfolderOf(url: string): string | null {
  return new URL(url).searchParams.get('subfolder')
}

describe('useMaskEditorLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requestedUrls.length = 0
    failUrlPattern = null
    mockDataStore.inputData = null
    mockDataStore.sourceNode = null
    vi.stubGlobal('Image', MockImage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads layer files from the input root for saves without a subfolder prefix', async () => {
    const node = createLoadImageNode('clipspace-painted-masked-123.png [input]')

    await useMaskEditorLoader().loadFromNode(node)

    const layerUrls = requestedUrls.filter((url) =>
      url.includes('clipspace-mask-123.png')
    )
    expect(layerUrls.length).toBeGreaterThan(0)
    for (const url of layerUrls) {
      expect(subfolderOf(url)).toBeNull()
    }
    expect(mockDataStore.inputData).toMatchObject({
      sourceRef: { filename: 'clipspace-mask-123.png', type: 'input' },
      nodeId: 7
    })
  })

  it('loads layer files from the clipspace subfolder for legacy saves', async () => {
    const node = createLoadImageNode(
      'clipspace/clipspace-painted-masked-123.png [input]'
    )

    await useMaskEditorLoader().loadFromNode(node)

    const layerUrls = requestedUrls.filter((url) =>
      url.includes('clipspace-mask-123.png')
    )
    expect(layerUrls.length).toBeGreaterThan(0)
    for (const url of layerUrls) {
      expect(subfolderOf(url)).toBe('clipspace')
    }
  })

  it('falls back to the node image when layer files are missing', async () => {
    failUrlPattern = /clipspace-(mask|paint)-123\.png/
    const node = createLoadImageNode('clipspace-painted-masked-123.png [input]')

    await useMaskEditorLoader().loadFromNode(node)

    expect(mockDataStore.inputData).toMatchObject({
      sourceRef: { filename: 'clipspace-painted-masked-123.png' },
      paintLayer: undefined,
      nodeId: 7
    })
  })

  it('still fails when the node image itself cannot be loaded', async () => {
    failUrlPattern = /./
    const node = createLoadImageNode('some-regular-image.png [input]')

    await expect(useMaskEditorLoader().loadFromNode(node)).rejects.toThrow()
    expect(mockDataStore.setLoading).toHaveBeenLastCalledWith(
      false,
      expect.any(String)
    )
  })
})
