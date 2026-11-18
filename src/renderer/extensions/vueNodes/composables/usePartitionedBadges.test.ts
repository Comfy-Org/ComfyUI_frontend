import { useSettingStore } from '@/platform/settings/settingStore'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { LGraphBadge, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { usePartitionedBadges } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import type { ComfyNodeDef } from '@comfyorg/object-info-parser'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { NodeBadgeMode } from '@/types/nodeSource'

const NODE_ID = toNodeId(5)

const getNodeDisplayPrice = vi.fn(() => '$0.05 x 3 Runs')
vi.mock<unknown>(import('@/composables/node/useNodePricing'), () => ({
  useNodePricing: () => ({
    getNodeDisplayPrice,
    getNodeRevisionRef: () => ({ value: 0 }),
    hasDynamicPricing: () => false,
    getRelevantWidgetNames: () => [],
    getInputNames: () => [],
    getInputGroupPrefixes: () => []
  })
}))

function seedGraph(node: LGraphNode): void {
  const graph = fromPartial<LGraph>({
    id: 'graph-test',
    getNodeById: (id: NodeId) => (id === NODE_ID ? node : null),
    subgraphs: new Map()
  })
  Reflect.set(graph, 'rootGraph', graph)
  node.graph = graph
  useCanvasStore().currentGraph = graph
}

function makeNode(
  type: string,
  { apiNode = false }: { apiNode?: boolean } = {}
): LGraphNode {
  class TestNode extends LGraphNode {
    static override nodeData = { name: type, api_node: apiNode }
  }
  const node = new TestNode(type, type)
  node.id = NODE_ID
  seedGraph(node)
  return node
}

function addNodeDef(name: string, python_module: string): void {
  useNodeDefStore().addNodeDef(
    fromPartial<ComfyNodeDef>({
      name,
      display_name: name,
      category: 'test',
      python_module,
      experimental: true,
      input: {},
      output: []
    })
  )
}

function nodeData(type: string): NodeState {
  return fromPartial<NodeState>({ id: NODE_ID, type })
}

describe('usePartitionedBadges', () => {
  beforeEach(() => {
    useSettingStore().settingValues['Comfy.NodeBadge.NodeIdBadgeMode'] =
      NodeBadgeMode.ShowAll
    useSettingStore().settingValues['Comfy.NodeBadge.NodeLifeCycleBadgeMode'] =
      NodeBadgeMode.ShowAll
    useSettingStore().settingValues['Comfy.NodeBadge.NodeSourceBadgeMode'] =
      NodeBadgeMode.ShowAll
    useSettingStore().settingValues['Comfy.NodeBadge.ShowApiPricing'] = true
  })

  it('groups derived badges without splitting pricing text', () => {
    makeNode('CustomNode', { apiNode: true })
    addNodeDef('CustomNode', 'custom_nodes.testpack')

    const partitioned = usePartitionedBadges(nodeData('CustomNode'))

    expect(partitioned.value).toEqual({
      groups: [
        {
          kind: 'core',
          badges: [{ text: '#5' }, { text: 'BETA' }, { text: 'testpack' }]
        },
        {
          kind: 'credits',
          badges: [
            {
              text: '$0.05 x 3 Runs',
              cssIcon: 'icon-[lucide--coins] order-first bg-credit'
            }
          ]
        }
      ]
    })
  })

  it('suppresses the source row and shows the logo for a core node', () => {
    makeNode('CoreNode')
    addNodeDef('CoreNode', 'nodes')

    const partitioned = usePartitionedBadges(nodeData('CoreNode'))

    expect(partitioned.value.groups).toEqual([
      { kind: 'core', badges: [{ text: '#5' }, { text: 'BETA' }] },
      {
        kind: 'source',
        badges: [{ text: '', cssIcon: 'icon-[comfy--comfy-c] size-3' }]
      }
    ])
  })

  it('shows no logo when the core node has pricing', () => {
    makeNode('CoreNode', { apiNode: true })
    addNodeDef('CoreNode', 'nodes')

    const partitioned = usePartitionedBadges(nodeData('CoreNode'))

    expect(partitioned.value.groups.map((group) => group.kind)).toEqual([
      'core',
      'credits'
    ])
  })

  it('shows the logo for a Comfy Cloud node despite its pricing', () => {
    makeNode('ComfyCloudNode', { apiNode: true })
    addNodeDef('ComfyCloudNode', 'comfy_api_nodes.nodes_comfy_cloud')

    const partitioned = usePartitionedBadges(nodeData('ComfyCloudNode'))

    expect(partitioned.value.groups).toContainEqual({
      kind: 'source',
      badges: [
        { text: '', cssIcon: 'icon-[comfy--comfy-c] size-3 text-brand-yellow' }
      ]
    })
    expect(partitioned.value.groups.at(-1)?.badges[0]?.text).toBe(
      '$0.05 x 3 Runs'
    )
  })

  it('shows no logo for a partner node from another api module', () => {
    makeNode('KlingNode', { apiNode: true })
    addNodeDef('KlingNode', 'comfy_api_nodes.nodes_kling')

    const partitioned = usePartitionedBadges(nodeData('KlingNode'))

    expect(partitioned.value.groups.map((group) => group.kind)).toEqual([
      'core',
      'credits'
    ])
  })

  it('appends non-empty node.badges extension badges after derived rows', () => {
    const node = makeNode('CustomNode')
    node.badges = [
      new LGraphBadge({ text: 'EXT' }),
      () => new LGraphBadge({ text: '' })
    ]

    const partitioned = usePartitionedBadges(nodeData('CustomNode'))

    expect(partitioned.value.groups).toEqual([
      { kind: 'core', badges: [{ text: '#5' }] },
      {
        kind: 'extension',
        badges: [expect.objectContaining({ text: 'EXT' })]
      }
    ])
  })

  it('reacts to a core node definition registered after creation', () => {
    makeNode('CoreNode')
    const partitioned = usePartitionedBadges(nodeData('CoreNode'))
    expect(partitioned.value.groups.map((group) => group.kind)).toEqual([
      'core'
    ])

    addNodeDef('CoreNode', 'nodes')

    expect(partitioned.value.groups.map((group) => group.kind)).toEqual([
      'core',
      'source'
    ])
  })

  it('re-partitions when a badge source changes', () => {
    makeNode('CustomNode')
    const partitioned = usePartitionedBadges(nodeData('CustomNode'))
    expect(partitioned.value.groups).toEqual([
      { kind: 'core', badges: [{ text: '#5' }] }
    ])

    addNodeDef('CustomNode', 'custom_nodes.testpack')

    expect(partitioned.value.groups).toEqual([
      {
        kind: 'core',
        badges: [{ text: '#5' }, { text: 'BETA' }, { text: 'testpack' }]
      }
    ])
  })
})
