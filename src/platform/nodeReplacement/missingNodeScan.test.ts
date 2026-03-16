import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'

vi.mock('@/lib/litegraph/src/litegraph', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    LiteGraph: {
      ...(actual.LiteGraph as Record<string, unknown>),
      registered_node_types: {} as Record<string, unknown>
    }
  }
})

vi.mock('@/utils/graphTraversalUtil', () => ({
  collectAllNodes: vi.fn(),
  getExecutionIdByNode: vi.fn()
}))

vi.mock('@/workbench/extensions/manager/utils/missingNodeErrorUtil', () => ({
  getCnrIdFromNode: vi.fn(() => null)
}))

vi.mock('@/i18n', () => ({
  st: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/stores/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn(() => true)
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn(() => true)
  })
}))

import {
  collectAllNodes,
  getExecutionIdByNode
} from '@/utils/graphTraversalUtil'
import { getCnrIdFromNode } from '@/workbench/extensions/manager/utils/missingNodeErrorUtil'
import { useNodeReplacementStore } from '@/platform/nodeReplacement/nodeReplacementStore'
import { rescanAndSurfaceMissingNodes } from './missingNodeScan'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

function mockNode(
  id: number,
  type: string,
  overrides: Partial<LGraphNode> = {}
): LGraphNode {
  return {
    id,
    type,
    last_serialization: { type },
    ...overrides
  } as unknown as LGraphNode
}

function mockGraph(): LGraph {
  return {} as unknown as LGraph
}

function getMissingNodesError(
  store: ReturnType<typeof useExecutionErrorStore>
) {
  const error = store.missingNodesError
  if (!error) throw new Error('Expected missingNodesError to be defined')
  return error
}

describe('scanMissingNodes (via rescanAndSurfaceMissingNodes)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Reset registered_node_types
    const reg = LiteGraph.registered_node_types as Record<string, unknown>
    for (const key of Object.keys(reg)) {
      delete reg[key]
    }
  })

  it('returns empty when all nodes are registered', () => {
    const reg = LiteGraph.registered_node_types as Record<string, unknown>
    reg['KSampler'] = {}

    vi.mocked(collectAllNodes).mockReturnValue([mockNode(1, 'KSampler')])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useExecutionErrorStore()
    expect(store.missingNodesError).toBeNull()
  })

  it('detects unregistered nodes as missing', () => {
    vi.mocked(collectAllNodes).mockReturnValue([
      mockNode(1, 'OldNode'),
      mockNode(2, 'AnotherOldNode')
    ])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useExecutionErrorStore()
    const error = getMissingNodesError(store)
    expect(error.nodeTypes).toHaveLength(2)
  })

  it('skips registered nodes and lists only unregistered', () => {
    const reg = LiteGraph.registered_node_types as Record<string, unknown>
    reg['RegisteredNode'] = {}

    vi.mocked(collectAllNodes).mockReturnValue([
      mockNode(1, 'RegisteredNode'),
      mockNode(2, 'UnregisteredNode')
    ])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useExecutionErrorStore()
    const error = getMissingNodesError(store)
    expect(error.nodeTypes).toHaveLength(1)
    const missing = error.nodeTypes[0]
    expect(typeof missing !== 'string' && missing.type).toBe('UnregisteredNode')
  })

  it('uses executionId when available for nodeId', () => {
    vi.mocked(collectAllNodes).mockReturnValue([mockNode(1, 'Missing')])
    vi.mocked(getExecutionIdByNode).mockReturnValue('exec-42')

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useExecutionErrorStore()
    const error = getMissingNodesError(store)
    const missing = error.nodeTypes[0]
    expect(typeof missing !== 'string' && missing.nodeId).toBe('exec-42')
  })

  it('falls back to node.id when executionId is null', () => {
    vi.mocked(collectAllNodes).mockReturnValue([mockNode(99, 'Missing')])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useExecutionErrorStore()
    const error = getMissingNodesError(store)
    const missing = error.nodeTypes[0]
    expect(typeof missing !== 'string' && missing.nodeId).toBe('99')
  })

  it('populates cnrId from getCnrIdFromNode', () => {
    vi.mocked(collectAllNodes).mockReturnValue([mockNode(1, 'Missing')])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)
    vi.mocked(getCnrIdFromNode).mockReturnValue('comfy-nodes/my-pack')

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useExecutionErrorStore()
    const error = getMissingNodesError(store)
    const missing = error.nodeTypes[0]
    expect(typeof missing !== 'string' && missing.cnrId).toBe(
      'comfy-nodes/my-pack'
    )
  })

  it('marks node as replaceable when replacement exists', () => {
    vi.mocked(collectAllNodes).mockReturnValue([mockNode(1, 'OldNode')])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    const replacementStore = useNodeReplacementStore()
    replacementStore.replacements = {
      OldNode: [
        {
          old_node_id: 'OldNode',
          new_node_id: 'NewNode',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        }
      ]
    }

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useExecutionErrorStore()
    const error = getMissingNodesError(store)
    const missing = error.nodeTypes[0]
    expect(typeof missing !== 'string' && missing.isReplaceable).toBe(true)
    expect(
      typeof missing !== 'string' && missing.replacement?.new_node_id
    ).toBe('NewNode')
  })

  it('marks node as not replaceable when no replacement', () => {
    vi.mocked(collectAllNodes).mockReturnValue([mockNode(1, 'OldNode')])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useExecutionErrorStore()
    const error = getMissingNodesError(store)
    const missing = error.nodeTypes[0]
    expect(typeof missing !== 'string' && missing.isReplaceable).toBe(false)
  })

  it('uses last_serialization.type over node.type', () => {
    const node = mockNode(1, 'LiveType')
    node.last_serialization = {
      type: 'OriginalType'
    } as unknown as LGraphNode['last_serialization']
    vi.mocked(collectAllNodes).mockReturnValue([node])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useExecutionErrorStore()
    const error = getMissingNodesError(store)
    const missing = error.nodeTypes[0]
    expect(typeof missing !== 'string' && missing.type).toBe('OriginalType')
  })
})
