import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
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

describe('imagePreviewStore restoreOutputs', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('should keep reactivity after restoreOutputs followed by setNodeOutputsByExecutionId', () => {
    const store = useNodeOutputStore()

    // Simulate execution: set outputs for node "4" (e.g., PreviewImage)
    const executionOutput = createMockOutputs([
      { filename: 'ComfyUI_00001.png', subfolder: '', type: 'temp' }
    ])
    const savedOutputs: Record<string, ExecutedWsMessage['output']> = {
      '4': executionOutput
    }

    // Simulate undo: restoreOutputs makes app.nodeOutputs and the ref
    // share the same underlying object if not handled correctly.
    store.restoreOutputs(savedOutputs)

    expect(store.nodeOutputs['4']).toStrictEqual(executionOutput)
    expect(store.nodeOutputs['3']).toBeUndefined()

    // Simulate widget callback setting outputs for node "3" (e.g., LoadImage)
    const widgetOutput = createMockOutputs([
      { filename: 'example.png', subfolder: '', type: 'input' }
    ])
    store.setNodeOutputsByExecutionId('3', widgetOutput)

    // The reactive store must reflect the new output.
    // Before the fix, the raw write to app.nodeOutputs would mutate the
    // proxy's target before the proxy write, causing Vue to skip the
    // reactivity update.
    expect(store.nodeOutputs['3']).toStrictEqual(widgetOutput)
    expect(app.nodeOutputs['3']).toStrictEqual(widgetOutput)
  })
})

describe('imagePreviewStore getPreviewParam', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
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
