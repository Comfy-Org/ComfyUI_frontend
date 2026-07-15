import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

import { nodeBadges } from './badgeSystem'

const getNodeDisplayPrice = vi.fn(() => '$1')

vi.mock('@/composables/node/useNodePricing', () => {
  return {
    useNodePricing: () => ({
      getNodeDisplayPrice,
      getNodeRevisionRef: () => ({ value: 0 }),
      hasDynamicPricing: () => true,
      getRelevantWidgetNames: () => [],
      getInputNames: () => ['image'],
      getInputGroupPrefixes: () => ['ref_images']
    })
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) =>
      key === 'Comfy.NodeBadge.ShowApiPricing' ? true : undefined
  })
}))

class ApiNode extends LGraphNode {
  static override nodeData = { name: 'ApiNode', api_node: true }
}

const graphId: UUID = 'graph-pricing'

describe('badge derivation pricing input connectivity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    getNodeDisplayPrice.mockClear()
  })

  function setup(inputNames: string[]) {
    const node = new ApiNode('api')
    node.id = toNodeId(5)
    node.type = 'ApiNode'
    for (const name of inputNames) node.addInput(name, 'IMAGE')
    node.graph = fromPartial<LGraph>({ rootGraph: { id: graphId } })
    return { node }
  }

  function connect(slot: number, linkId: number) {
    useLinkStore().registerLink(graphId, {
      id: toLinkId(linkId),
      originNodeId: toNodeId(99),
      originSlot: 0,
      targetNodeId: toNodeId(5),
      targetSlot: slot,
      type: 'IMAGE'
    })
  }

  it('recomputes when a pricing-relevant input connects and disconnects', () => {
    const { node } = setup(['image', 'other'])
    const evaluations = () => getNodeDisplayPrice.mock.calls.length

    nodeBadges(node)
    const initial = evaluations()
    nodeBadges(node)
    expect(evaluations()).toBe(initial)

    connect(0, 1)
    nodeBadges(node)
    expect(evaluations()).toBe(initial + 1)

    const linkStore = useLinkStore()
    const topology = linkStore.getInputSlotLink(graphId, toNodeId(5), 0)!
    linkStore.deleteLink(graphId, topology)
    nodeBadges(node)
    expect(evaluations()).toBe(initial + 2)
  })

  it('recomputes when an input-group input connects', () => {
    const { node } = setup(['image', 'ref_images.img0'])

    nodeBadges(node)
    const initial = getNodeDisplayPrice.mock.calls.length

    connect(1, 2)
    nodeBadges(node)

    expect(getNodeDisplayPrice.mock.calls.length).toBe(initial + 1)
  })

  it('ignores an irrelevant input connecting', () => {
    connect(7, 9)
    const { node } = setup(['image', 'other'])

    nodeBadges(node)
    const initial = getNodeDisplayPrice.mock.calls.length

    connect(1, 3)
    nodeBadges(node)

    expect(getNodeDisplayPrice.mock.calls.length).toBe(initial)
  })
})
