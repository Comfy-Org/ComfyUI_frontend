import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeState } from '@/types/nodeState'
import { LGraphBadge, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { usePartitionedBadges } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { NodeBadgeMode } from '@/types/nodeSource'

const NODE_ID = toNodeId(5)

const settings = vi.hoisted(() => new Map<string, unknown>())
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: (key: string) => settings.get(key) })
}))

const getNodeDisplayPrice = vi.fn(() => '$0.05 x 3 Runs')
vi.mock('@/composables/node/useNodePricing', () => ({
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
  const node = new TestNode(type)
  node.id = NODE_ID
  node.type = type
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
    setActivePinia(createTestingPinia({ stubActions: false }))
    settings.clear()
    settings.set('Comfy.NodeBadge.NodeIdBadgeMode', NodeBadgeMode.ShowAll)
    settings.set(
      'Comfy.NodeBadge.NodeLifeCycleBadgeMode',
      NodeBadgeMode.ShowAll
    )
    settings.set('Comfy.NodeBadge.NodeSourceBadgeMode', NodeBadgeMode.ShowAll)
    settings.set('Comfy.NodeBadge.ShowApiPricing', true)
  })

  it('partitions derived rows into core chips and pricing entries', () => {
    makeNode('CustomNode', { apiNode: true })
    addNodeDef('CustomNode', 'custom_nodes.testpack')

    const partitioned = usePartitionedBadges(nodeData('CustomNode'))

    expect(partitioned.value).toEqual({
      hasComfyBadge: false,
      core: [{ text: 'BETA' }, { text: '#5' }, { text: 'testpack' }],
      extension: [],
      pricing: [{ required: '$0.05', rest: 'x 3 Runs' }]
    })
  })

  it('suppresses the source row and shows the logo for a core node', () => {
    makeNode('CoreNode')
    addNodeDef('CoreNode', 'nodes')

    const partitioned = usePartitionedBadges(nodeData('CoreNode'))

    expect(partitioned.value.core.some((chip) => chip.text === '#5')).toBe(true)
    expect(partitioned.value.hasComfyBadge).toBe(true)
  })

  it('shows no logo when the core node has pricing', () => {
    makeNode('CoreNode', { apiNode: true })
    addNodeDef('CoreNode', 'nodes')

    const partitioned = usePartitionedBadges(nodeData('CoreNode'))

    expect(partitioned.value.hasComfyBadge).toBe(false)
    expect(partitioned.value.pricing).toEqual([
      { required: '$0.05', rest: 'x 3 Runs' }
    ])
  })

  it('appends non-empty node.badges extension badges after derived rows', () => {
    const node = makeNode('CustomNode')
    node.badges = [
      new LGraphBadge({ text: 'EXT' }),
      () => new LGraphBadge({ text: '' })
    ]

    const partitioned = usePartitionedBadges(nodeData('CustomNode'))

    expect(partitioned.value.core).toEqual([{ text: '#5' }])
    expect(partitioned.value.extension).toEqual([
      expect.objectContaining({ text: 'EXT' })
    ])
  })

  it('reacts to a core node definition registered after creation', () => {
    makeNode('CoreNode')
    const partitioned = usePartitionedBadges(nodeData('CoreNode'))
    expect(partitioned.value.hasComfyBadge).toBe(false)

    addNodeDef('CoreNode', 'nodes')

    expect(partitioned.value.hasComfyBadge).toBe(true)
  })

  it('re-partitions when a badge source changes', () => {
    makeNode('CustomNode')
    const partitioned = usePartitionedBadges(nodeData('CustomNode'))
    expect(partitioned.value.core).toEqual([{ text: '#5' }])

    addNodeDef('CustomNode', 'custom_nodes.testpack')

    expect(partitioned.value.core).toEqual([
      { text: 'BETA' },
      { text: '#5' },
      { text: 'testpack' }
    ])
  })
})
