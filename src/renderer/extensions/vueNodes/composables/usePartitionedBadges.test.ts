import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { computed, ref } from 'vue'

import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import { trackNodePrice } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import { useLinkStore } from '@/stores/linkStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

const GRAPH_ID = 'graph-test'

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      graph: {
        rootGraph: {
          id: 'graph-test'
        }
      }
    }
  }
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
