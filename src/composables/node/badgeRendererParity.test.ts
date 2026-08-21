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

function normalize(texts: string[]): string[] {
  return texts
    .map((text) => text.replaceAll('[', '').replaceAll(']', ''))
    .filter((text) => text.length > 0)
    .sort()
}

/** The badge texts the legacy canvas draws, as separate facts. */
function legacyBadgeFacts(node: LGraphNode): string[] {
  const thunk = node.badges[0]
  if (typeof thunk !== 'function') throw new Error('no legacy badge installed')
  return normalize(thunk().text.split(' '))
}

/** The same facts as the Vue renderer surfaces them. */
function vueBadgeFacts(node: LGraphNode): string[] {
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
  return normalize(facts ?? [])
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

  it('agrees on a custom node under ShowAll', () => {
    const node = setup(
      NodeBadgeMode.ShowAll,
      'CustomNode',
      'custom_nodes.my_pack'
    )

    expect(legacyBadgeFacts(node)).toEqual(['#1', 'BETA', 'my_pack'].sort())
    expect(vueBadgeFacts(node)).toEqual(legacyBadgeFacts(node))
  })

  it('agrees on a custom node under HideBuiltIn', () => {
    const node = setup(
      NodeBadgeMode.HideBuiltIn,
      'CustomNode',
      'custom_nodes.my_pack'
    )

    expect(legacyBadgeFacts(node)).toEqual(['#1', 'BETA', 'my_pack'].sort())
    expect(vueBadgeFacts(node)).toEqual(legacyBadgeFacts(node))
  })

  it('agrees that None hides every badge', () => {
    const node = setup(NodeBadgeMode.None, 'CustomNode', 'custom_nodes.my_pack')

    expect(legacyBadgeFacts(node)).toEqual([])
    expect(vueBadgeFacts(node)).toEqual([])
  })

  it('agrees on a core node under ShowAll', () => {
    const node = setup(NodeBadgeMode.ShowAll, 'CoreNode', 'nodes')

    expect(legacyBadgeFacts(node)).toEqual(
      ['#1', 'BETA', CORE_SOURCE_BADGE].sort()
    )
    expect(vueBadgeFacts(node)).toEqual(legacyBadgeFacts(node))
  })

  // Asserts parity, so it fails today and passes the moment #15567 is fixed.
  // Pinning the disagreement would make the test go red when the bug is
  // repaired, and the tempting move then is to edit the test.
  it.fails('hides built-in id and lifecycle badges in both renderers under HideBuiltIn (#15567)', () => {
    const node = setup(NodeBadgeMode.HideBuiltIn, 'CoreNode', 'nodes')

    expect(legacyBadgeFacts(node)).toEqual([])
    expect(vueBadgeFacts(node)).toEqual([])
  })
})
