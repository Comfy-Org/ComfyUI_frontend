import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@/types/nodeIdentification'
import type { NodeExecutionId, NodeLocatorId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import * as litegraphUtil from '@/utils/litegraphUtil'

const {
  mockApiURL,
  mockExecutionIdToNodeLocatorId,
  mockNodeIdToNodeLocatorId,
  mockNodeToNodeLocatorId,
  mockReleaseSharedObjectUrl,
  mockRetainSharedObjectUrl
} = vi.hoisted(() => ({
  mockApiURL: vi.fn((path: string) => `api${path}`),
  mockExecutionIdToNodeLocatorId: vi.fn(
    (_rootGraph: unknown, id: NodeExecutionId): NodeLocatorId | undefined =>
      String(id) as NodeLocatorId
  ),
  mockNodeIdToNodeLocatorId: vi.fn(
    (id: string | number): NodeLocatorId | undefined =>
      String(id) as NodeLocatorId
  ),
  mockNodeToNodeLocatorId: vi.fn(
    (node: { id: string | number }): NodeLocatorId | undefined =>
      String(node.id) as NodeLocatorId
  ),
  mockReleaseSharedObjectUrl: vi.fn(),
  mockRetainSharedObjectUrl: vi.fn()
}))

const mockResolveNode = vi.fn()

vi.mock('@/utils/litegraphUtil', () => ({
  isAnimatedOutput: vi.fn(),
  isVideoNode: vi.fn(),
  resolveNode: (...args: unknown[]) => mockResolveNode(...args)
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (...args: Parameters<typeof mockApiURL>) => mockApiURL(...args)
  }
}))

vi.mock('@/utils/objectUrlUtil', () => ({
  releaseSharedObjectUrl: (...args: [string | undefined]) =>
    mockReleaseSharedObjectUrl(...args),
  retainSharedObjectUrl: (...args: [string | undefined]) =>
    mockRetainSharedObjectUrl(...args)
}))

const mockGetNodeById = vi.fn()

vi.mock('@/scripts/app', () => ({
  app: {
    getPreviewFormatParam: vi.fn(() => '&format=test_webp'),
    getRandParam: vi.fn(() => '&rand=1'),
    rootGraph: {
      getNodeById: (...args: unknown[]) => mockGetNodeById(...args)
    },
    nodeOutputs: {} as Record<string, unknown>,
    nodePreviewImages: {} as Record<string, string[]>
  }
}))

const createMockNode = (
  overrides: Record<string, unknown> = {}
): LGraphNode => {
  const { id = 1, ...rest } = overrides
  return {
    id: toNodeId(id as string | number),
    type: 'TestNode',
    ...rest
  } as LGraphNode
}

const createMockOutputs = (
  images?: ExecutedWsMessage['output']['images']
): ExecutedWsMessage['output'] => ({ images })

vi.mock('@/utils/graphTraversalUtil', () => ({
  executionIdToNodeLocatorId: (
    ...args: Parameters<typeof mockExecutionIdToNodeLocatorId>
  ) => mockExecutionIdToNodeLocatorId(...args)
}))

beforeEach(() => {
  mockExecutionIdToNodeLocatorId.mockImplementation(
    (_rootGraph: unknown, id: NodeExecutionId): NodeLocatorId | undefined =>
      String(id) as NodeLocatorId
  )
  mockNodeIdToNodeLocatorId.mockImplementation(
    (id: string | number) => String(id) as NodeLocatorId
  )
  mockNodeToNodeLocatorId.mockImplementation(
    (node: { id: string | number }) => String(node.id) as NodeLocatorId
  )
})

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    nodeIdToNodeLocatorId: (
      ...args: Parameters<typeof mockNodeIdToNodeLocatorId>
    ) => mockNodeIdToNodeLocatorId(...args),
    nodeToNodeLocatorId: (
      ...args: Parameters<typeof mockNodeToNodeLocatorId>
    ) => mockNodeToNodeLocatorId(...args)
  }))
}))

describe('nodeOutputStore setNodeOutputsByExecutionId with merge', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('keeps execution-keyed outputs distinct from locator-keyed outputs', () => {
    const store = useNodeOutputStore()
    const firstOutput = createMockOutputs([{ filename: 'first.png' }])
    const secondOutput = createMockOutputs([{ filename: 'second.png' }])

    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(11), toNodeId(20), toNodeId(10)]),
      firstOutput
    )
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(12), toNodeId(20), toNodeId(10)]),
      secondOutput
    )

    expect(
      store.getNodeOutputByExecutionId(
        createNodeExecutionId([toNodeId(11), toNodeId(20), toNodeId(10)])
      )
    ).toEqual(firstOutput)
    expect(
      store.getNodeOutputByExecutionId(
        createNodeExecutionId([toNodeId(12), toNodeId(20), toNodeId(10)])
      )
    ).toEqual(secondOutput)
  })

  it('merges execution-keyed outputs when merge is true', () => {
    const store = useNodeOutputStore()
    const initialOutput = createMockOutputs([{ filename: 'first.png' }])
    const nextOutput = createMockOutputs([{ filename: 'second.png' }])

    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(11), toNodeId(20), toNodeId(10)]),
      initialOutput
    )
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(11), toNodeId(20), toNodeId(10)]),
      nextOutput,
      {
        merge: true
      }
    )

    expect(
      store.getNodeOutputByExecutionId(
        createNodeExecutionId([toNodeId(11), toNodeId(20), toNodeId(10)])
      )?.images
    ).toEqual([{ filename: 'first.png' }, { filename: 'second.png' }])
  })

  it('keeps execution-keyed previews distinct from locator-keyed previews', () => {
    const store = useNodeOutputStore()

    store.setNodePreviewsByExecutionId(
      createNodeExecutionId([toNodeId(11), toNodeId(20), toNodeId(10)]),
      ['blob:first']
    )
    store.setNodePreviewsByExecutionId(
      createNodeExecutionId([toNodeId(12), toNodeId(20), toNodeId(10)]),
      ['blob:second']
    )

    expect(
      store.getNodePreviewImagesByExecutionId(
        createNodeExecutionId([toNodeId(11), toNodeId(20), toNodeId(10)])
      )
    ).toEqual(['blob:first'])
    expect(
      store.getNodePreviewImagesByExecutionId(
        createNodeExecutionId([toNodeId(12), toNodeId(20), toNodeId(10)])
      )
    ).toEqual(['blob:second'])
  })

  it('should update reactive nodeOutputs.value when merging outputs', () => {
    const store = useNodeOutputStore()
    const executionId = createNodeExecutionId([toNodeId(1)])

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
    const executionId = createNodeExecutionId([toNodeId(1)])

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
    const executionId = createNodeExecutionId([toNodeId(1)])

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
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(3)]),
      widgetOutput
    )

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
    const executionId = createNodeExecutionId([toNodeId(3)])

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
    const executionId = createNodeExecutionId([toNodeId(3)])

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
    const executionId = createNodeExecutionId([toNodeId(3)])

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
    const executionId = createNodeExecutionId([toNodeId(4)])

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
    const executionId = createNodeExecutionId([toNodeId(5)])

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

  it('should return empty string if outputs.images only contains null entries', () => {
    const store = useNodeOutputStore()
    const node = createMockNode()
    const outputs = createMockOutputs([])
    ;(outputs as Record<string, unknown>).images = [null]
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
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(3)]),
      inputOutput
    )

    const execOutput = createMockOutputs([
      { filename: 'ComfyUI_00001.png', subfolder: '', type: 'temp' }
    ])
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(4)]),
      execOutput
    )

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
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(1)]),
      outputA1
    )
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(3)]),
      outputA2
    )

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
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(5)]),
      newOutput
    )
    expect(store.nodeOutputs['5']).toStrictEqual(newOutput)
  })

  it('should keep tab outputs independent across multiple switches', () => {
    const store = useNodeOutputStore()

    // Tab A: execute
    const outputA = createMockOutputs([{ filename: 'tab_a.png' }])
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(1)]),
      outputA
    )
    const snapshotA = store.snapshotOutputs()

    // Switch to Tab B
    store.resetAllOutputsAndPreviews()
    const outputB = createMockOutputs([{ filename: 'tab_b.png' }])
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(1)]),
      outputB
    )
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
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(1)]),
      output
    )

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
      createNodeExecutionId([toNodeId(1)]),
      createMockOutputs([{ filename: 'a.png' }])
    )
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(2)]),
      createMockOutputs([{ filename: 'b.png' }])
    )
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(3)]),
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
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(4)]),
      execOutput
    )

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
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(3)]),
      execOutput
    )

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
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(3)]),
      inputOutput
    )

    // Merge new execution images
    const execOutput = createMockOutputs([
      { filename: 'result.png', subfolder: '', type: 'temp' }
    ])
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(3)]),
      execOutput,
      {
        merge: true
      }
    )

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
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(3)]),
      inputOutput
    )

    // Merge with empty images — the input-preview guard (lines 166-177)
    // copies existing input images into the incoming outputs before the
    // merge concat runs, resulting in duplication.
    const emptyOutput = createMockOutputs([])
    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(3)]),
      emptyOutput,
      {
        merge: true
      }
    )

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

    store.setNodeOutputs(null, 'test.png')

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

  it('ignores widget outputs when no locator can be resolved', () => {
    const store = useNodeOutputStore()
    const node = createMockNode({ id: 5 })
    mockNodeToNodeLocatorId.mockReturnValueOnce(undefined)

    store.setNodeOutputs(node, 'test.png')

    expect(store.nodeOutputs).toEqual({})
    expect(app.nodeOutputs).toEqual({})
  })

  it('should skip empty array of filenames after createOutputs', () => {
    const store = useNodeOutputStore()
    const node = createMockNode({ id: 5 })

    store.setNodeOutputs(node, [])

    expect(store.nodeOutputs['5']).toBeUndefined()
    expect(app.nodeOutputs['5']).toBeUndefined()
  })

  it('stores direct result items without wrapping them as image outputs', () => {
    const store = useNodeOutputStore()
    const node = createMockNode({ id: 5 })

    store.setNodeOutputs(node, { filename: 'direct.png', type: 'temp' })

    expect(store.nodeOutputs['5']).toEqual({
      filename: 'direct.png',
      type: 'temp'
    })
  })

  it('marks animated webp and png filenames when requested', () => {
    const store = useNodeOutputStore()
    const node = createMockNode({ id: 5 })

    store.setNodeOutputs(node, ['clip.webp', 'still.jpg', 'mask.png'], {
      folder: 'output',
      isAnimated: true
    })

    expect(store.nodeOutputs['5']?.animated).toEqual([true, false, true])
    expect(store.nodeOutputs['5']?.images?.map((image) => image.type)).toEqual([
      'output',
      'output',
      'output'
    ])
  })
})

describe('nodeOutputStore image URLs', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    vi.mocked(litegraphUtil.isAnimatedOutput).mockReturnValue(false)
    vi.mocked(litegraphUtil.isVideoNode).mockReturnValue(false)
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('returns stored preview URLs before output URLs', () => {
    const store = useNodeOutputStore()
    const node = createMockNode({ id: 5 })

    store.setNodePreviewsByLocatorId(createNodeLocatorId(null, toNodeId(5)), [
      'blob:preview'
    ])

    expect(store.getNodeImageUrls(node)).toEqual(['blob:preview'])
    expect(mockApiURL).not.toHaveBeenCalled()
  })

  it('builds view URLs from output images', () => {
    const store = useNodeOutputStore()
    const node = createMockNode({ id: 5 })
    app.nodeOutputs['5'] = createMockOutputs([
      { filename: 'a.png', subfolder: 'x', type: 'temp' }
    ])

    expect(store.getNodeImageUrls(node)).toEqual([
      'api/view?filename=a.png&subfolder=x&type=temp&format=test_webp&rand=1'
    ])
  })

  it('returns undefined when a node has neither previews nor outputs', () => {
    const store = useNodeOutputStore()

    expect(store.getNodeImageUrls(createMockNode({ id: 5 }))).toBeUndefined()
  })

  it('returns execution previews before execution output URLs', () => {
    const store = useNodeOutputStore()
    const node = createMockNode({ id: 5 })
    const executionId = createNodeExecutionId([toNodeId(5)])

    store.setNodePreviewsByExecutionId(executionId, ['blob:preview'])

    expect(store.getNodeImageUrlsByExecutionId(executionId, node)).toEqual([
      'blob:preview'
    ])
    expect(store.latestPreview).toEqual(['blob:preview'])
    expect(mockApiURL).not.toHaveBeenCalled()
  })

  it('falls back to execution output URLs when no preview exists', () => {
    const store = useNodeOutputStore()
    const node = createMockNode({ id: 5 })
    const executionId = createNodeExecutionId([toNodeId(5)])

    store.setNodeOutputsByExecutionId(
      executionId,
      createMockOutputs([{ filename: 'result.png', type: 'temp' }])
    )

    expect(store.getNodeImageUrlsByExecutionId(executionId, node)).toEqual([
      'api/view?filename=result.png&type=temp&format=test_webp&rand=1'
    ])
  })
})

describe('nodeOutputStore locator misses', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('keeps execution operations inert when no locator can be resolved', () => {
    const store = useNodeOutputStore()
    const executionId = createNodeExecutionId([toNodeId(5)])
    mockExecutionIdToNodeLocatorId.mockReturnValue(undefined)

    store.setNodeOutputsByExecutionId(
      executionId,
      createMockOutputs([{ filename: 'result.png' }])
    )
    store.setNodePreviewsByExecutionId(executionId, ['blob:preview'])
    store.revokePreviewsByExecutionId(executionId)

    expect(store.getNodeOutputByExecutionId(executionId)).toBeUndefined()
    expect(store.getNodePreviewImagesByExecutionId(executionId)).toBeUndefined()
    expect(store.nodeOutputs).toEqual({})
    expect(store.nodePreviewImages).toEqual({})
  })
})

describe('nodeOutputStore merge branches', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('sets outputs when merge is requested without existing output', () => {
    const store = useNodeOutputStore()
    const executionId = createNodeExecutionId([toNodeId(5)])
    const output = createMockOutputs([{ filename: 'first.png' }])

    store.setNodeOutputsByExecutionId(executionId, output, { merge: true })

    expect(store.nodeOutputs[executionId]).toEqual(output)
  })

  it('ignores null outputs', () => {
    const store = useNodeOutputStore()
    const executionId = createNodeExecutionId([toNodeId(5)])

    store.setNodeOutputsByExecutionId(executionId, null)

    expect(store.nodeOutputs[executionId]).toBeUndefined()
  })

  it('overwrites non-array fields during merge', () => {
    const store = useNodeOutputStore()
    const executionId = createNodeExecutionId([toNodeId(5)])
    const firstOutput: ExecutedWsMessage['output'] = {
      images: [{ filename: 'first.png' }],
      text: 'old'
    }

    store.setNodeOutputsByExecutionId(executionId, firstOutput)
    store.setNodeOutputsByExecutionId(
      executionId,
      { text: ['new'] },
      { merge: true }
    )

    expect(store.nodeOutputs[executionId]?.images).toEqual([
      { filename: 'first.png' }
    ])
    expect(store.nodeOutputs[executionId]?.text).toEqual(['new'])
  })
})

describe('nodeOutputStore previews and removal', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('releases old previews and retains new previews on replacement', () => {
    const store = useNodeOutputStore()
    const locatorId = createNodeLocatorId(null, toNodeId(5))

    store.setNodePreviewsByLocatorId(locatorId, ['blob:first'])
    store.setNodePreviewsByLocatorId(locatorId, ['blob:second'])

    expect(mockReleaseSharedObjectUrl).toHaveBeenCalledWith('blob:first')
    expect(mockRetainSharedObjectUrl).toHaveBeenCalledWith('blob:second')
    expect(store.nodePreviewImages[locatorId]).toEqual(['blob:second'])
  })

  it('cancels scheduled revocation when a newer preview arrives', async () => {
    vi.useFakeTimers()
    const store = useNodeOutputStore()
    const executionId = createNodeExecutionId([toNodeId(5)])

    store.setNodePreviewsByExecutionId(executionId, ['blob:first'])
    store.revokePreviewsByExecutionId(executionId)
    store.setNodePreviewsByExecutionId(executionId, ['blob:second'])
    await vi.advanceTimersByTimeAsync(400)
    vi.useRealTimers()

    expect(store.nodePreviewImages[executionId]).toEqual(['blob:second'])
    expect(mockReleaseSharedObjectUrl).not.toHaveBeenCalledWith('blob:second')
  })

  it('revokes locator previews and clears preview state', () => {
    const store = useNodeOutputStore()
    const locatorId = createNodeLocatorId(null, toNodeId(5))

    store.setNodePreviewsByLocatorId(locatorId, ['blob:first'])
    store.revokePreviewsByLocatorId(locatorId)

    expect(mockReleaseSharedObjectUrl).toHaveBeenCalledWith('blob:first')
    expect(store.nodePreviewImages[locatorId]).toBeUndefined()
    expect(app.nodePreviewImages[locatorId]).toBeUndefined()
  })

  it('leaves state unchanged when revoking a locator with no previews', () => {
    const store = useNodeOutputStore()

    store.revokePreviewsByLocatorId(createNodeLocatorId(null, toNodeId(5)))

    expect(mockReleaseSharedObjectUrl).not.toHaveBeenCalled()
    expect(store.nodePreviewImages).toEqual({})
  })

  it('skips non-iterable preview entries when revoking all previews', () => {
    const store = useNodeOutputStore()
    app.nodePreviewImages = { '6': ['blob:preview'] }
    ;(app.nodePreviewImages as Record<string, unknown>)['5'] = {}

    store.revokeAllPreviews()

    expect(mockReleaseSharedObjectUrl).toHaveBeenCalledTimes(1)
    expect(mockReleaseSharedObjectUrl).toHaveBeenCalledWith('blob:preview')
    expect(store.nodePreviewImages).toEqual({})
  })

  it('revokes subgraph previews for the parent node and child nodes', () => {
    const store = useNodeOutputStore()
    const subgraphId = '11111111-1111-1111-1111-111111111111'
    const parentLocatorId = createNodeLocatorId(null, toNodeId(9))
    const childLocatorId = createNodeLocatorId(subgraphId, toNodeId(10))
    const subgraphNode = {
      id: toNodeId(9),
      graph: { isRootGraph: true },
      subgraph: {
        id: subgraphId,
        nodes: [createMockNode({ id: 10 })]
      }
    } as SubgraphNode

    store.setNodePreviewsByLocatorId(parentLocatorId, ['blob:parent'])
    store.setNodePreviewsByLocatorId(childLocatorId, ['blob:child'])
    store.revokeSubgraphPreviews(subgraphNode)

    expect(store.nodePreviewImages[parentLocatorId]).toBeUndefined()
    expect(store.nodePreviewImages[childLocatorId]).toBeUndefined()
    expect(mockReleaseSharedObjectUrl).toHaveBeenCalledWith('blob:parent')
    expect(mockReleaseSharedObjectUrl).toHaveBeenCalledWith('blob:child')
  })

  it('uses the parent graph id for non-root subgraph preview revocation', () => {
    const store = useNodeOutputStore()
    const graphId = '22222222-2222-2222-2222-222222222222'
    const subgraphId = '33333333-3333-3333-3333-333333333333'
    const parentLocatorId = createNodeLocatorId(graphId, toNodeId(9))
    const subgraphNodeRaw: unknown = {
      id: toNodeId(9),
      graph: { id: graphId, isRootGraph: false },
      subgraph: { id: subgraphId, nodes: [] }
    }
    const subgraphNode = subgraphNodeRaw as SubgraphNode

    store.setNodePreviewsByLocatorId(parentLocatorId, ['blob:parent'])
    store.revokeSubgraphPreviews(subgraphNode)

    expect(store.nodePreviewImages[parentLocatorId]).toBeUndefined()
  })

  it('leaves previews alone when a subgraph node has no parent graph', () => {
    const store = useNodeOutputStore()
    const locatorId = createNodeLocatorId(null, toNodeId(9))
    const subgraphNodeRaw2: unknown = {
      graph: undefined,
      subgraph: { nodes: [] }
    }
    const subgraphNode = subgraphNodeRaw2 as SubgraphNode

    store.setNodePreviewsByLocatorId(locatorId, ['blob:parent'])
    store.revokeSubgraphPreviews(subgraphNode)

    expect(store.nodePreviewImages[locatorId]).toEqual(['blob:parent'])
  })

  it('removes outputs and previews for a node id', () => {
    const store = useNodeOutputStore()
    const executionId = createNodeExecutionId([toNodeId(5)])

    store.setNodeOutputsByExecutionId(
      executionId,
      createMockOutputs([{ filename: 'result.png' }])
    )
    store.setNodePreviewsByExecutionId(executionId, ['blob:preview'])

    expect(store.removeNodeOutputs(toNodeId(5))).toBe(true)
    expect(store.nodeOutputs[executionId]).toBeUndefined()
    expect(store.nodePreviewImages[executionId]).toBeUndefined()
    expect(mockReleaseSharedObjectUrl).toHaveBeenCalledWith('blob:preview')
  })

  it('returns false when removing outputs for a node with no outputs', () => {
    const store = useNodeOutputStore()

    expect(store.removeNodeOutputsForNode(createMockNode({ id: 9 }))).toBe(
      false
    )
  })

  it('returns false when a node id cannot resolve to a locator', () => {
    const store = useNodeOutputStore()
    mockNodeIdToNodeLocatorId.mockReturnValueOnce(undefined)

    expect(store.removeNodeOutputs(toNodeId(9))).toBe(false)
  })

  it('removes preview state even when preview entries are not iterable', () => {
    const store = useNodeOutputStore()
    const executionId = createNodeExecutionId([toNodeId(5)])

    store.setNodeOutputsByExecutionId(
      executionId,
      createMockOutputs([{ filename: 'result.png' }])
    )
    ;(app.nodePreviewImages as Record<string, unknown>)[executionId] = {}
    ;(store.nodePreviewImages as Record<string, unknown>)[executionId] = {}

    expect(store.removeNodeOutputs(toNodeId(5))).toBe(true)
    expect(store.nodePreviewImages[executionId]).toBeUndefined()
    expect(mockReleaseSharedObjectUrl).not.toHaveBeenCalled()
  })
})

describe('nodeOutputStore output refresh', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('updates stored output images from legacy node images', () => {
    const store = useNodeOutputStore()
    const node = createMockNode({
      id: 5,
      images: [{ filename: 'new.png', type: 'temp' }]
    })

    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(5)]),
      createMockOutputs([{ filename: 'old.png', type: 'temp' }])
    )
    store.updateNodeImages(node)

    expect(store.nodeOutputs['5']?.images).toEqual([
      { filename: 'new.png', type: 'temp' }
    ])
  })

  it('ignores legacy image updates when the node has no images', () => {
    const store = useNodeOutputStore()

    store.updateNodeImages(createMockNode({ id: 5 }))

    expect(store.nodeOutputs).toEqual({})
  })

  it('ignores legacy image updates when no locator exists', () => {
    const store = useNodeOutputStore()
    mockNodeIdToNodeLocatorId.mockReturnValueOnce(undefined)

    store.updateNodeImages(
      createMockNode({ id: 5, images: [{ filename: 'new.png' }] })
    )

    expect(store.nodeOutputs).toEqual({})
  })

  it('ignores legacy image updates when no output exists', () => {
    const store = useNodeOutputStore()

    store.updateNodeImages(
      createMockNode({ id: 5, images: [{ filename: 'new.png' }] })
    )

    expect(store.nodeOutputs).toEqual({})
  })

  it('copies app outputs into reactive state during refresh', () => {
    const store = useNodeOutputStore()
    const node = createMockNode({ id: 5 })
    const output = createMockOutputs([{ filename: 'result.png' }])
    app.nodeOutputs['5'] = output

    store.refreshNodeOutputs(node)

    expect(store.nodeOutputs['5']).toEqual(output)
    expect(store.nodeOutputs['5']).not.toBe(output)
  })

  it('does not refresh when a node has no locator', () => {
    const store = useNodeOutputStore()
    mockNodeToNodeLocatorId.mockReturnValueOnce(undefined)

    store.refreshNodeOutputs(createMockNode({ id: 5 }))

    expect(store.nodeOutputs).toEqual({})
  })

  it('does not refresh when app has no output for the node', () => {
    const store = useNodeOutputStore()

    store.refreshNodeOutputs(createMockNode({ id: 5 }))

    expect(store.nodeOutputs).toEqual({})
  })

  it('keeps unresolved restore output ids as their original ids', () => {
    const store = useNodeOutputStore()
    const output = createMockOutputs([{ filename: 'saved.png' }])
    mockExecutionIdToNodeLocatorId.mockReturnValueOnce(undefined)

    store.restoreOutputs({ missing: output })

    expect(store.nodeOutputs.missing).toEqual(output)
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

    store.syncLegacyNodeImgs(toNodeId(1), mockImg, 0)

    expect(mockNode.imgs).toBeUndefined()
    expect(mockNode.imageIndex).toBeUndefined()
  })

  it('should sync node.imgs when vueNodesMode is enabled', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 1 })
    const mockImg = document.createElement('img')

    mockResolveNode.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs(toNodeId(1), mockImg, 0)

    expect(mockNode.imgs).toEqual([mockImg])
    expect(mockNode.imageIndex).toBe(0)
  })

  it('should sync with correct activeIndex', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 42 })
    const mockImg = document.createElement('img')

    mockResolveNode.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs(toNodeId(42), mockImg, 3)

    expect(mockNode.imgs).toEqual([mockImg])
    expect(mockNode.imageIndex).toBe(3)
  })

  it('should handle string nodeId', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 123 })
    const mockImg = document.createElement('img')

    mockResolveNode.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs(toNodeId('123'), mockImg, 0)

    expect(mockResolveNode).toHaveBeenCalledWith('123')
    expect(mockNode.imgs).toEqual([mockImg])
  })

  it('should not throw when node is not found', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockImg = document.createElement('img')

    mockResolveNode.mockReturnValue(undefined)

    expect(() =>
      store.syncLegacyNodeImgs(toNodeId(999), mockImg, 0)
    ).not.toThrow()
  })

  it('should default activeIndex to 0', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 1 })
    const mockImg = document.createElement('img')

    mockResolveNode.mockReturnValue(mockNode)

    store.syncLegacyNodeImgs(toNodeId(1), mockImg)

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

    store.syncLegacyNodeImgs(toNodeId(5), mockImg, 0)

    expect(mockNode.imgs).toEqual([mockImg])
    expect(mockNode.imageIndex).toBe(0)
  })

  it('copies output images onto the legacy node', () => {
    LiteGraph.vueNodesMode = true
    const store = useNodeOutputStore()
    const mockNode = createMockNode({ id: 1 })
    const mockImg = document.createElement('img')
    mockResolveNode.mockReturnValue(mockNode)

    store.setNodeOutputsByExecutionId(
      createNodeExecutionId([toNodeId(1)]),
      createMockOutputs([{ filename: 'result.png', type: 'temp' }])
    )
    store.syncLegacyNodeImgs(toNodeId(1), mockImg)

    expect(mockNode.images).toEqual([{ filename: 'result.png', type: 'temp' }])
  })
})
