import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import * as litegraphUtil from '@/utils/litegraphUtil'

vi.mock('@/utils/litegraphUtil', () => ({
  isVideoNode: vi.fn()
}))

const mockGetNodeById = vi.fn()

vi.mock('@/scripts/app', () => ({
  app: {
    getPreviewFormatParam: vi.fn(() => '&format=test_webp'),
    rootGraph: {
      getNodeById: (...args: unknown[]) => mockGetNodeById(...args)
    }
  }
}))

const createMockNode = (overrides: Record<string, unknown> = {}): LGraphNode =>
  ({
    id: 1,
    type: 'TestNode',
    ...overrides
  }) as LGraphNode

const createMockOutputs = (
  images?: ExecutedWsMessage['output']['images']
): ExecutedWsMessage['output'] => ({ images })

describe('imagePreviewStore getPreviewParam', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(litegraphUtil.isVideoNode).mockReturnValue(false)
  })

  it('should return empty string if node.animatedImages is true', () => {
    const store = useNodeOutputStore()
    const node = createMockNode({ animatedImages: true })
    const outputs = createMockOutputs([{ filename: 'img.png' }])
    expect(store.getPreviewParam(node, outputs)).toBe('')
    expect(vi.mocked(app).getPreviewFormatParam).not.toHaveBeenCalled()
  })

  it('should return empty string if isVideoNode returns true', () => {
    const store = useNodeOutputStore()
    vi.mocked(litegraphUtil.isVideoNode).mockReturnValue(true)
    const node = createMockNode()
    const outputs = createMockOutputs([{ filename: 'img.png' }])
    expect(store.getPreviewParam(node, outputs)).toBe('')
    expect(vi.mocked(app).getPreviewFormatParam).not.toHaveBeenCalled()
  })

  it('should return empty string if outputs.images is undefined', () => {
    const store = useNodeOutputStore()
    const node = createMockNode()
    const outputs: ExecutedWsMessage['output'] = {}
    expect(store.getPreviewParam(node, outputs)).toBe('')
    expect(vi.mocked(app).getPreviewFormatParam).not.toHaveBeenCalled()
  })

  it('should return empty string if outputs.images is empty', () => {
    const store = useNodeOutputStore()
    const node = createMockNode()
    const outputs = createMockOutputs([])
    expect(store.getPreviewParam(node, outputs)).toBe('')
    expect(vi.mocked(app).getPreviewFormatParam).not.toHaveBeenCalled()
  })

  it('should return empty string if outputs.images contains SVG images', () => {
    const store = useNodeOutputStore()
    const node = createMockNode()
    const outputs = createMockOutputs([{ filename: 'img.svg' }])
    expect(store.getPreviewParam(node, outputs)).toBe('')
    expect(vi.mocked(app).getPreviewFormatParam).not.toHaveBeenCalled()
  })

  it('should return format param for standard image outputs', () => {
    const store = useNodeOutputStore()
    const node = createMockNode()
    const outputs = createMockOutputs([{ filename: 'img.png' }])
    expect(store.getPreviewParam(node, outputs)).toBe('&format=test_webp')
    expect(vi.mocked(app).getPreviewFormatParam).toHaveBeenCalledTimes(1)
  })

  it('should return format param for multiple standard images', () => {
    const store = useNodeOutputStore()
    const node = createMockNode()
    const outputs = createMockOutputs([
      { filename: 'img1.png' },
      { filename: 'img2.jpg' }
    ])
    expect(store.getPreviewParam(node, outputs)).toBe('&format=test_webp')
    expect(vi.mocked(app).getPreviewFormatParam).toHaveBeenCalledTimes(1)
  })
})

describe('imagePreviewStore syncLegacyNodeImgs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    LiteGraph.vueNodesMode = false
  })

  it('should not sync when vueNodesMode is disabled', () => {
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 1 })
    const mockImg = document.createElement('img')

    mockGetNodeById.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs(1, mockImg, 0)

    expect(mockNode.imgs).toBeUndefined()
    expect(mockNode.imageIndex).toBeUndefined()
  })

  it('should sync node.imgs when vueNodesMode is enabled', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 1 })
    const mockImg = document.createElement('img')

    mockGetNodeById.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs(1, mockImg, 0)

    expect(mockNode.imgs).toEqual([mockImg])
    expect(mockNode.imageIndex).toBe(0)
  })

  it('should sync with correct activeIndex', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 42 })
    const mockImg = document.createElement('img')

    mockGetNodeById.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs(42, mockImg, 3)

    expect(mockNode.imgs).toEqual([mockImg])
    expect(mockNode.imageIndex).toBe(3)
  })

  it('should handle string nodeId', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 123 })
    const mockImg = document.createElement('img')

    mockGetNodeById.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs('123', mockImg, 0)

    expect(mockGetNodeById).toHaveBeenCalledWith(123)
    expect(mockNode.imgs).toEqual([mockImg])
  })

  it('should not throw when node is not found', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockImg = document.createElement('img')

    mockGetNodeById.mockReturnValue(undefined)

    expect(() => store.syncLegacyNodeImgs(999, mockImg, 0)).not.toThrow()
  })

  it('should default activeIndex to 0', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 1 })
    const mockImg = document.createElement('img')

    mockGetNodeById.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs(1, mockImg)

    expect(mockNode.imageIndex).toBe(0)
  })
})
