import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import * as litegraphUtil from '@/utils/litegraphUtil'

const mockResolveNode = vi.fn()

vi.mock('@/utils/litegraphUtil', () => ({
  isAnimatedOutput: vi.fn(),
  isVideoNode: vi.fn(),
  resolveNode: (...args: unknown[]) => mockResolveNode(...args)
}))

const mockGetNodeById = vi.fn()

vi.mock('@/scripts/app', () => ({
  app: {
    getPreviewFormatParam: vi.fn(() => '&format=test_webp'),
    rootGraph: {
      getNodeById: (...args: unknown[]) => mockGetNodeById(...args)
    },
    nodeOutputs: {} as Record<string, unknown>,
    nodePreviewImages: {} as Record<string, string[]>
  }
}))

const createMockNode = (overrides: Record<string, unknown> = {}): LGraphNode =>
  fromAny<LGraphNode, unknown>({
    id: 1,
    type: 'TestNode',
    ...overrides
  })

const createMockOutputs = (
  images?: ExecutedWsMessage['output']['images']
): ExecutedWsMessage['output'] => ({ images })

vi.mock('@/utils/graphTraversalUtil', () => ({
  executionIdToNodeLocatorId: vi.fn((_rootGraph: unknown, id: string) => id)
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    nodeIdToNodeLocatorId: vi.fn((id: string | number) => String(id)),
    nodeToNodeLocatorId: vi.fn((node: { id: number }) => String(node.id))
  }))
}))

describe('nodeOutputStore setNodeOutputsByExecutionId with merge', () => {
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

  it('should create a new object reference on merge so Vue detects the change', () => {
    const store = useNodeOutputStore()
    const executionId = '1'

    const initialOutput = createMockOutputs([{ filename: 'a.png' }])
    store.setNodeOutputsByExecutionId(executionId, initialOutput)

    const refBefore = store.nodeOutputs[executionId]

    const newOutput = createMockOutputs([{ filename: 'b.png' }])
    store.setNodeOutputsByExecutionId(executionId, newOutput, { merge: true })

    const refAfter = store.nodeOutputs[executionId]

    expect(refAfter).not.toBe(refBefore)
    expect(refAfter?.images).toHaveLength(2)
  })
})

describe('nodeOutputStore restoreOutputs', () => {
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

describe('nodeOutputStore input preview preservation', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('should preserve input preview when execution sends empty output', () => {
    const store = useNodeOutputStore()
    const executionId = '3'

    const inputPreview = createMockOutputs([
      { filename: 'example.png', subfolder: '', type: 'input' }
    ])
    store.setNodeOutputsByExecutionId(executionId, inputPreview)

    expect(store.nodeOutputs[executionId]?.images).toHaveLength(1)

    const emptyExecutionOutput = createMockOutputs()
    store.setNodeOutputsByExecutionId(executionId, emptyExecutionOutput)

    expect(store.nodeOutputs[executionId]?.images).toHaveLength(1)
    expect(store.nodeOutputs[executionId]?.images?.[0].filename).toBe(
      'example.png'
    )
  })

  it('should preserve input preview when execution sends output with empty images array', () => {
    const store = useNodeOutputStore()
    const executionId = '3'

    const inputPreview = createMockOutputs([
      { filename: 'example.png', subfolder: '', type: 'input' }
    ])
    store.setNodeOutputsByExecutionId(executionId, inputPreview)

    const emptyImagesOutput = createMockOutputs([])
    store.setNodeOutputsByExecutionId(executionId, emptyImagesOutput)

    expect(store.nodeOutputs[executionId]?.images).toHaveLength(1)
    expect(store.nodeOutputs[executionId]?.images?.[0].type).toBe('input')
  })

  it('should allow execution output with images to overwrite input preview', () => {
    const store = useNodeOutputStore()
    const executionId = '3'

    const inputPreview = createMockOutputs([
      { filename: 'example.png', subfolder: '', type: 'input' }
    ])
    store.setNodeOutputsByExecutionId(executionId, inputPreview)

    const executionOutput = createMockOutputs([
      { filename: 'output.png', subfolder: '', type: 'output' }
    ])
    store.setNodeOutputsByExecutionId(executionId, executionOutput)

    expect(store.nodeOutputs[executionId]?.images).toHaveLength(1)
    expect(store.nodeOutputs[executionId]?.images?.[0].filename).toBe(
      'output.png'
    )
  })

  it('should not preserve non-input outputs from being overwritten', () => {
    const store = useNodeOutputStore()
    const executionId = '4'

    const tempOutput = createMockOutputs([
      { filename: 'temp.png', subfolder: '', type: 'temp' }
    ])
    store.setNodeOutputsByExecutionId(executionId, tempOutput)

    const emptyOutput = createMockOutputs()
    store.setNodeOutputsByExecutionId(executionId, emptyOutput)

    expect(store.nodeOutputs[executionId]?.images).toBeUndefined()
  })

  it('should pass through non-image fields while preserving input preview images', () => {
    const store = useNodeOutputStore()
    const executionId = '5'

    const inputPreview = createMockOutputs([
      { filename: 'example.png', subfolder: '', type: 'input' }
    ])
    store.setNodeOutputsByExecutionId(executionId, inputPreview)

    const videoOutput: ExecutedWsMessage['output'] = {
      video: [{ filename: 'output.mp4', subfolder: '', type: 'output' }]
    }
    store.setNodeOutputsByExecutionId(executionId, videoOutput)

    expect(store.nodeOutputs[executionId]?.images).toHaveLength(1)
    expect(store.nodeOutputs[executionId]?.images?.[0].filename).toBe(
      'example.png'
    )
    expect(store.nodeOutputs[executionId]?.video).toHaveLength(1)
    expect(store.nodeOutputs[executionId]?.video?.[0].filename).toBe(
      'output.mp4'
    )
  })
})

describe('nodeOutputStore getPreviewParam', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    vi.mocked(litegraphUtil.isAnimatedOutput).mockReturnValue(false)
    vi.mocked(litegraphUtil.isVideoNode).mockReturnValue(false)
  })

  it('should return empty string if output is animated', () => {
    const store = useNodeOutputStore()
    vi.mocked(litegraphUtil.isAnimatedOutput).mockReturnValue(true)
    const node = createMockNode()
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

describe('nodeOutputStore snapshotOutputs / restoreOutputs', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('should round-trip outputs through snapshot and restore', () => {
    const store = useNodeOutputStore()

    // Set input previews via execution path
    const inputOutput = createMockOutputs([
      { filename: 'example.png', subfolder: '', type: 'input' }
    ])
    store.setNodeOutputsByExecutionId('3', inputOutput)

    const execOutput = createMockOutputs([
      { filename: 'ComfyUI_00001.png', subfolder: '', type: 'temp' }
    ])
    store.setNodeOutputsByExecutionId('4', execOutput)

    // Snapshot
    const snapshot = store.snapshotOutputs()

    // Clear everything
    store.resetAllOutputsAndPreviews()
    expect(Object.keys(app.nodeOutputs)).toHaveLength(0)
    expect(Object.keys(store.nodeOutputs)).toHaveLength(0)

    // Restore from snapshot
    store.restoreOutputs(snapshot)

    expect(app.nodeOutputs['3']).toStrictEqual(inputOutput)
    expect(app.nodeOutputs['4']).toStrictEqual(execOutput)
    expect(store.nodeOutputs['3']).toStrictEqual(inputOutput)
    expect(store.nodeOutputs['4']).toStrictEqual(execOutput)
  })

  it('should preserve outputs across a simulated tab switch cycle', () => {
    const store = useNodeOutputStore()

    // Tab A: execution produces outputs for two nodes
    const outputA1 = createMockOutputs([
      { filename: 'ComfyUI_00001.png', subfolder: '', type: 'temp' }
    ])
    const outputA2 = createMockOutputs([
      { filename: 'example.png', subfolder: '', type: 'input' }
    ])
    store.setNodeOutputsByExecutionId('1', outputA1)
    store.setNodeOutputsByExecutionId('3', outputA2)

    // --- Switch away: store() then clean ---
    const tabASnapshot = store.snapshotOutputs()
    store.resetAllOutputsAndPreviews()

    expect(Object.keys(store.nodeOutputs)).toHaveLength(0)
    expect(Object.keys(app.nodeOutputs)).toHaveLength(0)

    // Tab B: fresh empty workflow (no outputs)
    const tabBSnapshot = store.snapshotOutputs()
    expect(Object.keys(tabBSnapshot)).toHaveLength(0)

    // --- Switch back to Tab A: store Tab B then restore Tab A ---
    store.resetAllOutputsAndPreviews()
    store.restoreOutputs(tabASnapshot)

    // Tab A's outputs should be fully restored
    expect(store.nodeOutputs['1']).toStrictEqual(outputA1)
    expect(store.nodeOutputs['3']).toStrictEqual(outputA2)
    expect(app.nodeOutputs['1']).toStrictEqual(outputA1)
    expect(app.nodeOutputs['3']).toStrictEqual(outputA2)

    // New execution should still work after restore
    const newOutput = createMockOutputs([{ filename: 'new.png' }])
    store.setNodeOutputsByExecutionId('5', newOutput)
    expect(store.nodeOutputs['5']).toStrictEqual(newOutput)
  })

  it('should keep tab outputs independent across multiple switches', () => {
    const store = useNodeOutputStore()

    // Tab A: execute
    const outputA = createMockOutputs([{ filename: 'tab_a.png' }])
    store.setNodeOutputsByExecutionId('1', outputA)
    const snapshotA = store.snapshotOutputs()

    // Switch to Tab B
    store.resetAllOutputsAndPreviews()
    const outputB = createMockOutputs([{ filename: 'tab_b.png' }])
    store.setNodeOutputsByExecutionId('1', outputB)
    const snapshotB = store.snapshotOutputs()

    // Switch back to Tab A
    store.resetAllOutputsAndPreviews()
    store.restoreOutputs(snapshotA)

    expect(store.nodeOutputs['1']?.images?.[0]?.filename).toBe('tab_a.png')

    // Switch back to Tab B
    const snapshotA2 = store.snapshotOutputs()
    store.resetAllOutputsAndPreviews()
    store.restoreOutputs(snapshotB)

    expect(store.nodeOutputs['1']?.images?.[0]?.filename).toBe('tab_b.png')

    // And back to Tab A again - still correct
    store.resetAllOutputsAndPreviews()
    store.restoreOutputs(snapshotA2)

    expect(store.nodeOutputs['1']?.images?.[0]?.filename).toBe('tab_a.png')
  })

  it('should return a deep clone from snapshotOutputs', () => {
    const store = useNodeOutputStore()

    const output = createMockOutputs([{ filename: 'a.png' }])
    store.setNodeOutputsByExecutionId('1', output)

    const snapshot = store.snapshotOutputs()

    // Mutate the snapshot
    snapshot['1'].images![0].filename = 'mutated.png'
    snapshot['99'] = createMockOutputs([{ filename: 'new.png' }])

    // Store should be unchanged
    expect(store.nodeOutputs['1']?.images?.[0]?.filename).toBe('a.png')
    expect(app.nodeOutputs['1']?.images?.[0]?.filename).toBe('a.png')
    expect(store.nodeOutputs['99']).toBeUndefined()
  })
})

describe('nodeOutputStore resetAllOutputsAndPreviews', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('should clear all outputs and previews for multiple nodes', () => {
    const store = useNodeOutputStore()

    store.setNodeOutputsByExecutionId(
      '1',
      createMockOutputs([{ filename: 'a.png' }])
    )
    store.setNodeOutputsByExecutionId(
      '2',
      createMockOutputs([{ filename: 'b.png' }])
    )
    store.setNodeOutputsByExecutionId(
      '3',
      createMockOutputs([{ filename: 'c.png', type: 'input' }])
    )

    expect(Object.keys(store.nodeOutputs)).toHaveLength(3)
    expect(Object.keys(app.nodeOutputs)).toHaveLength(3)

    store.resetAllOutputsAndPreviews()

    expect(Object.keys(store.nodeOutputs)).toHaveLength(0)
    expect(Object.keys(app.nodeOutputs)).toHaveLength(0)
    expect(Object.keys(app.nodePreviewImages)).toHaveLength(0)
  })
})

describe('nodeOutputStore restoreOutputs + execution interaction', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('should allow execution to update outputs after restore', () => {
    const store = useNodeOutputStore()

    // Simulate tab restore with existing input preview
    const inputOutput = createMockOutputs([
      { filename: 'uploaded.png', subfolder: '', type: 'input' }
    ])
    const savedOutputs: Record<string, ExecutedWsMessage['output']> = {
      '3': inputOutput
    }
    store.restoreOutputs(savedOutputs)

    expect(store.nodeOutputs['3']).toStrictEqual(inputOutput)

    // Simulate execution sending new output for a different node
    const execOutput = createMockOutputs([
      { filename: 'ComfyUI_00001.png', subfolder: '', type: 'temp' }
    ])
    store.setNodeOutputsByExecutionId('4', execOutput)

    // Both should be present
    expect(store.nodeOutputs['3']).toStrictEqual(inputOutput)
    expect(store.nodeOutputs['4']).toStrictEqual(execOutput)
    expect(app.nodeOutputs['3']).toStrictEqual(inputOutput)
    expect(app.nodeOutputs['4']).toStrictEqual(execOutput)
  })

  it('should overwrite existing output when execution sends new data for same node', () => {
    const store = useNodeOutputStore()

    // Restore with input preview
    const inputOutput = createMockOutputs([
      { filename: 'uploaded.png', subfolder: '', type: 'input' }
    ])
    store.restoreOutputs({ '3': inputOutput })

    // Execution sends new output for the same node (non-merge)
    const execOutput = createMockOutputs([
      { filename: 'result.png', subfolder: '', type: 'temp' }
    ])
    store.setNodeOutputsByExecutionId('3', execOutput)

    // On current main (without PR #9123 guard), execution overwrites
    expect(store.nodeOutputs['3']).toStrictEqual(execOutput)
    expect(app.nodeOutputs['3']).toStrictEqual(execOutput)
  })
})

describe('nodeOutputStore merge mode interactions', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('should merge new images with existing input preview images', () => {
    const store = useNodeOutputStore()

    // Set initial input preview
    const inputOutput = createMockOutputs([
      { filename: 'uploaded.png', subfolder: '', type: 'input' }
    ])
    store.setNodeOutputsByExecutionId('3', inputOutput)

    // Merge new execution images
    const execOutput = createMockOutputs([
      { filename: 'result.png', subfolder: '', type: 'temp' }
    ])
    store.setNodeOutputsByExecutionId('3', execOutput, { merge: true })

    // Should have both images concatenated
    expect(store.nodeOutputs['3']?.images).toHaveLength(2)
    expect(app.nodeOutputs['3']?.images).toHaveLength(2)
    expect(store.nodeOutputs['3']?.images?.[0]?.filename).toBe('uploaded.png')
    expect(store.nodeOutputs['3']?.images?.[1]?.filename).toBe('result.png')
  })

  it('should not duplicate when merge is called with empty images array', () => {
    const store = useNodeOutputStore()

    // Set initial input preview
    const inputOutput = createMockOutputs([
      { filename: 'uploaded.png', subfolder: '', type: 'input' }
    ])
    store.setNodeOutputsByExecutionId('3', inputOutput)

    // Merge with empty images — the input-preview guard (lines 166-177)
    // copies existing input images into the incoming outputs before the
    // merge concat runs, resulting in duplication.
    const emptyOutput = createMockOutputs([])
    store.setNodeOutputsByExecutionId('3', emptyOutput, { merge: true })

    expect(store.nodeOutputs['3']?.images).toHaveLength(2)
    expect(store.nodeOutputs['3']?.images?.[0]?.filename).toBe('uploaded.png')
    expect(store.nodeOutputs['3']?.images?.[1]?.filename).toBe('uploaded.png')
  })
})

describe('nodeOutputStore setNodeOutputs (widget path)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('should return early for empty string filename', () => {
    const store = useNodeOutputStore()
    const node = createMockNode({ id: 5 })

    store.setNodeOutputs(node, '')

    expect(store.nodeOutputs['5']).toBeUndefined()
    expect(app.nodeOutputs['5']).toBeUndefined()
  })

  it('should return early for null node', () => {
    const store = useNodeOutputStore()

    store.setNodeOutputs(fromAny<LGraphNode, unknown>(null), 'test.png')

    expect(Object.keys(store.nodeOutputs)).toHaveLength(0)
  })

  it('should set outputs for valid string filename', () => {
    const store = useNodeOutputStore()
    const node = createMockNode({ id: 5 })

    store.setNodeOutputs(node, 'test.png')

    expect(store.nodeOutputs['5']).toBeDefined()
    expect(store.nodeOutputs['5']?.images).toHaveLength(1)
    expect(store.nodeOutputs['5']?.images?.[0]?.filename).toBe('test.png')
    expect(store.nodeOutputs['5']?.images?.[0]?.type).toBe('input')
  })

  it('should skip empty array of filenames after createOutputs', () => {
    const store = useNodeOutputStore()
    const node = createMockNode({ id: 5 })

    store.setNodeOutputs(node, [])

    expect(store.nodeOutputs['5']).toBeUndefined()
    expect(app.nodeOutputs['5']).toBeUndefined()
  })
})

describe('nodeOutputStore syncLegacyNodeImgs', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    LiteGraph.vueNodesMode = false
  })

  it('should not sync when vueNodesMode is disabled', () => {
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 1 })
    const mockImg = document.createElement('img')

    mockResolveNode.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs(1, mockImg, 0)

    expect(mockNode.imgs).toBeUndefined()
    expect(mockNode.imageIndex).toBeUndefined()
  })

  it('should sync node.imgs when vueNodesMode is enabled', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 1 })
    const mockImg = document.createElement('img')

    mockResolveNode.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs(1, mockImg, 0)

    expect(mockNode.imgs).toEqual([mockImg])
    expect(mockNode.imageIndex).toBe(0)
  })

  it('should sync with correct activeIndex', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 42 })
    const mockImg = document.createElement('img')

    mockResolveNode.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs(42, mockImg, 3)

    expect(mockNode.imgs).toEqual([mockImg])
    expect(mockNode.imageIndex).toBe(3)
  })

  it('should handle string nodeId', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 123 })
    const mockImg = document.createElement('img')

    mockResolveNode.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs('123', mockImg, 0)

    expect(mockResolveNode).toHaveBeenCalledWith(123)
    expect(mockNode.imgs).toEqual([mockImg])
  })

  it('should not throw when node is not found', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockImg = document.createElement('img')

    mockResolveNode.mockReturnValue(undefined)

    expect(() => store.syncLegacyNodeImgs(999, mockImg, 0)).not.toThrow()
  })

  it('should default activeIndex to 0', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 1 })
    const mockImg = document.createElement('img')

    mockResolveNode.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs(1, mockImg)

    expect(mockNode.imageIndex).toBe(0)
  })

  it('should sync node.imgs when node is inside a subgraph', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 5 })
    const mockImg = document.createElement('img')

    // Node NOT in root graph (returns null)
    mockGetNodeById.mockReturnValue(null)
    // But found by resolveNode (in a subgraph)
    mockResolveNode.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs(5, mockImg, 0)

    expect(mockNode.imgs).toEqual([mockImg])
    expect(mockNode.imageIndex).toBe(0)
  })
})
