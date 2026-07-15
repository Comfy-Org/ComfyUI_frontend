import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { LGraphBadge, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { usePartitionedBadges } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useNodeBadgeStore } from '@/stores/nodeBadgeStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { BadgeData } from '@/types/badgeData'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { NodeBadgeMode } from '@/types/nodeSource'
import type { UUID } from '@/utils/uuid'

const GRAPH_ID: UUID = 'graph-test'
const NODE_ID = toNodeId(5)

const settings = vi.hoisted(() => new Map<string, unknown>())
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: (key: string) => settings.get(key) })
}))

function seedGraph(node?: LGraphNode): void {
  const graph = fromPartial<LGraph>({
    id: GRAPH_ID,
    getNodeById: (id: NodeId) => (id === NODE_ID ? (node ?? null) : null),
    subgraphs: new Map()
  })
  Reflect.set(graph, 'rootGraph', graph)
  useCanvasStore().currentGraph = graph
}

function seedRows(rows: BadgeData[]): void {
  const badgeStore = useNodeBadgeStore()
  badgeStore.registerNode(GRAPH_ID, NODE_ID)
  badgeStore.setBadges(GRAPH_ID, NODE_ID, rows)
}

function addNodeDef(name: string, python_module: string): void {
  useNodeDefStore().addNodeDef(
    fromPartial<ComfyNodeDef>({
      name,
      display_name: name,
      category: 'test',
      python_module,
      input: {},
      output: []
    })
  )
}

function nodeData(type: string): VueNodeData {
  return fromPartial<VueNodeData>({ id: NODE_ID, type })
}

describe('usePartitionedBadges', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    settings.clear()
    settings.set('Comfy.NodeBadge.NodeSourceBadgeMode', NodeBadgeMode.ShowAll)
    seedGraph()
  })

  it('partitions rows into core chips and pricing entries', () => {
    seedRows([
      { kind: 'core', part: 'lifecycle', text: '[BETA]' },
      { kind: 'core', part: 'id', text: '#5' },
      { kind: 'core', part: 'source', text: 'my-pack' },
      { kind: 'credits', text: '$0.05 x 3 Runs' }
    ])

    const partitioned = usePartitionedBadges(nodeData('CustomNode'))

    expect(partitioned.value).toEqual({
      hasComfyBadge: false,
      core: [{ text: 'BETA' }, { text: '#5' }, { text: 'my-pack' }],
      extension: [],
      pricing: [{ required: '$0.05', rest: 'x 3 Runs' }]
    })
  })

  it('substitutes the Comfy logo for a core node source row', () => {
    addNodeDef('CoreNode', 'nodes')
    seedRows([
      { kind: 'core', part: 'id', text: '#5' },
      { kind: 'core', part: 'source', text: '🦊' }
    ])

    const partitioned = usePartitionedBadges(nodeData('CoreNode'))

    expect(partitioned.value.core).toEqual([{ text: '#5' }])
    expect(partitioned.value.hasComfyBadge).toBe(true)
  })

  it('shows no Comfy logo when the core node has pricing', () => {
    addNodeDef('CoreNode', 'nodes')
    seedRows([{ kind: 'credits', text: '$0.10' }])

    const partitioned = usePartitionedBadges(nodeData('CoreNode'))

    expect(partitioned.value.hasComfyBadge).toBe(false)
    expect(partitioned.value.pricing).toEqual([{ required: '$0.10' }])
  })

  it('appends non-empty node.badges extension badges after store rows', () => {
    const node = new LGraphNode('ext-node')
    node.badges = [
      new LGraphBadge({ text: 'EXT' }),
      () => new LGraphBadge({ text: '' })
    ]
    seedGraph(node)
    seedRows([{ kind: 'core', part: 'id', text: '#5' }])

    const partitioned = usePartitionedBadges(nodeData('CustomNode'))

    expect(partitioned.value.core).toEqual([{ text: '#5' }])
    expect(partitioned.value.extension).toEqual([
      expect.objectContaining({ text: 'EXT' })
    ])
  })

  it('re-partitions when the store rows are rewritten', () => {
    seedRows([{ kind: 'core', part: 'id', text: '#5' }])
    const partitioned = usePartitionedBadges(nodeData('CustomNode'))
    expect(partitioned.value.core).toEqual([{ text: '#5' }])

    useNodeBadgeStore().setBadges(GRAPH_ID, NODE_ID, [
      { kind: 'core', part: 'id', text: '#5' },
      { kind: 'credits', text: '$1' }
    ])

    expect(partitioned.value.pricing).toEqual([{ required: '$1' }])
  })
})
