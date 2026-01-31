import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import * as litegraphUtil from '@/utils/litegraphUtil'

vi.mock('@/utils/litegraphUtil', () => ({
  isVideoNode: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: {
    getPreviewFormatParam: vi.fn(() => '&format=test_webp'),
    nodeOutputs: {} as Record<string, unknown>,
    nodePreviewImages: {} as Record<string, string[]>
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

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: vi.fn(() => ({
    executionIdToNodeLocatorId: vi.fn((id: string) => id)
  }))
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    nodeIdToNodeLocatorId: vi.fn((id: string | number) => String(id)),
    nodeToNodeLocatorId: vi.fn((node: { id: number }) => String(node.id))
  }))
}))

describe('imagePreviewStore setNodeOutputsByExecutionId with merge', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('should update reactive nodeOutputs.value when merging outputs', () => {
    const store = useNodeOutputStore()
    const executionId = '1'

    const initialOutput = createMockOutputs([{ filename: 'a.png' }])
    store.setNodeOutputsByExecutionId(executionId, initialOutput)

    expect(app.nodeOutputs[executionId]?.images).toHaveLength(1)
    expect(store.nodeOutputs[executionId]?.images).toHaveLength(1)

    const newOutput = createMockOutputs([{ filename: 'b.png' }])
    store.setNodeOutputsByExecutionId(executionId, newOutput, { merge: true })

    expect(app.nodeOutputs[executionId]?.images).toHaveLength(2)
    expect(store.nodeOutputs[executionId]?.images).toHaveLength(2)
  })

  it('should assign to reactive ref after merge for Vue reactivity', () => {
    const store = useNodeOutputStore()
    const executionId = '1'

    const initialOutput = createMockOutputs([{ filename: 'a.png' }])
    store.setNodeOutputsByExecutionId(executionId, initialOutput)

    const newOutput = createMockOutputs([{ filename: 'b.png' }])

    store.setNodeOutputsByExecutionId(executionId, newOutput, { merge: true })

    expect(store.nodeOutputs[executionId]).toStrictEqual(
      app.nodeOutputs[executionId]
    )
    expect(store.nodeOutputs[executionId]?.images).toHaveLength(2)
  })
})

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
