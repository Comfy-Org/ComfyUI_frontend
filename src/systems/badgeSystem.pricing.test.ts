import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

import { nodeBadges } from './badgeSystem'

let displayPrice = '$disconnected'
const getNodeDisplayPrice = vi.fn(() => displayPrice)

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

function scopeOf(id: string) {
  return { rootGraphId: toRootGraphId(id), owningGraphId: toOwningGraphId(id) }
}

describe('badge derivation pricing input connectivity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    displayPrice = '$disconnected'
    getNodeDisplayPrice.mockClear()
  })

  function setup(inputNames: string[]) {
    const node = new ApiNode('api', 'ApiNode')
    node.id = toNodeId(5)
    for (const name of inputNames) node.addInput(name, 'IMAGE')
    const graph = new LGraph()
    graph.id = graphId
    node.graph = graph
    return { node }
  }

  function connect(slot: number, linkId: number, targetGraphId = graphId) {
    const scope = scopeOf(targetGraphId)
    useLinkStore().registerLink(scope, {
      id: toLinkId(linkId),
      graphId: scope.owningGraphId,
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

    displayPrice = '$connected'
    connect(0, 1)
    expect(nodeBadges(node).at(-1)?.text).toBe('$connected')

    displayPrice = '$disconnected'
    const linkStore = useLinkStore()
    const topology = linkStore.getInputSlotLink(
      scopeOf(graphId),
      toNodeId(5),
      0
    )!
    linkStore.deleteLink(scopeOf(graphId), topology)
    expect(nodeBadges(node).at(-1)?.text).toBe('$disconnected')
  })

  it('recomputes when an input-group input connects', () => {
    const { node } = setup(['image', 'ref_images.img0'])

    expect(nodeBadges(node).at(-1)?.text).toBe('$disconnected')

    displayPrice = '$connected'
    connect(1, 2)
    expect(nodeBadges(node).at(-1)?.text).toBe('$connected')
  })

  it('ignores an irrelevant input connecting', () => {
    connect(7, 9)
    const { node } = setup(['image', 'other'])

    expect(nodeBadges(node).at(-1)?.text).toBe('$disconnected')

    displayPrice = '$connected'
    connect(1, 3)
    expect(nodeBadges(node).at(-1)?.text).toBe('$disconnected')
  })

  it('uses graph-keyed pricing state after the root graph id changes', () => {
    const { node } = setup(['image'])
    expect(nodeBadges(node).at(-1)?.text).toBe('$disconnected')

    const reloadedGraphId: UUID = 'graph-pricing-reloaded'
    node.graph!.rootGraph.id = reloadedGraphId
    displayPrice = '$connected'
    connect(0, 4, reloadedGraphId)

    expect(nodeBadges(node).at(-1)?.text).toBe('$connected')
  })
})
