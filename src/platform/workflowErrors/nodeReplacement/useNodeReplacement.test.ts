import { fromPartial, fromAny } from '@total-typescript/shoehorn'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { st, t } from '@/i18n'
import { CustomEventTarget } from '@/lib/litegraph/src/infrastructure/CustomEventTarget'
import type { LGraphEventMap } from '@comfyorg/graph-model/LGraphEventMap'
import {
  canTransferReplacementOwnership,
  transferReplacementOwnership
} from '@/core/graph/nodeShell/nodeShellState'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@comfyorg/graph-model/globalEnums'
import { useLinkStore } from '@/stores/linkStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import {
  toOwningGraphId,
  toRootGraphId
} from '@comfyorg/graph-model/graphScopeId'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { UUID } from '@/utils/uuid'
import type { MissingNodeType, NodeReplacement } from './types'

vi.mock(import('@/lib/litegraph/src/litegraph'), { spy: true })
LiteGraph.createNode = vi.fn()
LiteGraph.registered_node_types = {}

vi.mock(import('@/core/graph/nodeShell/nodeShellState'), () => ({
  canTransferReplacementOwnership: vi.fn(() => true),
  transferReplacementOwnership: vi.fn(
    (node: LGraphNode, replacement: LGraphNode) => {
      replacement.pos = [...node.pos]
      replacement.size = [...node.size]
      return true
    }
  )
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { rootGraph: null },
  sanitizeNodeName: (name: string) => name.replace(/[&<>"'`=]/g, '')
}))

vi.mock(import('@/utils/graphTraversalUtil'), () => ({
  collectAllNodes: vi.fn()
}))

vi.mock(import('@/i18n'))

import { app } from '@/scripts/app'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { collectAllNodes } from '@/utils/graphTraversalUtil'
import { useNodeReplacement } from './useNodeReplacement'

beforeEach(() => {
  vi.mocked(st).mockImplementation((_key, fallback) => fallback)
  vi.mocked(t).mockImplementation((key: unknown, params?: unknown) =>
    params ? `${String(key)}:${JSON.stringify(params)}` : String(key)
  )
  useWorkflowStore().activeWorkflow = fromPartial({
    pendingWarnings: null,
    changeTracker: {
      beforeChange: vi.fn(),
      afterChange: vi.fn()
    }
  })
})

function createMockLink(
  id: number,
  originId: number,
  originSlot: number,
  targetId: number,
  targetSlot: number
) {
  return {
    id,
    origin_id: originId,
    origin_slot: originSlot,
    target_id: targetId,
    target_slot: targetSlot,
    type: 'IMAGE',
    disconnect: vi.fn()
  }
}

const GRAPH_ID: UUID = 'node-replacement-graph'
const GRAPH_SCOPE = {
  rootGraphId: toRootGraphId(GRAPH_ID),
  owningGraphId: toOwningGraphId(GRAPH_ID)
}

function createMockGraph(
  nodes: LGraphNode[],
  links: ReturnType<typeof createMockLink>[] = []
): LGraph {
  const linksMap = new Map(links.map((l) => [l.id, l]))
  const linkStore = useLinkStore()
  for (const l of links) {
    const topology = linkStore.registerLink(GRAPH_SCOPE, {
      id: toLinkId(l.id),
      graphId: GRAPH_SCOPE.owningGraphId,
      originNodeId: toNodeId(l.origin_id),
      originSlot: l.origin_slot,
      targetNodeId: toNodeId(l.target_id),
      targetSlot: l.target_slot,
      type: l.type
    })
    if (!topology) throw new Error('expected registered link')
    Object.defineProperties(l, {
      origin_id: { get: () => topology.originNodeId },
      origin_slot: { get: () => topology.originSlot },
      target_id: { get: () => topology.targetNodeId },
      target_slot: { get: () => topology.targetSlot }
    })
    l.disconnect.mockImplementation(() => {
      linksMap.delete(l.id)
    })
  }
  return fromAny<LGraph, unknown>({
    _nodes: nodes,
    _nodes_by_id: Object.fromEntries(nodes.map((n) => [n.id, n])),
    links: linksMap,
    getLink: (id: number) => linksMap.get(id),
    getNodeById: (id: number | string) =>
      nodes.find((node) => String(node.id) === String(id)),
    removeLink: (id: number) => {
      const topology = [...linkStore.graphTopologies(GRAPH_SCOPE)].find(
        (link) => link.id === id
      )
      if (topology) linkStore.deleteLink(GRAPH_SCOPE, topology)
      linksMap.delete(id)
    },
    id: GRAPH_ID,
    rootGraph: { id: GRAPH_ID },
    events: new CustomEventTarget<LGraphEventMap>(),
    incrementVersion: vi.fn(),
    updateExecutionOrder: vi.fn(),
    setDirtyCanvas: vi.fn()
  })
}

function createPlaceholderNode(
  id: number,
  type: string,
  inputs: { name: string; link: number | null }[] = [],
  outputs: { name: string; links: number[] | null }[] = [],
  graph?: LGraph
): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id,
    type,
    pos: [100, 200],
    size: [200, 100],
    order: 0,
    mode: 0,
    flags: {},
    has_errors: true,
    last_serialization: {
      id,
      type,
      pos: [100, 200],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      inputs: inputs.map((i) => ({ ...i, type: 'IMAGE' })),
      outputs: outputs.map((o) => ({ ...o, type: 'IMAGE' })),
      widgets_values: []
    },
    inputs: inputs.map((i) => ({ ...i, type: 'IMAGE' })),
    outputs: outputs.map((o) => ({ ...o, type: 'IMAGE' })),
    graph: graph ?? null,
    serialize: vi.fn(() => ({
      id,
      type,
      pos: [100, 200],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      inputs: inputs.map((i) => ({ ...i, type: 'IMAGE' })),
      outputs: outputs.map((o) => ({ ...o, type: 'IMAGE' })),
      widgets_values: []
    }))
  })
}

function createNewNode(
  inputs: { name: string; link: number | null }[] = [],
  outputs: { name: string; links: number[] | null }[] = [],
  widgets: { name: string; value: unknown }[] = []
): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id: 0,
    type: '',
    pos: [0, 0],
    size: [100, 50],
    order: 0,
    mode: 0,
    flags: {},
    has_errors: false,
    inputs: inputs.map((i) => ({ ...i, type: 'IMAGE' })),
    outputs: outputs.map((o) => ({ ...o, type: 'IMAGE' })),
    widgets: widgets.map((w) => ({ ...w, type: 'combo', options: {} })),
    configure: vi.fn(),
    serialize: vi.fn()
  })
}

function makeMissingNodeType(
  type: string,
  replacement: NodeReplacement
): MissingNodeType {
  return {
    type,
    isReplaceable: true,
    replacement
  }
}

function getActiveWorkflowMock() {
  const activeWorkflow = useWorkflowStore().activeWorkflow
  if (!activeWorkflow) throw new Error('Expected an active workflow')
  return activeWorkflow
}

function seedMissingNodeTypes(types: MissingNodeType[]): void {
  getActiveWorkflowMock().pendingWarnings = { missingNodeTypes: types }
  useMissingNodesErrorStore().setMissingNodeTypes(types)
}

describe('useNodeReplacement', () => {
  describe('replaceNodesInPlace', () => {
    it('should return empty array when no placeholders exist', () => {
      const graph = createMockGraph([])
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([])

      const { replaceNodesInPlace } = useNodeReplacement()
      const result = replaceNodesInPlace([])

      expect(result).toEqual([])
    })

    it('should use default mapping when no explicit mapping exists', () => {
      const placeholder = createPlaceholderNode(1, 'Load3DAnimation')
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode()
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const { replaceNodesInPlace } = useNodeReplacement()
      const result = replaceNodesInPlace([
        makeMissingNodeType('Load3DAnimation', {
          new_node_id: 'Load3D',
          old_node_id: 'Load3DAnimation',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      expect(result).toEqual(['Load3DAnimation'])
      expect(newNode.configure).not.toHaveBeenCalled()
      expect(newNode.id).toBe(1)
      expect(newNode.has_errors).toBe(false)
    })

    it('preserves saved customizations alongside replacement defaults', () => {
      const placeholder = createPlaceholderNode(1, 'OldNode')
      assert.exists(placeholder.last_serialization)
      placeholder.last_serialization.properties = {
        precision: 'fp16',
        'Node name for S&R': 'OldNode'
      }
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      const newNode = createNewNode()
      newNode.properties = {
        precision: 'fp32',
        device: 'auto',
        'Node name for S&R': 'Replacement'
      }
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const result = useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldNode', {
          old_node_id: 'OldNode',
          new_node_id: 'Replacement',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      expect(result).toEqual(['OldNode'])
      expect(newNode.properties).toEqual({
        precision: 'fp16',
        device: 'auto',
        'Node name for S&R': 'Replacement'
      })
    })

    it('clears stale node-owned records before binding the replacement', () => {
      const placeholder = createPlaceholderNode(1, 'MissingNode')
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      vi.mocked(LiteGraph.createNode).mockReturnValue(createNewNode())
      const id = widgetId(GRAPH_ID, toNodeId(1), 'stale')
      useWidgetValueStore().registerWidget(id, {
        type: 'number',
        value: 1,
        options: {}
      })
      usePreviewExposureStore().addExposure(GRAPH_ID, '1', {
        sourceNodeId: '2',
        sourcePreviewName: 'preview'
      })

      useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('MissingNode', {
          new_node_id: 'Replacement',
          old_node_id: 'MissingNode',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      expect(useWidgetValueStore().getWidget(id)).toBeUndefined()
      expect(usePreviewExposureStore().getExposures(GRAPH_ID, '1')).toEqual([])
    })

    it('should transfer input connections using input_mapping', () => {
      const link = createMockLink(10, 5, 0, 1, 0)
      const placeholder = createPlaceholderNode(
        1,
        'T2IAdapterLoader',
        [{ name: 't2i_adapter_name', link: 10 }],
        []
      )
      const graph = createMockGraph([placeholder], [link])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode(
        [{ name: 'control_net_name', link: null }],
        []
      )
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const { replaceNodesInPlace } = useNodeReplacement()
      const result = replaceNodesInPlace([
        makeMissingNodeType('T2IAdapterLoader', {
          new_node_id: 'ControlNetLoader',
          old_node_id: 'T2IAdapterLoader',
          old_widget_ids: null,
          input_mapping: [
            { new_id: 'control_net_name', old_id: 't2i_adapter_name' }
          ],
          output_mapping: null
        })
      ])

      expect(result).toEqual(['T2IAdapterLoader'])
      // Link should be updated to point at new node's input
      expect(link.target_id).toBe(toNodeId(1))
      expect(link.target_slot).toBe(0)
    })

    it('should transfer output connections using output_mapping', () => {
      const link = createMockLink(20, 1, 0, 5, 0)
      const placeholder = createPlaceholderNode(
        1,
        'ResizeImagesByLongerEdge',
        [],
        [{ name: 'IMAGE', links: [20] }]
      )
      const graph = createMockGraph([placeholder], [link])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode(
        [{ name: 'image', link: null }],
        [{ name: 'IMAGE', links: null }]
      )
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const { replaceNodesInPlace } = useNodeReplacement()
      replaceNodesInPlace([
        makeMissingNodeType('ResizeImagesByLongerEdge', {
          new_node_id: 'ImageScaleToMaxDimension',
          old_node_id: 'ResizeImagesByLongerEdge',
          old_widget_ids: ['longer_edge'],
          input_mapping: [
            { new_id: 'image', old_id: 'images' },
            { new_id: 'largest_size', old_id: 'longer_edge' },
            { new_id: 'upscale_method', set_value: 'lanczos' }
          ],
          output_mapping: [{ new_idx: 0, old_idx: 0 }]
        })
      ])

      // Output link should be remapped
      expect(link.origin_id).toBe(toNodeId(1))
      expect(link.origin_slot).toBe(0)
    })

    it('removes unmapped links without removing mapped links', () => {
      const mapped = createMockLink(20, 1, 0, 5, 0)
      const unmapped = createMockLink(21, 1, 1, 6, 0)
      const placeholder = createPlaceholderNode(
        1,
        'OldNode',
        [],
        [
          { name: 'kept', links: [20] },
          { name: 'removed', links: [21] }
        ]
      )
      const graph = createMockGraph([placeholder], [mapped, unmapped])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      vi.mocked(LiteGraph.createNode).mockReturnValue(
        createNewNode([], [{ name: 'kept', links: null }])
      )

      useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldNode', {
          new_node_id: 'NewNode',
          old_node_id: 'OldNode',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: [{ new_idx: 0, old_idx: 0 }]
        })
      ])

      expect(graph.links.has(toLinkId(20))).toBe(true)
      expect(graph.links.has(toLinkId(21))).toBe(false)
      expect(
        [...useLinkStore().graphTopologies(GRAPH_SCOPE)].map((link) => link.id)
      ).toEqual([toLinkId(20)])
    })

    it('preserves output links when only input mappings are provided', () => {
      const incoming = createMockLink(20, 5, 0, 1, 0)
      const outgoing = createMockLink(21, 1, 0, 6, 0)
      const placeholder = createPlaceholderNode(
        1,
        'OldNode',
        [{ name: 'in', link: 20 }],
        [{ name: 'out', links: [21] }]
      )
      const graph = createMockGraph([placeholder], [incoming, outgoing])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      vi.mocked(LiteGraph.createNode).mockReturnValue(
        createNewNode(
          [{ name: 'in', link: null }],
          [{ name: 'out', links: null }]
        )
      )

      useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldNode', {
          new_node_id: 'NewNode',
          old_node_id: 'OldNode',
          old_widget_ids: null,
          input_mapping: [{ old_id: 'in', new_id: 'in' }],
          output_mapping: null
        })
      ])

      expect(graph.links.has(toLinkId(20))).toBe(true)
      expect(graph.links.has(toLinkId(21))).toBe(true)
    })

    it('preserves input links when only output mappings are provided', () => {
      const incoming = createMockLink(20, 5, 0, 1, 0)
      const outgoing = createMockLink(21, 1, 0, 6, 0)
      const placeholder = createPlaceholderNode(
        1,
        'OldNode',
        [{ name: 'in', link: 20 }],
        [{ name: 'out', links: [21] }]
      )
      const graph = createMockGraph([placeholder], [incoming, outgoing])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      vi.mocked(LiteGraph.createNode).mockReturnValue(
        createNewNode(
          [{ name: 'in', link: null }],
          [{ name: 'out', links: null }]
        )
      )

      useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldNode', {
          new_node_id: 'NewNode',
          old_node_id: 'OldNode',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: [{ old_idx: 0, new_idx: 0 }]
        })
      ])

      expect(graph.links.has(toLinkId(20))).toBe(true)
      expect(graph.links.has(toLinkId(21))).toBe(true)
    })

    it('bails out when an untouched side cannot preserve a link', () => {
      const outgoing = createMockLink(21, 1, 0, 6, 0)
      const placeholder = createPlaceholderNode(
        1,
        'OldNode',
        [{ name: 'in', link: null }],
        [{ name: 'out', links: [21] }]
      )
      const graph = createMockGraph([placeholder], [outgoing])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      vi.mocked(LiteGraph.createNode).mockReturnValue(
        createNewNode([{ name: 'in', link: null }])
      )

      const result = useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldNode', {
          new_node_id: 'NewNode',
          old_node_id: 'OldNode',
          old_widget_ids: null,
          input_mapping: [{ old_id: 'in', new_id: 'in' }],
          output_mapping: null
        })
      ])

      expect(result).toEqual([])
      expect(graph._nodes[0]).toBe(placeholder)
      expect(graph.links.has(toLinkId(21))).toBe(true)
    })

    it('runs canonical disconnect lifecycle after committing removals', () => {
      const link = createMockLink(21, 1, 0, 6, 0)
      const placeholder = createPlaceholderNode(
        1,
        'OldNode',
        [],
        [{ name: 'removed', links: [21] }]
      )
      const peer = createPlaceholderNode(6, 'Peer', [{ name: 'in', link: 21 }])
      placeholder.onConnectionsChange = vi.fn()
      peer.onConnectionsChange = vi.fn()
      const graph = createMockGraph([placeholder, peer], [link])
      placeholder.graph = graph
      peer.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      vi.mocked(LiteGraph.createNode).mockReturnValue(createNewNode())

      useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldNode', {
          new_node_id: 'NewNode',
          old_node_id: 'OldNode',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: []
        })
      ])

      expect(graph.links.has(toLinkId(21))).toBe(false)
      expect(peer.onConnectionsChange).toHaveBeenCalledWith(
        NodeSlotType.INPUT,
        0,
        false,
        link,
        peer.inputs[0]
      )
      expect(placeholder.onConnectionsChange).toHaveBeenCalledWith(
        NodeSlotType.OUTPUT,
        0,
        false,
        link,
        placeholder.outputs[0]
      )
      expect(graph.incrementVersion).toHaveBeenCalledOnce()
    })

    it('bails out before lifecycle when endpoint validation rejects', () => {
      const link = createMockLink(21, 1, 0, 6, 0)
      const placeholder = createPlaceholderNode(
        1,
        'OldNode',
        [],
        [{ name: 'removed', links: [21] }]
      )
      placeholder.onRemoved = vi.fn()
      const graph = createMockGraph([placeholder], [link])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      const newNode = createNewNode([], [], [{ name: 'value', value: 0 }])
      const callback = vi.fn()
      newNode.widgets![0].callback = callback
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)
      vi.spyOn(useLinkStore(), 'validateEndpointUpdates').mockReturnValue({
        code: 'duplicate-target',
        message: 'forced'
      })

      const result = useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldNode', {
          new_node_id: 'NewNode',
          old_node_id: 'OldNode',
          old_widget_ids: null,
          input_mapping: [{ new_id: 'value', set_value: 1 }],
          output_mapping: []
        })
      ])

      expect(result).toEqual([])
      expect(graph._nodes[0]).toBe(placeholder)
      expect(graph.links.has(toLinkId(21))).toBe(true)
      expect(placeholder.onRemoved).not.toHaveBeenCalled()
      expect(callback).not.toHaveBeenCalled()
    })

    it('keeps a committed replacement when removal notification fails', () => {
      const link = createMockLink(21, 1, 0, 6, 0)
      const placeholder = createPlaceholderNode(
        1,
        'OldNode',
        [],
        [{ name: 'removed', links: [21] }]
      )
      placeholder.onRemoved = vi.fn(() => {
        throw new Error('removal failed')
      })
      const graph = createMockGraph([placeholder], [link])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      const newNode = createNewNode([], [{ name: 'removed', links: null }])
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)
      const staleWidgetId = widgetId(GRAPH_ID, toNodeId(1), 'stale')
      useWidgetValueStore().registerWidget(staleWidgetId, {
        type: 'number',
        value: 1,
        options: {}
      })

      const result = useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldNode', {
          new_node_id: 'NewNode',
          old_node_id: 'OldNode',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      expect(result).toEqual(['OldNode'])
      expect(graph._nodes[0]).toBe(newNode)
      expect(graph.links.has(toLinkId(21))).toBe(true)
      expect(useWidgetValueStore().getWidget(staleWidgetId)).toBeUndefined()
    })

    it('should apply set_value to widget', () => {
      const placeholder = createPlaceholderNode(1, 'ImageScaleBy')
      placeholder.onRemoved = vi.fn()
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode(
        [{ name: 'input', link: null }],
        [],
        [
          { name: 'resize_type', value: '' },
          { name: 'scale_method', value: '' }
        ]
      )
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const { replaceNodesInPlace } = useNodeReplacement()
      replaceNodesInPlace([
        makeMissingNodeType('ImageScaleBy', {
          new_node_id: 'ResizeImageMaskNode',
          old_node_id: 'ImageScaleBy',
          old_widget_ids: ['upscale_method', 'scale_by'],
          input_mapping: [
            { new_id: 'input', old_id: 'image' },
            { new_id: 'resize_type', set_value: 'scale by multiplier' },
            { new_id: 'resize_type.multiplier', old_id: 'scale_by' },
            { new_id: 'scale_method', old_id: 'upscale_method' }
          ],
          output_mapping: null
        })
      ])

      // set_value should be applied to the widget
      expect(newNode.widgets![0].value).toBe('scale by multiplier')
      expect(
        placeholder.onRemoved,
        'call onRemoved on old node'
      ).toHaveBeenCalledTimes(1)
    })

    it('assigns a dynamic child value mapped before the value that creates it', () => {
      const placeholder = createPlaceholderNode(1, 'OldScaler')
      placeholder.last_serialization!.widgets_values = [1.5, 'multiplier']
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode(
        [],
        [],
        [{ name: 'resize_type', value: '' }]
      )
      const resizeType = newNode.widgets![0]
      let resizeTypeValue: unknown = ''
      Object.defineProperty(resizeType, 'value', {
        get: () => resizeTypeValue,
        set(value) {
          resizeTypeValue = value
          newNode.widgets!.splice(1, Infinity, {
            ...resizeType,
            name: 'resize_type.multiplier',
            value: 1
          })
        }
      })
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldScaler', {
          new_node_id: 'NewScaler',
          old_node_id: 'OldScaler',
          old_widget_ids: ['scale_by', 'mode'],
          input_mapping: [
            { new_id: 'resize_type.multiplier', old_id: 'scale_by' },
            { new_id: 'resize_type', old_id: 'mode' }
          ],
          output_mapping: null
        })
      ])

      expect(
        graph.getNodeById(toNodeId(1))!.widgets!.map((widget) => widget.value)
      ).toEqual(['multiplier', 1.5])
    })

    it('carries a widget value from an installed deprecated node, which has no last_serialization', () => {
      const installedNode = createPlaceholderNode(1, 'OldScaler')
      installedNode.last_serialization = fromAny<
        LGraphNode['last_serialization'],
        unknown
      >(undefined)
      vi.mocked(installedNode.serialize).mockReturnValue({
        ...installedNode.serialize(),
        widgets_values: [1.5]
      })
      const graph = createMockGraph([installedNode])
      installedNode.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([installedNode])

      const newNode = createNewNode([], [], [{ name: 'scale', value: 1 }])
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldScaler', {
          new_node_id: 'NewScaler',
          old_node_id: 'OldScaler',
          old_widget_ids: ['scale_by'],
          input_mapping: [{ new_id: 'scale', old_id: 'scale_by' }],
          output_mapping: null
        })
      ])

      expect(graph._nodes[0].widgets?.map((widget) => widget.value)).toEqual([
        1.5
      ])
    })

    it('lets the later mapping win when two mappings target one widget', () => {
      const placeholder = createPlaceholderNode(1, 'OldScaler')
      placeholder.last_serialization!.widgets_values = ['saved']
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode([], [], [{ name: 'mode', value: '' }])
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldScaler', {
          new_node_id: 'NewScaler',
          old_node_id: 'OldScaler',
          old_widget_ids: ['mode'],
          input_mapping: [
            { new_id: 'mode', old_id: 'mode' },
            { new_id: 'mode', set_value: 'forced' }
          ],
          output_mapping: null
        })
      ])

      expect(graph.getNodeById(toNodeId(1))!.widgets![0].value).toBe('forced')
    })

    it('keeps a restored value that an earlier widget callback resets', () => {
      const placeholder = createPlaceholderNode(1, 'OldSampler')
      placeholder.last_serialization!.widgets_values = ['portrait', 7]
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode(
        [],
        [],
        [
          { name: 'preset', value: '' },
          { name: 'steps', value: 0 }
        ]
      )
      newNode.widgets![0].callback = () => {
        newNode.widgets![1].value = 20
      }
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldSampler', {
          new_node_id: 'NewSampler',
          old_node_id: 'OldSampler',
          old_widget_ids: ['preset', 'steps'],
          input_mapping: [
            { new_id: 'preset', old_id: 'preset' },
            { new_id: 'steps', old_id: 'steps' }
          ],
          output_mapping: null
        })
      ])

      expect(
        graph.getNodeById(toNodeId(1))!.widgets!.map((widget) => widget.value)
      ).toEqual(['portrait', 7])
    })

    it('replaces a node reached through two instances of one subgraph once', () => {
      const placeholder = createPlaceholderNode(1, 'OldType')
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([placeholder, placeholder])
      vi.mocked(LiteGraph.createNode).mockReturnValue(createNewNode())

      const result = useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldType', {
          new_node_id: 'NewType',
          old_node_id: 'OldType',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      expect(result).toEqual(['OldType'])
      expect(useToast().error).not.toHaveBeenCalled()
    })

    it('should transfer widget values using old_widget_ids', () => {
      const placeholder = createPlaceholderNode(1, 'ResizeImagesByLongerEdge')
      // Set widget values in serialized data
      placeholder.last_serialization!.widgets_values = [512]

      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode(
        [
          { name: 'image', link: null },
          { name: 'largest_size', link: null }
        ],
        [{ name: 'IMAGE', links: null }],
        [
          { name: 'largest_size', value: 0 },
          { name: 'face_point_size', value: 1 }
        ]
      )
      const setNodeId = vi.fn()
      Object.assign(newNode.widgets![1], { setNodeId })
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const { replaceNodesInPlace } = useNodeReplacement()
      replaceNodesInPlace([
        makeMissingNodeType('ResizeImagesByLongerEdge', {
          new_node_id: 'ImageScaleToMaxDimension',
          old_node_id: 'ResizeImagesByLongerEdge',
          old_widget_ids: ['longer_edge'],
          input_mapping: [
            { new_id: 'image', old_id: 'images' },
            { new_id: 'largest_size', old_id: 'longer_edge' },
            { new_id: 'upscale_method', set_value: 'lanczos' }
          ],
          output_mapping: [{ new_idx: 0, old_idx: 0 }]
        })
      ])

      expect(newNode.widgets![0].value).toBe(512)
      expect(setNodeId).toHaveBeenCalledWith(1)
    })

    it('should skip replacement when new node type is not registered', () => {
      const placeholder = createPlaceholderNode(1, 'UnknownNode')
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      vi.mocked(LiteGraph.createNode).mockReturnValue(null)

      const { replaceNodesInPlace } = useNodeReplacement()
      const result = replaceNodesInPlace([
        makeMissingNodeType('UnknownNode', {
          new_node_id: 'NonExistentNode',
          old_node_id: 'UnknownNode',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      expect(result).toEqual([])
    })

    it.for([
      ['preflight', false, true],
      ['transfer', true, false]
    ] as const)(
      'reports an ownership %s refusal',
      ([_stage, canTransfer, didTransfer]) => {
        const placeholder = createPlaceholderNode(1, 'OldNode')
        placeholder.onRemoved = vi.fn()
        const graph = createMockGraph([placeholder])
        placeholder.graph = graph
        Object.assign(app, { rootGraph: graph })
        vi.mocked(collectAllNodes).mockReturnValue([placeholder])
        vi.mocked(LiteGraph.createNode).mockReturnValue(createNewNode())
        vi.mocked(canTransferReplacementOwnership).mockReturnValue(canTransfer)
        vi.mocked(transferReplacementOwnership).mockReturnValue(didTransfer)

        const result = useNodeReplacement().replaceNodesInPlace([
          makeMissingNodeType('OldNode', {
            new_node_id: 'NewNode',
            old_node_id: 'OldNode',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          })
        ])

        expect(result).toEqual([])
        expect(graph._nodes[0]).toBe(placeholder)
        expect(placeholder.onRemoved).not.toHaveBeenCalled()
        expect(useToast().error).toHaveBeenCalled()
      }
    )

    it('should replace multiple different node types at once', () => {
      const placeholder1 = createPlaceholderNode(1, 'Load3DAnimation')
      const placeholder2 = createPlaceholderNode(
        2,
        'ConditioningAverage',
        [],
        []
      )

      const graph = createMockGraph([placeholder1, placeholder2])
      placeholder1.graph = graph
      placeholder2.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder1, placeholder2])

      const newNode1 = createNewNode()
      const newNode2 = createNewNode()
      vi.mocked(LiteGraph.createNode)
        .mockReturnValueOnce(newNode1)
        .mockReturnValueOnce(newNode2)

      const { replaceNodesInPlace } = useNodeReplacement()
      const result = replaceNodesInPlace([
        makeMissingNodeType('Load3DAnimation', {
          new_node_id: 'Load3D',
          old_node_id: 'Load3DAnimation',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        }),
        makeMissingNodeType('ConditioningAverage&', {
          new_node_id: 'ConditioningAverage',
          old_node_id: 'ConditioningAverage&',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      expect(result).toHaveLength(2)
      expect(result).toContain('Load3DAnimation')
      expect(result).toContain('ConditioningAverage&')
    })

    it('should copy position and identity for mapped replacements', () => {
      const link = createMockLink(10, 5, 0, 1, 0)
      const placeholder = createPlaceholderNode(
        42,
        'T2IAdapterLoader',
        [{ name: 't2i_adapter_name', link: 10 }],
        []
      )
      placeholder.pos = [300, 400]
      placeholder.size = [250, 150]
      placeholder.onRemoved = vi.fn()

      const graph = createMockGraph([placeholder], [link])
      placeholder.graph = graph
      placeholder.order = 6
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode(
        [{ name: 'control_net_name', link: null }],
        []
      )
      const replacementGeometryBeforeTransfer: Array<{
        pos: LGraphNode['pos']
        size: LGraphNode['size']
      }> = []
      vi.mocked(transferReplacementOwnership).mockImplementationOnce(
        (node, replacement) => {
          replacementGeometryBeforeTransfer.push({
            pos: [...replacement.pos],
            size: [...replacement.size]
          })
          replacement.pos = [...node.pos]
          replacement.size = [...node.size]
          return true
        }
      )
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const { replaceNodesInPlace } = useNodeReplacement()
      replaceNodesInPlace([
        makeMissingNodeType('T2IAdapterLoader', {
          new_node_id: 'ControlNetLoader',
          old_node_id: 'T2IAdapterLoader',
          old_widget_ids: null,
          input_mapping: [
            { new_id: 'control_net_name', old_id: 't2i_adapter_name' }
          ],
          output_mapping: null
        })
      ])

      expect(newNode.id).toBe(42)
      expect(replacementGeometryBeforeTransfer).toEqual([
        { pos: [0, 0], size: [100, 50] }
      ])
      expect(newNode.pos).toEqual([300, 400])
      expect(newNode.size).toEqual([250, 150])
      expect(newNode.order).toBe(6)
      expect(placeholder.order).toBe(6)
      expect(graph._nodes[0]).toBe(newNode)
      expect(placeholder.onRemoved).toHaveBeenCalledOnce()
    })

    it('should transfer all widget values for ImageScaleBy with real workflow data', () => {
      const placeholder = createPlaceholderNode(
        12,
        'ImageScaleBy',
        [{ name: 'image', link: 2 }],
        [{ name: 'IMAGE', links: [3, 4] }]
      )
      // Real workflow data: widgets_values: ["lanczos", 2.0]
      placeholder.last_serialization!.widgets_values = ['lanczos', 2.0]

      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode(
        [{ name: 'input', link: null }],
        [],
        [
          { name: 'resize_type', value: '' },
          { name: 'scale_method', value: '' }
        ]
      )
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const { replaceNodesInPlace } = useNodeReplacement()
      replaceNodesInPlace([
        makeMissingNodeType('ImageScaleBy', {
          new_node_id: 'ResizeImageMaskNode',
          old_node_id: 'ImageScaleBy',
          old_widget_ids: ['upscale_method', 'scale_by'],
          input_mapping: [
            { new_id: 'input', old_id: 'image' },
            { new_id: 'resize_type', set_value: 'scale by multiplier' },
            { new_id: 'resize_type.multiplier', old_id: 'scale_by' },
            { new_id: 'scale_method', old_id: 'upscale_method' }
          ],
          output_mapping: null
        })
      ])

      // set_value should be applied
      expect(newNode.widgets![0].value).toBe('scale by multiplier')
      // upscale_method (idx 0, value "lanczos") → scale_method widget
      expect(newNode.widgets![1].value).toBe('lanczos')
    })

    it('should transfer widget value for ResizeImagesByLongerEdge with real workflow data', () => {
      const link = createMockLink(1, 5, 0, 8, 0)
      const placeholder = createPlaceholderNode(
        8,
        'ResizeImagesByLongerEdge',
        [{ name: 'images', link: 1 }],
        [{ name: 'IMAGE', links: [2] }]
      )
      // Real workflow data: widgets_values: [1024]
      placeholder.last_serialization!.widgets_values = [1024]

      const graph = createMockGraph([placeholder], [link])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode(
        [
          { name: 'image', link: null },
          { name: 'largest_size', link: null }
        ],
        [{ name: 'IMAGE', links: null }],
        [
          { name: 'largest_size', value: 0 },
          { name: 'upscale_method', value: '' }
        ]
      )
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const { replaceNodesInPlace } = useNodeReplacement()
      replaceNodesInPlace([
        makeMissingNodeType('ResizeImagesByLongerEdge', {
          new_node_id: 'ImageScaleToMaxDimension',
          old_node_id: 'ResizeImagesByLongerEdge',
          old_widget_ids: ['longer_edge'],
          input_mapping: [
            { new_id: 'image', old_id: 'images' },
            { new_id: 'largest_size', old_id: 'longer_edge' },
            { new_id: 'upscale_method', set_value: 'lanczos' }
          ],
          output_mapping: [{ new_idx: 0, old_idx: 0 }]
        })
      ])

      // longer_edge (idx 0, value 1024) → largest_size widget
      expect(newNode.widgets![0].value).toBe(1024)
      // set_value "lanczos" → upscale_method widget
      expect(newNode.widgets![1].value).toBe('lanczos')
    })

    it('should transfer ConditioningAverage widget value with real workflow data', () => {
      const link = createMockLink(4, 7, 0, 13, 0)
      const outLink = createMockLink(6, 13, 0, 20, 0)
      // sanitizeNodeName doesn't strip spaces, so placeholder keeps trailing space
      const placeholder = createPlaceholderNode(
        13,
        'ConditioningAverage ',
        [
          { name: 'conditioning_to', link: 4 },
          { name: 'conditioning_from', link: null }
        ],
        [{ name: 'CONDITIONING', links: [6] }]
      )
      placeholder.last_serialization!.widgets_values = [0.75]

      const graph = createMockGraph([placeholder], [link, outLink])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode(
        [
          { name: 'conditioning_to', link: null },
          { name: 'conditioning_from', link: null }
        ],
        [{ name: 'CONDITIONING', links: null }],
        [{ name: 'conditioning_average', value: 0 }]
      )
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const { replaceNodesInPlace } = useNodeReplacement()
      replaceNodesInPlace([
        makeMissingNodeType('ConditioningAverage ', {
          new_node_id: 'ConditioningAverage',
          old_node_id: 'ConditioningAverage ',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      // Default mapping transfers connections and widget values by name
      expect(newNode.id).toBe(13)
      expect(link.target_id).toBe(toNodeId(13))
      expect(link.target_slot).toBe(0)
      expect(outLink.origin_id).toBe(toNodeId(13))
      expect(outLink.origin_slot).toBe(0)
      expect(newNode.widgets![0].value).toBe(0.75)
    })

    it('moves input links onto dotted dynamic input names', () => {
      const firstLink = createMockLink(30, 5, 0, 1, 0)
      const secondLink = createMockLink(31, 6, 0, 1, 1)
      const placeholder = createPlaceholderNode(1, 'ImageBatch', [
        { name: 'image1', link: 30 },
        { name: 'image2', link: 31 }
      ])
      const graph = createMockGraph([placeholder], [firstLink, secondLink])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode([
        { name: 'images.image1', link: null },
        { name: 'images.image0', link: null }
      ])
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const result = useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('ImageBatch', {
          new_node_id: 'BatchImagesNode',
          old_node_id: 'ImageBatch',
          old_widget_ids: null,
          input_mapping: [
            { new_id: 'images.image0', old_id: 'image1' },
            { new_id: 'images.image1', old_id: 'image2' }
          ],
          output_mapping: null
        })
      ])

      expect(result).toEqual(['ImageBatch'])
      expect(graph.links.has(toLinkId(30))).toBe(true)
      expect(graph.links.has(toLinkId(31))).toBe(true)
      expect(firstLink.target_slot).toBe(1)
      expect(secondLink.target_slot).toBe(0)
    })
  })

  describe('placeholder detection predicate', () => {
    /**
     * replaceNodesInPlace calls collectAllNodes with a predicate.
     * These tests capture the predicate by inspecting the mock call
     * and verify it matches only nodes whose serialized type is in
     * the targetTypes set — regardless of has_errors or registered_node_types.
     */

    function capturedPredicate(): (n: LGraphNode) => boolean {
      const calls = vi.mocked(collectAllNodes).mock.calls
      expect(calls.length).toBeGreaterThan(0)
      return calls[calls.length - 1][1] as (n: LGraphNode) => boolean
    }

    it('should detect placeholder when type is in targetTypes even if has_errors is false', () => {
      const placeholder = createPlaceholderNode(1, 'OldNode')
      placeholder.has_errors = false
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([])

      const { replaceNodesInPlace } = useNodeReplacement()
      replaceNodesInPlace([
        makeMissingNodeType('OldNode', {
          new_node_id: 'NewNode',
          old_node_id: 'OldNode',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      const predicate = capturedPredicate()
      expect(predicate(placeholder)).toBe(true)
    })

    it('should detect placeholder when type is in targetTypes even if type is registered', () => {
      // Simulate the pack being reinstalled — type is now registered
      ;(LiteGraph.registered_node_types as Record<string, unknown>)['OldNode'] =
        {}

      const placeholder = createPlaceholderNode(1, 'OldNode')
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([])

      const { replaceNodesInPlace } = useNodeReplacement()
      replaceNodesInPlace([
        makeMissingNodeType('OldNode', {
          new_node_id: 'NewNode',
          old_node_id: 'OldNode',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      const predicate = capturedPredicate()
      expect(predicate(placeholder)).toBe(true)

      // Cleanup
      delete (LiteGraph.registered_node_types as Record<string, unknown>)[
        'OldNode'
      ]
    })

    it('should exclude nodes whose type is NOT in targetTypes', () => {
      const unrelatedNode = createPlaceholderNode(1, 'UnrelatedNode')
      const graph = createMockGraph([unrelatedNode])
      unrelatedNode.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([])

      const { replaceNodesInPlace } = useNodeReplacement()
      replaceNodesInPlace([
        makeMissingNodeType('SomeOtherNode', {
          new_node_id: 'NewNode',
          old_node_id: 'SomeOtherNode',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      const predicate = capturedPredicate()
      expect(predicate(unrelatedNode)).toBe(false)
    })

    it('should exclude nodes without last_serialization', () => {
      const freshNode = createPlaceholderNode(1, 'OldNode')
      freshNode.last_serialization = fromAny<
        LGraphNode['last_serialization'],
        unknown
      >(undefined)
      const graph = createMockGraph([freshNode])
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([])

      const { replaceNodesInPlace } = useNodeReplacement()
      replaceNodesInPlace([
        makeMissingNodeType('OldNode', {
          new_node_id: 'NewNode',
          old_node_id: 'OldNode',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      const predicate = capturedPredicate()
      expect(predicate(freshNode)).toBe(false)
    })

    it('detects an installed node without last_serialization when its definition is deprecated', () => {
      const installedNode = createPlaceholderNode(1, 'OldNode')
      installedNode.last_serialization = fromAny<
        LGraphNode['last_serialization'],
        unknown
      >(undefined)
      installedNode.constructor = Object.assign({}, installedNode.constructor, {
        nodeData: { deprecated: true }
      })
      Object.assign(app, { rootGraph: createMockGraph([installedNode]) })
      vi.mocked(collectAllNodes).mockReturnValue([])

      useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldNode', {
          new_node_id: 'NewNode',
          old_node_id: 'OldNode',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      expect(capturedPredicate()(installedNode)).toBe(true)
    })

    it('should fall back to node.type when last_serialization.type is undefined', () => {
      const node = createPlaceholderNode(1, 'FallbackType')
      node.last_serialization!.type = fromAny<string, unknown>(undefined)
      const graph = createMockGraph([node])
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([])

      const { replaceNodesInPlace } = useNodeReplacement()
      replaceNodesInPlace([
        makeMissingNodeType('FallbackType', {
          new_node_id: 'NewNode',
          old_node_id: 'FallbackType',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      const predicate = capturedPredicate()
      expect(predicate(node)).toBe(true)
    })

    it('should match node via sanitized type when last_serialization.type is absent and live type contains HTML special chars', () => {
      // Simulates an old serialization format (no last_serialization.type)
      // where app.ts has already run sanitizeNodeName on n.type,
      // stripping '&' from "OldNode&Special" → "OldNodeSpecial".
      // targetTypes still holds the original unsanitized name "OldNode&Special",
      // so the predicate must fall back to checking sanitizeNodeName(originalType).
      const node = createPlaceholderNode(1, 'OldNodeSpecial')
      node.last_serialization!.type = fromAny<string, unknown>(undefined)
      const graph = createMockGraph([node])
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([])

      const { replaceNodesInPlace } = useNodeReplacement()
      replaceNodesInPlace([
        // targetTypes will contain the original name with '&'
        makeMissingNodeType('OldNode&Special', {
          new_node_id: 'NewNode',
          old_node_id: 'OldNode&Special',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      const predicate = capturedPredicate()
      // Without the sanitize fallback this would return false.
      expect(predicate(node)).toBe(true)
    })
  })

  describe('replaceGroup', () => {
    it('removes replaced types from the cache and rendered state', () => {
      const placeholder = createPlaceholderNode(1, 'OldNode')
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      const newNode = createNewNode()
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const oldNodeType = makeMissingNodeType('OldNode', {
        new_node_id: 'NewNode',
        old_node_id: 'OldNode',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      })
      seedMissingNodeTypes([oldNodeType, 'OtherNode'])

      const { replaceGroup } = useNodeReplacement()
      replaceGroup({
        type: 'OldNode',
        nodeTypes: [oldNodeType]
      })

      expect(
        getActiveWorkflowMock().pendingWarnings?.missingNodeTypes
      ).toStrictEqual(['OtherNode'])
      expect(
        useMissingNodesErrorStore().missingNodesError?.nodeTypes
      ).toStrictEqual(['OtherNode'])
    })

    it('clears the cache and rendered state when the last missing type is replaced', () => {
      const placeholder = createPlaceholderNode(1, 'OldNode')
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      const newNode = createNewNode()
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const oldNodeType = makeMissingNodeType('OldNode', {
        new_node_id: 'NewNode',
        old_node_id: 'OldNode',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      })
      seedMissingNodeTypes([oldNodeType])

      const { replaceGroup } = useNodeReplacement()
      replaceGroup({
        type: 'OldNode',
        nodeTypes: [oldNodeType]
      })

      expect(getActiveWorkflowMock().pendingWarnings).toBeNull()
      expect(useMissingNodesErrorStore().missingNodesError).toBeNull()
    })

    it('keeps missing node state when only some nodes of a type are replaced', () => {
      const firstPlaceholder = createPlaceholderNode(1, 'OldNode')
      const secondPlaceholder = createPlaceholderNode(2, 'OldNode')
      const graph = createMockGraph([firstPlaceholder, secondPlaceholder])
      firstPlaceholder.graph = graph
      secondPlaceholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([
        firstPlaceholder,
        secondPlaceholder
      ])
      const firstReplacement = createNewNode()
      vi.mocked(LiteGraph.createNode)
        .mockReturnValueOnce(firstReplacement)
        .mockReturnValueOnce(createNewNode())
      vi.mocked(canTransferReplacementOwnership)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)

      const oldNodeType = makeMissingNodeType('OldNode', {
        new_node_id: 'NewNode',
        old_node_id: 'OldNode',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      })
      seedMissingNodeTypes([oldNodeType])

      useNodeReplacement().replaceGroup({
        type: 'OldNode',
        nodeTypes: [oldNodeType]
      })

      expect(graph._nodes).toStrictEqual([firstReplacement, secondPlaceholder])
      expect(
        getActiveWorkflowMock().pendingWarnings?.missingNodeTypes
      ).toStrictEqual([oldNodeType])
      expect(
        useMissingNodesErrorStore().missingNodesError?.nodeTypes
      ).toStrictEqual([oldNodeType])
      expect(graph.updateExecutionOrder).toHaveBeenCalledOnce()
      expect(graph.setDirtyCanvas).toHaveBeenCalledWith(true, true)
    })

    it('keeps missing node state when a failed node precedes a successful node', () => {
      const firstPlaceholder = createPlaceholderNode(1, 'OldNode')
      const secondPlaceholder = createPlaceholderNode(2, 'OldNode')
      const graph = createMockGraph([firstPlaceholder, secondPlaceholder])
      firstPlaceholder.graph = graph
      secondPlaceholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([
        firstPlaceholder,
        secondPlaceholder
      ])
      const secondReplacement = createNewNode()
      vi.mocked(LiteGraph.createNode)
        .mockReturnValueOnce(createNewNode())
        .mockReturnValueOnce(secondReplacement)
      vi.mocked(canTransferReplacementOwnership)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)

      const oldNodeType = makeMissingNodeType('OldNode', {
        new_node_id: 'NewNode',
        old_node_id: 'OldNode',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      })
      seedMissingNodeTypes([oldNodeType])

      useNodeReplacement().replaceGroup({
        type: 'OldNode',
        nodeTypes: [oldNodeType]
      })

      expect(graph._nodes).toStrictEqual([firstPlaceholder, secondReplacement])
      expect(
        getActiveWorkflowMock().pendingWarnings?.missingNodeTypes
      ).toStrictEqual([oldNodeType])
      expect(
        useMissingNodesErrorStore().missingNodesError?.nodeTypes
      ).toStrictEqual([oldNodeType])
    })

    it('keeps missing node state when a replacement node cannot be created', () => {
      const firstPlaceholder = createPlaceholderNode(1, 'OldNode')
      const secondPlaceholder = createPlaceholderNode(2, 'OldNode')
      const graph = createMockGraph([firstPlaceholder, secondPlaceholder])
      firstPlaceholder.graph = graph
      secondPlaceholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([
        firstPlaceholder,
        secondPlaceholder
      ])
      const firstReplacement = createNewNode()
      vi.mocked(LiteGraph.createNode)
        .mockReturnValueOnce(firstReplacement)
        .mockReturnValueOnce(null)
      vi.mocked(canTransferReplacementOwnership).mockReturnValue(true)

      const oldNodeType = makeMissingNodeType('OldNode', {
        new_node_id: 'NewNode',
        old_node_id: 'OldNode',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      })
      seedMissingNodeTypes([oldNodeType])

      useNodeReplacement().replaceGroup({
        type: 'OldNode',
        nodeTypes: [oldNodeType]
      })

      expect(graph._nodes).toStrictEqual([firstReplacement, secondPlaceholder])
      expect(
        getActiveWorkflowMock().pendingWarnings?.missingNodeTypes
      ).toStrictEqual([oldNodeType])
      expect(
        useMissingNodesErrorStore().missingNodesError?.nodeTypes
      ).toStrictEqual([oldNodeType])
    })

    it('keeps store-only missing types that never reached the cache', () => {
      const placeholder = createPlaceholderNode(1, 'OldNode')
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      const newNode = createNewNode()
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const oldNodeType = makeMissingNodeType('OldNode', {
        new_node_id: 'NewNode',
        old_node_id: 'OldNode',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      })
      // Surfaced by a rescan (e.g. missing_node_type prompt failure): the
      // rendered store has both types but the workflow cache saw neither.
      useMissingNodesErrorStore().setMissingNodeTypes([
        oldNodeType,
        'RescanOnly'
      ])

      const { replaceGroup } = useNodeReplacement()
      replaceGroup({
        type: 'OldNode',
        nodeTypes: [oldNodeType]
      })

      expect(
        useMissingNodesErrorStore().missingNodesError?.nodeTypes
      ).toStrictEqual(['RescanOnly'])
      expect(getActiveWorkflowMock().pendingWarnings).toBeNull()
    })

    it('keeps missing node state when no nodes are replaced', () => {
      const graph = createMockGraph([])
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([])

      const oldNodeType = makeMissingNodeType('OldNode', {
        new_node_id: 'NewNode',
        old_node_id: 'OldNode',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      })
      seedMissingNodeTypes([oldNodeType])

      const { replaceGroup } = useNodeReplacement()
      replaceGroup({
        type: 'OldNode',
        nodeTypes: [oldNodeType]
      })

      expect(
        getActiveWorkflowMock().pendingWarnings?.missingNodeTypes
      ).toStrictEqual([oldNodeType])
      expect(
        useMissingNodesErrorStore().missingNodesError?.nodeTypes
      ).toStrictEqual([oldNodeType])
    })

    it('removes replaced types from rendered state without an active workflow', () => {
      const placeholder = createPlaceholderNode(1, 'OldNode')
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      const newNode = createNewNode()
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const oldNodeType = makeMissingNodeType('OldNode', {
        new_node_id: 'NewNode',
        old_node_id: 'OldNode',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      })
      useMissingNodesErrorStore().setMissingNodeTypes([
        oldNodeType,
        'OtherNode'
      ])
      useWorkflowStore().activeWorkflow = null

      const { replaceGroup } = useNodeReplacement()
      replaceGroup({
        type: 'OldNode',
        nodeTypes: [oldNodeType]
      })

      expect(
        useMissingNodesErrorStore().missingNodesError?.nodeTypes
      ).toStrictEqual(['OtherNode'])
    })
  })

  describe('replaceAllGroups', () => {
    it('removes every successfully replaced type from both states', () => {
      const p1 = createPlaceholderNode(1, 'TypeA')
      const p2 = createPlaceholderNode(2, 'TypeB')
      const graph = createMockGraph([p1, p2])
      p1.graph = graph
      p2.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([p1, p2])
      vi.mocked(LiteGraph.createNode)
        .mockReturnValueOnce(createNewNode())
        .mockReturnValueOnce(createNewNode())

      const typeA = makeMissingNodeType('TypeA', {
        new_node_id: 'NewA',
        old_node_id: 'TypeA',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      })
      const typeB = makeMissingNodeType('TypeB', {
        new_node_id: 'NewB',
        old_node_id: 'TypeB',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      })
      seedMissingNodeTypes([typeA, typeB, 'OtherNode'])

      const { replaceAllGroups } = useNodeReplacement()
      replaceAllGroups([
        {
          type: 'TypeA',
          nodeTypes: [typeA]
        },
        {
          type: 'TypeB',
          nodeTypes: [typeB]
        }
      ])

      expect(
        getActiveWorkflowMock().pendingWarnings?.missingNodeTypes
      ).toStrictEqual(['OtherNode'])
      expect(
        useMissingNodesErrorStore().missingNodesError?.nodeTypes
      ).toStrictEqual(['OtherNode'])
    })

    it('removes only the types that were actually replaced when some fail', () => {
      const p1 = createPlaceholderNode(1, 'TypeA')
      const graph = createMockGraph([p1])
      p1.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([p1])
      vi.mocked(LiteGraph.createNode).mockReturnValueOnce(createNewNode())

      const typeA = makeMissingNodeType('TypeA', {
        new_node_id: 'NewA',
        old_node_id: 'TypeA',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      })
      const typeB = makeMissingNodeType('TypeB', {
        new_node_id: 'NewB',
        old_node_id: 'TypeB',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      })
      seedMissingNodeTypes([typeA, typeB])

      const { replaceAllGroups } = useNodeReplacement()
      replaceAllGroups([
        {
          type: 'TypeA',
          nodeTypes: [typeA]
        },
        {
          type: 'TypeB',
          nodeTypes: [typeB]
        }
      ])

      expect(
        getActiveWorkflowMock().pendingWarnings?.missingNodeTypes
      ).toStrictEqual([typeB])
      expect(
        useMissingNodesErrorStore().missingNodesError?.nodeTypes
      ).toStrictEqual([typeB])
    })
  })

  describe('transfer edge cases', () => {
    it('skips input transfer when the old node has no matching input slot', () => {
      const placeholder = createPlaceholderNode(1, 'OldType', [
        { name: 'present_input', link: null }
      ])
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode([{ name: 'new_input', link: null }], [])
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const { replaceNodesInPlace } = useNodeReplacement()
      const result = replaceNodesInPlace([
        makeMissingNodeType('OldType', {
          new_node_id: 'NewType',
          old_node_id: 'OldType',
          old_widget_ids: null,
          // old_id refers to an input that does not exist on the placeholder.
          input_mapping: [
            { new_id: 'new_input', old_id: 'missing_input_name' }
          ],
          output_mapping: null
        })
      ])

      // Replacement still completes; the missing-old-slot transfer is a no-op.
      expect(result).toEqual(['OldType'])
      expect(newNode.inputs[0].link).toBeNull()
    })

    it('does not throw when output_mapping references a new output index that does not exist', () => {
      // NOTE: The current source skips transfer silently in this case, leaving
      // the link's origin_slot pointing at a now-missing slot on the new node.
      // That dangling state is a separate source-level concern; this test only
      // pins that the missing-slot branch does not crash the replacement loop.
      // Do not extend this test to assert specific link state on the dangling
      // path — codifying that as "correct" would block fixing the underlying
      // cleanup gap in transferOutputConnections.
      const link = createMockLink(20, 1, 0, 5, 0)
      const placeholder = createPlaceholderNode(
        1,
        'OldType',
        [],
        [{ name: 'IMAGE', links: [20] }]
      )
      const graph = createMockGraph([placeholder], [link])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      // newNode has NO outputs; output_mapping points at index 0 which does not exist.
      const newNode = createNewNode([], [])
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const { replaceNodesInPlace } = useNodeReplacement()
      expect(() =>
        replaceNodesInPlace([
          makeMissingNodeType('OldType', {
            new_node_id: 'NewType',
            old_node_id: 'OldType',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: [{ new_idx: 0, old_idx: 0 }]
          })
        ])
      ).not.toThrow()
    })

    it('is a no-op when set_value targets a widget that does not exist on the new node', () => {
      const placeholder = createPlaceholderNode(1, 'OldType', [
        { name: 'image', link: null }
      ])
      placeholder.onRemoved = vi.fn()
      const graph = createMockGraph([placeholder])
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      // newNode has only one widget; set_value targets a different name.
      const newNode = createNewNode(
        [{ name: 'image', link: null }],
        [],
        [{ name: 'resize_method', value: 'bilinear' }]
      )
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const { replaceNodesInPlace } = useNodeReplacement()
      const result = replaceNodesInPlace([
        makeMissingNodeType('OldType', {
          new_node_id: 'NewType',
          old_node_id: 'OldType',
          old_widget_ids: null,
          input_mapping: [
            { new_id: 'nonexistent_widget', set_value: 'should-not-stick' }
          ],
          output_mapping: null
        })
      ])

      expect(result).toEqual(['OldType'])
      // Existing widget is unchanged; no new widget was created.
      expect(newNode.widgets).toHaveLength(1)
      expect(newNode.widgets![0].value).toBe('bilinear')
    })

    it.for([
      {
        name: 'saved names without old_widget_ids',
        inputs: [],
        widgetsValues: ['a.safetensors', 0.4],
        widgetsValuesNamed: { model_name: 'a.safetensors', strength: 0.4 },
        oldWidgetIds: null,
        expected: ['a.safetensors', 0.4]
      },
      {
        name: 'saved names over disagreeing old_widget_ids',
        inputs: [],
        widgetsValues: ['a.safetensors', 0.4],
        widgetsValuesNamed: { model_name: 'a.safetensors', strength: 0.4 },
        oldWidgetIds: ['strength', 'model_name'],
        expected: ['a.safetensors', 0.4]
      },
      {
        name: 'a lone positional value for the lone mapped widget',
        inputs: [{ name: 'strength', link: null }],
        widgetsValues: ['a.safetensors'],
        widgetsValuesNamed: undefined,
        oldWidgetIds: null,
        expected: ['a.safetensors', 1]
      },
      {
        name: 'no values when positional values are ambiguous',
        inputs: [],
        widgetsValues: ['a.safetensors', 0.4],
        widgetsValuesNamed: undefined,
        oldWidgetIds: null,
        expected: ['', 1]
      }
    ])(
      'transfers widget values from $name',
      ({
        inputs,
        widgetsValues,
        widgetsValuesNamed,
        oldWidgetIds,
        expected
      }) => {
        const placeholder = createPlaceholderNode(1, 'OldLoader', inputs)
        Object.assign(placeholder.last_serialization!, {
          widgets_values: widgetsValues,
          widgets_values_named: widgetsValuesNamed
        })
        const graph = createMockGraph([placeholder])
        placeholder.graph = graph
        Object.assign(app, { rootGraph: graph })
        vi.mocked(collectAllNodes).mockReturnValue([placeholder])

        const newNode = createNewNode(
          [],
          [],
          [
            { name: 'model', value: '' },
            { name: 'strength', value: 1 }
          ]
        )
        vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

        useNodeReplacement().replaceNodesInPlace([
          makeMissingNodeType('OldLoader', {
            new_node_id: 'NewLoader',
            old_node_id: 'OldLoader',
            old_widget_ids: oldWidgetIds,
            input_mapping: [
              { new_id: 'model', old_id: 'model_name' },
              { new_id: 'strength', old_id: 'strength' }
            ],
            output_mapping: null
          })
        ])

        expect(
          graph.getNodeById(toNodeId(1))!.widgets!.map((widget) => widget.value)
        ).toEqual(expected)
      }
    )

    it('invokes nodeGraph.onNodeAdded for each replaced node so VueNode data refreshes', () => {
      const placeholder = createPlaceholderNode(1, 'OldType')
      const graph = createMockGraph([placeholder])
      const onNodeAdded = vi.fn()
      ;(graph as { onNodeAdded?: (n: LGraphNode) => void }).onNodeAdded =
        onNodeAdded
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })

      vi.mocked(collectAllNodes).mockReturnValue([placeholder])

      const newNode = createNewNode()
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      const { replaceNodesInPlace } = useNodeReplacement()
      replaceNodesInPlace([
        makeMissingNodeType('OldType', {
          new_node_id: 'NewType',
          old_node_id: 'OldType',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      expect(onNodeAdded).toHaveBeenCalledTimes(1)
      expect(onNodeAdded).toHaveBeenCalledWith(newNode)
    })

    it('dispatches node:added when onNodeAdded throws', () => {
      const placeholder = createPlaceholderNode(1, 'OldType')
      const graph = createMockGraph([placeholder])
      graph.onNodeAdded = vi.fn(() => {
        throw new Error('notification failed')
      })
      const dispatch = vi.spyOn(graph.events, 'dispatch')
      placeholder.graph = graph
      Object.assign(app, { rootGraph: graph })
      vi.mocked(collectAllNodes).mockReturnValue([placeholder])
      const newNode = createNewNode()
      vi.mocked(LiteGraph.createNode).mockReturnValue(newNode)

      useNodeReplacement().replaceNodesInPlace([
        makeMissingNodeType('OldType', {
          new_node_id: 'NewType',
          old_node_id: 'OldType',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        })
      ])

      expect(dispatch).toHaveBeenCalledWith('node:added', { node: newNode })
    })
  })
})
