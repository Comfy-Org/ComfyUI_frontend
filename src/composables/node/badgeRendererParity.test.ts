import { render } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useNodeBadge } from '@/composables/node/useNodeBadge'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphNode as LGraphNodeClass
} from '@/lib/litegraph/src/litegraph'
import { usePartitionedBadges } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { NodeBadgeMode } from '@/types/nodeSource'

interface CapturedExtension {
  nodeCreated?: (node: LGraphNode) => void
}

const settings = vi.hoisted(() => ({ values: new Map<string, unknown>() }))
const registered = vi.hoisted(() => ({
  extension: undefined as CapturedExtension | undefined
}))
const canvasGraph = vi.hoisted(() => ({ graph: undefined as unknown }))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: (key: string) => settings.values.get(key) })
}))
vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: () => ({
    isExtensionInstalled: () => false,
    registerExtension: (extension: CapturedExtension) => {
      registered.extension = extension
    }
  })
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
vi.mock('@/composables/node/useNodePricing', () => ({
  useNodePricing: () => ({
    pricingRevision: ref(0),
    getNodePricingConfig: () => undefined,
    getRelevantWidgetNames: () => [],
    getNodeDisplayPrice: () => '',
    triggerPriceRecalculation: () => {}
  })
}))
vi.mock('@/composables/node/usePriceBadge', () => ({
  usePriceBadge: () => ({
    getCreditsBadge: () => ({ text: '' }),
    isCreditsBadge: () => false,
    updateSubgraphCredits: () => {}
  })
}))
vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      setDirty: () => {},
      get graph() {
        return canvasGraph.graph
      }
    }
  }
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
  const thunk = node.badges[0]
  if (typeof thunk !== 'function') throw new Error('no legacy badge installed')
  return thunk().text.replaceAll('[', '').replaceAll(']', '')
}

function vueBadgeText(node: LGraphNode): string {
  const nodeData: VueNodeData = {
    executing: false,
    id: node.id,
    mode: node.mode,
    selected: false,
    title: node.title,
    type: node.type,
    badges: node.badges
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
    registered.extension = undefined
  })

  function setup(
    mode: NodeBadgeMode,
    type: string,
    pythonModule: string
  ): LGraphNode {
    setModes(mode)
    seedNodeDef(type, pythonModule)
    render(
      defineComponent({
        setup() {
          useNodeBadge()
          return () => h('div')
        }
      })
    )

    const graph = new LGraph()
    const node = new LGraphNodeClass(type, type)
    graph.add(node)
    canvasGraph.graph = graph
    registered.extension?.nodeCreated?.(node)
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

    it.fails('renders Vue badges in the same display order', () => {
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

    it.fails('renders Vue badges in the same display order', () => {
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

    it.fails('renders Vue badges in the same display order', () => {
      const node = setup(NodeBadgeMode.ShowAll, 'CoreNode', 'nodes')

      expect(vueBadgeText(node)).toBe(`#1 BETA ${CORE_SOURCE_BADGE}`)
    })
  })

  describe('core node under HideBuiltIn (#15567)', () => {
    it('hides built-in legacy badges', () => {
      const node = setup(NodeBadgeMode.HideBuiltIn, 'CoreNode', 'nodes')

      expect(legacyBadgeText(node)).toBe('')
    })

    it.fails('hides built-in Vue badges', () => {
      const node = setup(NodeBadgeMode.HideBuiltIn, 'CoreNode', 'nodes')

      expect(vueBadgeText(node)).toBe('')
    })
  })
})
