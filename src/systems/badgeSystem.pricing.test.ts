import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { bumpGraphStructureRevision } from '@/lib/litegraph/src/graphStructureRevision'
import { useLinkStore } from '@/stores/linkStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

import { nodeBadges } from './badgeSystem'

const getNodeDisplayPrice = vi.fn((node: LGraphNode) => {
  const currentGraphId = node.graph?.rootGraph.id
  if (currentGraphId === undefined) return '$disconnected'
  const connected = node.inputs.some(
    (input, index) =>
      (input.name === 'image' || input.name?.startsWith('ref_images.')) &&
      useLinkStore().isInputSlotConnected(currentGraphId, node.id, index)
  )
  return connected ? '$connected' : '$disconnected'
})

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

  function connect(slot: number, linkId: number, targetGraphId = graphId) {
    useLinkStore().registerLink(targetGraphId, {
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
    expect(nodeBadges(node).at(-1)?.text).toBe('$disconnected')

    connect(0, 1)
    expect(nodeBadges(node).at(-1)?.text).toBe('$connected')

    const linkStore = useLinkStore()
    const topology = linkStore.getInputSlotLink(graphId, toNodeId(5), 0)!
    linkStore.deleteLink(graphId, topology)
    expect(nodeBadges(node).at(-1)?.text).toBe('$disconnected')
  })

  it('recomputes when an input-group input connects', () => {
    const { node } = setup(['image', 'ref_images.img0'])

    expect(nodeBadges(node).at(-1)?.text).toBe('$disconnected')

    connect(1, 2)
    expect(nodeBadges(node).at(-1)?.text).toBe('$connected')
  })

  it('ignores an irrelevant input connecting', () => {
    connect(7, 9)
    const { node } = setup(['image', 'other'])

    expect(nodeBadges(node).at(-1)?.text).toBe('$disconnected')

    connect(1, 3)
    expect(nodeBadges(node).at(-1)?.text).toBe('$disconnected')
  })

  it('uses graph-keyed pricing state after the root graph id changes', () => {
    const { node } = setup(['image'])
    expect(nodeBadges(node).at(-1)?.text).toBe('$disconnected')

    const reloadedGraphId: UUID = 'graph-pricing-reloaded'
    node.graph!.rootGraph.id = reloadedGraphId
    connect(0, 4, reloadedGraphId)
    bumpGraphStructureRevision()

    expect(nodeBadges(node).at(-1)?.text).toBe('$connected')
  })
})
