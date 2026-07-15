import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { computed, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { usePriceBadge } from '@/composables/node/usePriceBadge'
import type { LGraph, LGraphBadge } from '@/lib/litegraph/src/litegraph'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  trackNodePrice,
  usePartitionedBadges
} from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { NodeBadgeMode } from '@/types/nodeSource'

const GRAPH_ID = 'graph-test'

vi.mock('@/scripts/app', () => ({ app: {} }))

const settings = vi.hoisted(() => new Map<string, unknown>())
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: (key: string) => settings.get(key) })
}))

vi.mock('@/composables/node/useNodePricing', () => {
  const revision = ref(0)
  return {
    useNodePricing: () => ({
      hasDynamicPricing: () => true,
      getRelevantWidgetNames: () => [],
      getInputNames: () => ['image'],
      getInputGroupPrefixes: () => ['ref_images'],
      getNodeRevisionRef: () => revision
    })
  }
})

function makeInputSlot(name: string): INodeInputSlot {
  return { name, type: 'IMAGE', link: null, boundingRect: [0, 0, 0, 0] }
}

describe('trackNodePrice', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    useCanvasStore().currentGraph = fromPartial<LGraph>({
      rootGraph: { id: GRAPH_ID }
    })
    // Instantiate up front so first-use state registration inside a test
    // cannot masquerade as connectivity-driven invalidation.
    useLinkStore()
    useWidgetValueStore()
  })

  function trackedRuns(inputs: INodeInputSlot[]) {
    let runs = 0
    const tracker = computed(() => {
      trackNodePrice({ id: '5', type: 'ApiNode', inputs })
      runs += 1
      return runs
    })
    return { read: () => tracker.value, runs: () => runs }
  }

  function connect(slot: number, linkId: number) {
    useLinkStore().registerLink(GRAPH_ID, {
      id: toLinkId(linkId),
      originNodeId: toNodeId(99),
      originSlot: 0,
      targetNodeId: toNodeId(5),
      targetSlot: slot,
      type: 'IMAGE'
    })
  }

  it('re-runs when a pricing-relevant input connects or disconnects', () => {
    const inputs = [makeInputSlot('image'), makeInputSlot('other')]
    const { read, runs } = trackedRuns(inputs)

    read()
    expect(runs()).toBe(1)

    connect(0, 1)
    read()
    expect(runs()).toBe(2)

    const linkStore = useLinkStore()
    const topology = linkStore.getInputSlotLink(GRAPH_ID, toNodeId(5), 0)!
    linkStore.deleteLink(GRAPH_ID, topology)
    read()
    expect(runs()).toBe(3)
  })

  it('re-runs when an input-group input connects', () => {
    const inputs = [makeInputSlot('image'), makeInputSlot('ref_images.img0')]
    const { read, runs } = trackedRuns(inputs)

    read()
    expect(runs()).toBe(1)

    connect(1, 2)
    read()
    expect(runs()).toBe(2)
  })

  it('does not re-run when an irrelevant input connects', () => {
    const inputs = [makeInputSlot('image'), makeInputSlot('other')]
    // Seed the graph's link bucket so its creation is not what gets observed.
    connect(7, 9)
    const { read, runs } = trackedRuns(inputs)

    read()
    expect(runs()).toBe(1)

    connect(1, 3)
    read()
    expect(runs()).toBe(1)
  })
})

describe('usePartitionedBadges', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    settings.clear()
    settings.set('Comfy.NodeBadge.NodeIdBadgeMode', NodeBadgeMode.ShowAll)
    settings.set(
      'Comfy.NodeBadge.NodeLifeCycleBadgeMode',
      NodeBadgeMode.ShowAll
    )
    settings.set('Comfy.NodeBadge.NodeSourceBadgeMode', NodeBadgeMode.None)
  })

  function addNodeDef(name: string, python_module: string) {
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

  function makeNodeData(
    type: string,
    badges: Partial<LGraphBadge>[]
  ): VueNodeData {
    return fromPartial<VueNodeData>({ id: '5', type, badges })
  }

  it('partitions badges into core, pricing, and extension rows', () => {
    addNodeDef('CustomNode', 'custom_nodes.testpack')
    const credits = usePriceBadge().getCreditsBadge('$0.05 x 3 Runs')

    const partitioned = usePartitionedBadges(
      makeNodeData('CustomNode', [
        { text: 'legacy-core-slot' },
        credits,
        { text: 'EXT' },
        { text: '' }
      ])
    )

    expect(partitioned.value).toEqual({
      hasComfyBadge: false,
      core: [{ text: '#5' }],
      extension: [expect.objectContaining({ text: 'EXT' })],
      pricing: [{ required: '$0.05', rest: 'x 3 Runs' }]
    })
  })

  it('shows the Comfy badge only for core nodes without pricing', () => {
    settings.set('Comfy.NodeBadge.NodeSourceBadgeMode', NodeBadgeMode.ShowAll)
    addNodeDef('CoreNode', 'nodes')

    const withoutPricing = usePartitionedBadges(
      makeNodeData('CoreNode', [{ text: 'legacy-core-slot' }])
    )
    expect(withoutPricing.value.hasComfyBadge).toBe(true)

    const credits = usePriceBadge().getCreditsBadge('$0.10')
    const withPricing = usePartitionedBadges(
      makeNodeData('CoreNode', [{ text: 'legacy-core-slot' }, credits])
    )
    expect(withPricing.value.hasComfyBadge).toBe(false)
  })
})
