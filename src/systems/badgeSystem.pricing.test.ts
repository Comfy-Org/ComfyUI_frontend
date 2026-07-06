import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeBadgeStore } from '@/stores/nodeBadgeStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

import { startBadgeSystem } from './badgeSystem'

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

describe('badge system pricing input connectivity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    getNodeDisplayPrice.mockClear()
  })

  function setup(inputNames: string[]) {
    const node = new ApiNode('api')
    node.id = toNodeId(5)
    node.type = 'ApiNode'
    for (const name of inputNames) node.addInput(name, 'IMAGE')

    useNodeBadgeStore().registerNode(graphId, node.id)
    const stop = startBadgeSystem({
      graphId,
      resolveNode: (id) => (id === node.id ? node : undefined)
    })
    return { node, stop }
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

  it('recomputes when a pricing-relevant input connects and disconnects', async () => {
    const { stop } = setup(['image', 'other'])
    const evaluations = () => getNodeDisplayPrice.mock.calls.length
    const initial = evaluations()

    connect(0, 1)
    await nextTick()
    expect(evaluations()).toBe(initial + 1)

    const linkStore = useLinkStore()
    const topology = linkStore.getInputSlotLink(graphId, toNodeId(5), 0)!
    linkStore.deleteLink(graphId, topology)
    await nextTick()
    expect(evaluations()).toBe(initial + 2)

    stop()
  })

  it('recomputes when an input-group input connects', async () => {
    const { stop } = setup(['image', 'ref_images.img0'])
    const initial = getNodeDisplayPrice.mock.calls.length

    connect(1, 2)
    await nextTick()

    expect(getNodeDisplayPrice.mock.calls.length).toBe(initial + 1)
    stop()
  })

  it('ignores an irrelevant input connecting', async () => {
    connect(7, 9)
    const { stop } = setup(['image', 'other'])
    const initial = getNodeDisplayPrice.mock.calls.length

    connect(1, 3)
    await nextTick()

    expect(getNodeDisplayPrice.mock.calls.length).toBe(initial)
    stop()
  })
})
