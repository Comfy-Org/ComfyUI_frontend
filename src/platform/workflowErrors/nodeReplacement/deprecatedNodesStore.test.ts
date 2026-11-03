import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installErrorClearingHooks } from '@/composables/graph/useErrorClearingHooks'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useDeprecatedNodesStore } from '@/platform/workflowErrors/nodeReplacement/deprecatedNodesStore'
import { useNodeReplacementStore } from '@/platform/workflowErrors/nodeReplacement/nodeReplacementStore'
import type { NodeReplacement } from '@/platform/workflowErrors/nodeReplacement/types'
import { app } from '@/scripts/app'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

function nodeDef(name: string, deprecated: boolean): ComfyNodeDefV1 {
  return {
    name,
    display_name: name,
    category: 'test',
    description: '',
    input: {},
    output: [],
    output_node: false,
    python_module: 'test.module',
    deprecated
  }
}

function replacementTo(oldId: string, newId: string): NodeReplacement[] {
  return [
    {
      new_node_id: newId,
      old_node_id: oldId,
      old_widget_ids: null,
      input_mapping: null,
      output_mapping: null
    }
  ]
}

function listedNodeIds(): unknown[] {
  return useDeprecatedNodesStore().nodeTypes.map((nodeType) =>
    typeof nodeType === 'string' ? nodeType : nodeType.nodeId
  )
}

function setNodeMode(
  graph: LGraph,
  node: LGraphNode,
  newMode: LGraphEventMode
): void {
  const oldMode = node.mode
  node.mode = newMode
  graph.onTrigger?.({
    type: 'node:property:changed',
    nodeId: node.id,
    property: 'mode',
    oldValue: oldMode,
    newValue: newMode
  })
}

beforeEach(() => {
  useSettingStore().settingValues['Comfy.NodeReplacement.Enabled'] = true
  useNodeReplacementStore().replacements = {
    ImageBatch: replacementTo('ImageBatch', 'BatchImagesNode'),
    KSampler: replacementTo('KSampler', 'BatchImagesNode'),
    UninstalledTarget: replacementTo('UninstalledTarget', 'NotInstalled')
  }
  useNodeDefStore().updateNodeDefs([
    nodeDef('ImageBatch', true),
    nodeDef('KSampler', false),
    nodeDef('NoReplacement', true),
    nodeDef('UninstalledTarget', true)
  ])
  LiteGraph.registerNodeType(
    'BatchImagesNode',
    class BatchImagesNode extends LGraphNode {}
  )
})

describe('useDeprecatedNodesStore rescan', () => {
  it.for([
    {
      name: 'a deprecated node with an installed replacement',
      type: 'ImageBatch',
      mode: LGraphEventMode.ALWAYS,
      expected: ['1']
    },
    {
      name: 'a node that is not deprecated',
      type: 'KSampler',
      mode: LGraphEventMode.ALWAYS,
      expected: []
    },
    {
      name: 'a deprecated node without a replacement',
      type: 'NoReplacement',
      mode: LGraphEventMode.ALWAYS,
      expected: []
    },
    {
      name: 'a replacement that is not installed',
      type: 'UninstalledTarget',
      mode: LGraphEventMode.ALWAYS,
      expected: []
    },
    {
      name: 'a bypassed deprecated node',
      type: 'ImageBatch',
      mode: LGraphEventMode.BYPASS,
      expected: []
    },
    {
      name: 'a muted deprecated node',
      type: 'ImageBatch',
      mode: LGraphEventMode.NEVER,
      expected: []
    }
  ])('lists $expected for $name', ({ type, mode, expected }) => {
    const graph = new LGraph()
    const node = new LGraphNode(type, type)
    node.id = toNodeId(1)
    node.mode = mode
    graph.add(node)

    useDeprecatedNodesStore().rescan(graph)

    expect(listedNodeIds()).toEqual(expected)
  })

  it('lists a node inside a subgraph used twice once', () => {
    const rootGraph = new LGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    const inner = new LGraphNode('ImageBatch', 'ImageBatch')
    subgraph.add(inner)
    rootGraph.add(createTestSubgraphNode(subgraph, { id: 7 }))
    rootGraph.add(createTestSubgraphNode(subgraph, { id: 8 }))

    useDeprecatedNodesStore().rescan(rootGraph)

    expect(listedNodeIds()).toEqual([`7:${inner.id}`])
  })

  it('skips a node inside a bypassed subgraph', () => {
    const rootGraph = new LGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    subgraph.add(new LGraphNode('ImageBatch', 'ImageBatch'))
    const host = createTestSubgraphNode(subgraph, { id: 7 })
    host.mode = LGraphEventMode.BYPASS
    rootGraph.add(host)

    useDeprecatedNodesStore().rescan(rootGraph)

    expect(listedNodeIds()).toEqual([])
  })
})

describe('deprecated nodes follow graph edits', () => {
  function installHooks(): LGraph {
    const graph = new LGraph()
    vi.spyOn(app, 'rootGraphOrUndefined', 'get').mockReturnValue(graph)
    installErrorClearingHooks(graph)
    return graph
  }

  it('lists a deprecated node again after it is bypassed and restored', () => {
    const graph = installHooks()
    const node = new LGraphNode('ImageBatch', 'ImageBatch')
    graph.add(node)
    useDeprecatedNodesStore().rescan(graph)

    setNodeMode(graph, node, LGraphEventMode.BYPASS)
    expect(listedNodeIds()).toEqual([])
    setNodeMode(graph, node, LGraphEventMode.ALWAYS)

    expect(listedNodeIds()).toEqual([String(node.id)])
  })

  it('lists a deprecated node added after load', async () => {
    const graph = installHooks()
    useDeprecatedNodesStore().rescan(graph)

    const node = new LGraphNode('ImageBatch', 'ImageBatch')
    graph.add(node)

    await vi.waitFor(() => expect(listedNodeIds()).toEqual([String(node.id)]))
  })
})
