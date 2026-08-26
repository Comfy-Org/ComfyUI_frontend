import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { badgeDrawObjects } from '@/lib/litegraph/src/nodeBadgeDraw'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphNode as LGraphNodeClass
} from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { usePartitionedBadges } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { nodeBadges } from '@/systems/badgeSystem'
import type { NodeState } from '@/types/nodeState'
import { NodeBadgeMode } from '@/types/nodeSource'

const settings = vi.hoisted(() => ({ values: new Map<string, unknown>() }))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: (key: string) => settings.values.get(key) })
}))
vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => ({
    completedActivePalette: {
      colors: {
        litegraph_base: { BADGE_FG_COLOR: '#fff', BADGE_BG_COLOR: '#000' }
      }
    }
  })
}))

const CORE_SOURCE_BADGE = '🦊'

function setModes(mode: NodeBadgeMode) {
  settings.values.set('Comfy.NodeBadge.NodeIdBadgeMode', mode)
  settings.values.set('Comfy.NodeBadge.NodeLifeCycleBadgeMode', mode)
  settings.values.set('Comfy.NodeBadge.NodeSourceBadgeMode', mode)
}

function seedNodeDef(name: string, pythonModule: string) {
  useNodeDefStore().addNodeDef({
    name,
    display_name: name,
    category: 'test',
    python_module: pythonModule,
    description: '',
    input: {},
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: false,
    experimental: true
  })
}

function legacyBadgeText(node: LGraphNode): string {
  const badge = badgeDrawObjects(node, nodeBadges(node))[0]
  return badge?.text.replaceAll('[', '').replaceAll(']', '') ?? ''
}

function vueBadgeText(node: LGraphNode): string {
  if (!node.graph) throw new Error('node is not attached to a graph')
  const nodeData: NodeState = {
    flags: node.flags,
    graphId: node.graph.id,
    id: node.id,
    inputs: node.inputs,
    mode: node.mode,
    outputs: node.outputs,
    properties: node.properties,
    title: node.title,
    type: node.type
  }
  const scope = effectScope()
  const facts = scope.run(() => {
    const partitioned = usePartitionedBadges(nodeData).value
    return [
      ...partitioned.core.map((badge) => badge.text),
      ...(partitioned.hasComfyBadge ? [CORE_SOURCE_BADGE] : [])
    ]
  })
  scope.stop()
  return (facts ?? []).join(' ')
}

describe('badge renderer parity (I2)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    settings.values = new Map<string, unknown>()
  })

  function setup(
    mode: NodeBadgeMode,
    type: string,
    pythonModule: string
  ): LGraphNode {
    setModes(mode)
    seedNodeDef(type, pythonModule)

    const graph = new LGraph()
    const node = new LGraphNodeClass(type, type)
    graph.add(node)
    useCanvasStore().currentGraph = graph
    return node
  }

  describe('custom node under ShowAll', () => {
    it('renders legacy badges in display order', () => {
      const node = setup(
        NodeBadgeMode.ShowAll,
        'CustomNode',
        'custom_nodes.my_pack'
      )

      expect(legacyBadgeText(node)).toBe('#1 BETA my_pack')
    })

    it('renders Vue badges in the same display order', () => {
      const node = setup(
        NodeBadgeMode.ShowAll,
        'CustomNode',
        'custom_nodes.my_pack'
      )

      expect(vueBadgeText(node)).toBe('#1 BETA my_pack')
    })
  })

  describe('custom node under HideBuiltIn', () => {
    it('renders legacy badges in display order', () => {
      const node = setup(
        NodeBadgeMode.HideBuiltIn,
        'CustomNode',
        'custom_nodes.my_pack'
      )

      expect(legacyBadgeText(node)).toBe('#1 BETA my_pack')
    })

    it('renders Vue badges in the same display order', () => {
      const node = setup(
        NodeBadgeMode.HideBuiltIn,
        'CustomNode',
        'custom_nodes.my_pack'
      )

      expect(vueBadgeText(node)).toBe('#1 BETA my_pack')
    })
  })

  it('agrees that None hides every badge', () => {
    const node = setup(NodeBadgeMode.None, 'CustomNode', 'custom_nodes.my_pack')

    expect(legacyBadgeText(node)).toBe('')
    expect(vueBadgeText(node)).toBe('')
  })

  describe('core node under ShowAll', () => {
    it('renders legacy badges in display order', () => {
      const node = setup(NodeBadgeMode.ShowAll, 'CoreNode', 'nodes')

      expect(legacyBadgeText(node)).toBe(`#1 BETA ${CORE_SOURCE_BADGE}`)
    })

    it('renders Vue badges in the same display order', () => {
      const node = setup(NodeBadgeMode.ShowAll, 'CoreNode', 'nodes')

      expect(vueBadgeText(node)).toBe(`#1 BETA ${CORE_SOURCE_BADGE}`)
    })
  })

  describe('core node under HideBuiltIn (#15567)', () => {
    it('hides built-in legacy badges', () => {
      const node = setup(NodeBadgeMode.HideBuiltIn, 'CoreNode', 'nodes')

      expect(legacyBadgeText(node)).toBe('')
    })

    it('hides built-in Vue badges', () => {
      const node = setup(NodeBadgeMode.HideBuiltIn, 'CoreNode', 'nodes')

      expect(vueBadgeText(node)).toBe('')
    })
  })
})
