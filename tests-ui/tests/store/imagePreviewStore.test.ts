import { LGraphNode } from '@comfyorg/litegraph'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExecutedWsMessage } from '@/schemas/apiSchema'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import * as litegraphUtil from '@/utils/litegraphUtil'

vi.mock('@/utils/litegraphUtil', () => ({
  isVideoNode: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: {
    getPreviewFormatParam: vi.fn(() => '&format=test_webp')
  }
}))

const createMockNode = (overrides: Partial<LGraphNode> = {}): LGraphNode =>
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
    // @ts-expect-error `animatedImages` property is not typed
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
