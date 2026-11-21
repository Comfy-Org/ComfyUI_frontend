import { useSettingStore } from '@/platform/settings/settingStore'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import '@/scripts/changeTracker'

vi.mock(import('@/utils/graphTraversalUtil'), () => ({
  collectAllNodes: vi.fn(),
  getExecutionIdByNode: vi.fn(),
  getNodeByExecutionId: vi.fn(() => null)
}))

vi.mock(import('@/i18n'))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: false
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({ app: {} }))

import {
  collectAllNodes,
  getExecutionIdByNode,
  getNodeByExecutionId
} from '@/utils/graphTraversalUtil'
import { useNodeReplacementStore } from '@/platform/workflowErrors/nodeReplacement/nodeReplacementStore'
import {
  refreshMissingNodeReplacements,
  rescanAndSurfaceMissingNodes
} from './missingNodeScan'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import type {
  MissingNodeType,
  NodeReplacement
} from '@/platform/workflowErrors/nodeReplacement/types'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { createNodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

function mockNode(
  id: number,
  type: string,
  overrides: Record<string, unknown> = {}
): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id,
    type,
    last_serialization: { type },
    ...overrides
  })
}

function mockGraph(): LGraph {
  return fromAny<LGraph, unknown>({})
}

function getMissingNodesError(
  store: ReturnType<typeof useMissingNodesErrorStore>
) {
  const error = store.missingNodesError
  if (!error) throw new Error('Expected missingNodesError to be defined')
  return error
}

beforeEach(() => {
  vi.mocked(useSettingStore().get).mockImplementation(() => true)
})

describe('scanMissingNodes (via rescanAndSurfaceMissingNodes)', () => {
  it('returns empty when all nodes are registered', () => {
    const reg = LiteGraph.registered_node_types as Record<string, unknown>
    reg['KSampler'] = {}

    vi.mocked(collectAllNodes).mockReturnValue([mockNode(1, 'KSampler')])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useMissingNodesErrorStore()
    expect(store.missingNodesError).toBeNull()
  })

  it('clears an absorbed missing-node prompt when a rescan finds none', () => {
    const missingNodesStore = useMissingNodesErrorStore()
    missingNodesStore.surfaceMissingNodes([
      {
        type: 'MissingNode',
        nodeId: '1',
        isReplaceable: false
      }
    ])
    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.recordPromptError({
      type: 'missing_node_type',
      message: 'MissingNode is unavailable',
      details: ''
    })
    vi.mocked(collectAllNodes).mockReturnValue([])

    rescanAndSurfaceMissingNodes(mockGraph())

    expect(missingNodesStore.missingNodesError).toBeNull()
    expect(executionErrorStore.lastPromptError).toBeNull()
  })

  it('detects unregistered nodes as missing', () => {
    vi.mocked(collectAllNodes).mockReturnValue([
      mockNode(1, 'OldNode'),
      mockNode(2, 'AnotherOldNode')
    ])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useMissingNodesErrorStore()
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

    const store = useMissingNodesErrorStore()
    const error = getMissingNodesError(store)
    expect(error.nodeTypes).toHaveLength(1)
    const missing = error.nodeTypes[0]
    expect(typeof missing !== 'string' && missing.type).toBe('UnregisteredNode')
  })

  it('uses executionId when available for nodeId', () => {
    vi.mocked(collectAllNodes).mockReturnValue([mockNode(1, 'Missing')])
    vi.mocked(getExecutionIdByNode).mockReturnValue(
      createNodeExecutionId([toNodeId('exec-42')])
    )

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useMissingNodesErrorStore()
    const error = getMissingNodesError(store)
    const missing = error.nodeTypes[0]
    expect(typeof missing !== 'string' && missing.nodeId).toBe('exec-42')
  })

  it('falls back to node.id when executionId is null', () => {
    vi.mocked(collectAllNodes).mockReturnValue([mockNode(99, 'Missing')])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useMissingNodesErrorStore()
    const error = getMissingNodesError(store)
    const missing = error.nodeTypes[0]
    expect(typeof missing !== 'string' && missing.nodeId).toBe('99')
  })

  it('keeps a saved aux_id as the pack but matches replacements by cnr_id only', () => {
    const soleEntry: NodeReplacement = {
      old_node_id: 'StringConstant',
      new_node_id: 'PrimitiveString',
      old_widget_ids: ['string'],
      input_mapping: [{ new_id: 'value', old_id: 'string' }],
      output_mapping: null,
      old_pack: 'comfyui-kjnodes',
      kind: 'equivalent'
    }
    useNodeReplacementStore().replacements = { StringConstant: [soleEntry] }
    vi.mocked(collectAllNodes).mockReturnValue([
      mockNode(1, 'StringConstant', {
        properties: { aux_id: 'kijai/ComfyUI-KJNodes' },
        last_serialization: {
          type: 'StringConstant',
          widgets_values: ['text']
        }
      })
    ])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    rescanAndSurfaceMissingNodes(mockGraph())

    expect(getMissingNodesError(useMissingNodesErrorStore()).nodeTypes).toEqual(
      [
        {
          type: 'StringConstant',
          nodeId: '1',
          cnrId: 'kijai/ComfyUI-KJNodes',
          isReplaceable: true,
          replacement: soleEntry
        }
      ]
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

    const store = useMissingNodesErrorStore()
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

    const store = useMissingNodesErrorStore()
    const error = getMissingNodesError(store)
    const missing = error.nodeTypes[0]
    expect(typeof missing !== 'string' && missing.isReplaceable).toBe(false)
  })

  it('skips muted nodes (mode NEVER = 2)', () => {
    vi.mocked(collectAllNodes).mockReturnValue([
      mockNode(1, 'MutedNode', { mode: 2 })
    ])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useMissingNodesErrorStore()
    expect(store.missingNodesError).toBeNull()
  })

  it('skips bypassed nodes (mode BYPASS = 4)', () => {
    vi.mocked(collectAllNodes).mockReturnValue([
      mockNode(1, 'BypassedNode', { mode: 4 })
    ])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useMissingNodesErrorStore()
    expect(store.missingNodesError).toBeNull()
  })

  it('detects active nodes (mode ALWAYS = 0) as missing', () => {
    vi.mocked(collectAllNodes).mockReturnValue([
      mockNode(1, 'ActiveMissingNode', { mode: 0 })
    ])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useMissingNodesErrorStore()
    const error = getMissingNodesError(store)
    expect(error.nodeTypes).toHaveLength(1)
    const missing = error.nodeTypes[0]
    expect(typeof missing !== 'string' && missing.type).toBe(
      'ActiveMissingNode'
    )
  })

  it('uses last_serialization.type over node.type', () => {
    const node = mockNode(1, 'LiveType')
    node.last_serialization = fromPartial<LGraphNode['last_serialization']>({
      type: 'OriginalType'
    })
    vi.mocked(collectAllNodes).mockReturnValue([node])
    vi.mocked(getExecutionIdByNode).mockReturnValue(null)

    rescanAndSurfaceMissingNodes(mockGraph())

    const store = useMissingNodesErrorStore()
    const error = getMissingNodesError(store)
    const missing = error.nodeTypes[0]
    expect(typeof missing !== 'string' && missing.type).toBe('OriginalType')
  })
})

describe('refreshMissingNodeReplacements', () => {
  it('matches a placeholder without a pack by its saved widgets once replacements load', () => {
    const soleEntry: NodeReplacement = {
      old_node_id: 'StringConstant',
      new_node_id: 'PrimitiveString',
      old_widget_ids: ['string'],
      input_mapping: [{ new_id: 'value', old_id: 'string' }],
      output_mapping: null,
      old_pack: 'comfyui-kjnodes',
      kind: 'equivalent'
    }
    const graph = mockGraph()
    vi.mocked(getNodeByExecutionId).mockImplementation((root, id) =>
      root === graph && id === '1'
        ? mockNode(1, 'StringConstant', {
            last_serialization: {
              type: 'StringConstant',
              widgets_values: ['text']
            }
          })
        : null
    )
    useNodeReplacementStore().replacements = { StringConstant: [soleEntry] }
    const store = useMissingNodesErrorStore()
    store.setMissingNodeTypes([
      { type: 'StringConstant', nodeId: '1', isReplaceable: false }
    ])

    refreshMissingNodeReplacements(graph)

    expect(getMissingNodesError(store).nodeTypes).toEqual([
      {
        type: 'StringConstant',
        nodeId: '1',
        isReplaceable: true,
        replacement: soleEntry
      }
    ])
  })

  it('does not resolve pending warnings against the graph on screen', () => {
    const soleEntry: NodeReplacement = {
      old_node_id: 'StringConstant',
      new_node_id: 'PrimitiveString',
      old_widget_ids: ['string'],
      input_mapping: [{ new_id: 'value', old_id: 'string' }],
      output_mapping: null,
      old_pack: 'comfyui-kjnodes',
      kind: 'equivalent'
    }
    const graph = mockGraph()
    vi.mocked(getNodeByExecutionId).mockImplementation((root, id) =>
      root === graph && id === '1'
        ? mockNode(1, 'StringConstant', {
            last_serialization: {
              type: 'StringConstant',
              widgets_values: ['text']
            }
          })
        : null
    )
    useNodeReplacementStore().replacements = { StringConstant: [soleEntry] }
    const pending: MissingNodeType = {
      type: 'StringConstant',
      nodeId: '1',
      isReplaceable: false
    }
    const workflow = fromPartial<ComfyWorkflow>({
      pendingWarnings: { missingNodeTypes: [pending] }
    })
    Object.assign(useWorkflowStore(), {
      openWorkflows: [workflow],
      activeWorkflow: workflow
    })

    refreshMissingNodeReplacements(graph)

    expect(workflow.pendingWarnings?.missingNodeTypes).toEqual([pending])
  })

  it('keeps a matched replacement while its placeholder is not loaded', () => {
    const soleEntry: NodeReplacement = {
      old_node_id: 'StringConstant',
      new_node_id: 'PrimitiveString',
      old_widget_ids: ['string'],
      input_mapping: [{ new_id: 'value', old_id: 'string' }],
      output_mapping: null,
      old_pack: 'comfyui-kjnodes',
      kind: 'equivalent'
    }
    useNodeReplacementStore().replacements = { StringConstant: [soleEntry] }
    const scanned: MissingNodeType = {
      type: 'StringConstant',
      nodeId: '1',
      isReplaceable: true,
      replacement: soleEntry
    }
    const store = useMissingNodesErrorStore()
    store.setMissingNodeTypes([scanned])

    refreshMissingNodeReplacements(undefined)

    expect(getMissingNodesError(store).nodeTypes).toEqual([scanned])
  })

  it('drops a kept replacement once replacements are disabled', () => {
    const entry: NodeReplacement = {
      old_node_id: 'StringConstant',
      new_node_id: 'PrimitiveString',
      old_widget_ids: ['string'],
      input_mapping: [{ new_id: 'value', old_id: 'string' }],
      output_mapping: null,
      old_pack: 'comfyui-kjnodes',
      kind: 'equivalent'
    }
    vi.mocked(useSettingStore().get).mockImplementation(
      (key: string) => key !== 'Comfy.NodeReplacement.Enabled'
    )
    useNodeReplacementStore().replacements = { StringConstant: [entry] }
    const store = useMissingNodesErrorStore()
    store.setMissingNodeTypes([
      {
        type: 'StringConstant',
        nodeId: '1',
        isReplaceable: true,
        replacement: entry
      }
    ])

    refreshMissingNodeReplacements(undefined)

    expect(getMissingNodesError(store).nodeTypes).toEqual([
      { type: 'StringConstant', nodeId: '1', isReplaceable: false }
    ])
  })
})
