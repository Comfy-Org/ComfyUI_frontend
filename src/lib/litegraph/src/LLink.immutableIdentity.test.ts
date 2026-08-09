import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'

function createRewireGraph() {
  const graph = new LGraph()
  const sourceA = createTestNode(graph, [], ['number'], 'source A')
  const sourceB = createTestNode(graph, [], ['number'], 'source B')
  const target = createTestNode(graph, ['number'], [], 'target')

  return { graph, sourceA, sourceB, target }
}

describe('LLink immutable registered identity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.resetForTests()
  })

  it('given an occupied input, when rewired, then it creates a new link identity', () => {
    const { graph, sourceA, sourceB, target } = createRewireGraph()
    const oldLink = sourceA.connect(0, target, 0)!

    const newLink = sourceB.connect(0, target, 0)!

    const store = useLinkStore()
    const scope = graphScopeOf(graph)
    expect(newLink.id).not.toBe(oldLink.id)
    expect(graph.links.has(oldLink.id)).toBe(false)
    expect(store.getLink(scope, oldLink.id)).toBeUndefined()
    expect(newLink).toMatchObject({
      origin_id: sourceB.id,
      origin_slot: 0,
      target_id: target.id,
      target_slot: 0
    })
  })

  it.fails('given a registered link, when its endpoints are assigned, then its endpoint tuple remains immutable', () => {
    const { sourceA, sourceB, target } = createRewireGraph()
    const link = sourceA.connect(0, target, 0)!
    const snapshot = link.asSerialisable()

    link.origin_id = sourceB.id
    link.origin_slot = 1
    link.target_id = sourceA.id
    link.target_slot = 2

    expect(link.asSerialisable()).toEqual(snapshot)
  })

  it('given an occupied input, when rewired, then store indexes contain no stale old link', () => {
    const { graph, sourceA, sourceB, target } = createRewireGraph()
    const oldLink = sourceA.connect(0, target, 0)!

    const newLink = sourceB.connect(0, target, 0)!

    const store = useLinkStore()
    const scope = graphScopeOf(graph)
    expect(store.getLink(scope, oldLink.id)).toBeUndefined()
    expect(store.getInputSlotLink(scope, target.id, 0)?.id).toBe(newLink.id)
    expect(
      [...store.getOutputSlotLinks(scope, sourceA.id, 0)].map(({ id }) => id)
    ).not.toContain(oldLink.id)
    expect(
      [...store.getOutputSlotLinks(scope, sourceB.id, 0)].map(({ id }) => id)
    ).toContain(newLink.id)
  })

  it('given a rerouted link, when rewired, then reroute membership excludes the dead link', () => {
    const { graph, sourceA, sourceB, target } = createRewireGraph()
    const oldLink = sourceA.connect(0, target, 0)!
    const reroute = graph.createReroute([10, 10], oldLink)!

    const newLink = sourceB.connect(0, target, 0, reroute.id)!

    expect(reroute.linkIds.has(oldLink.id)).toBe(false)
    expect(
      reroute.linkIds.has(newLink.id) || !graph.reroutes.has(reroute.id)
    ).toBe(true)
  })

  it('given a rerouted link, when its input disconnects, then all registrations are removed', () => {
    const { graph, sourceA, target } = createRewireGraph()
    const link = sourceA.connect(0, target, 0)!
    const reroute = graph.createReroute([10, 10], link)!
    const scope = graphScopeOf(graph)

    target.disconnectInput(0)

    expect(graph.links.has(link.id)).toBe(false)
    expect(useLinkStore().getLink(scope, link.id)).toBeUndefined()
    expect(reroute.linkIds.has(link.id)).toBe(false)
  })

  it('given connected later outputs, when an output is removed, then shifted links receive new identities', () => {
    const graph = new LGraph()
    const source = createTestNode(graph, [], ['number', 'number', 'number'])
    const firstTarget = createTestNode(graph, ['number'], [])
    const secondTarget = createTestNode(graph, ['number'], [])
    const first = source.connect(1, firstTarget, 0)!
    const second = source.connect(2, secondTarget, 0)!
    layoutStore.updateLinkLayout(first.id, {
      id: first.id,
      path: fromPartial<Path2D>({}),
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      centerPos: { x: 0, y: 0 },
      sourceNodeId: source.id,
      targetNodeId: firstTarget.id,
      sourceSlot: 1,
      targetSlot: 0
    })

    source.removeOutput(0)

    const shiftedFirst = firstTarget.getInputLink(0)!
    const shiftedSecond = secondTarget.getInputLink(0)!
    const store = useLinkStore()
    const scope = graphScopeOf(graph)
    expect([shiftedFirst.origin_slot, shiftedSecond.origin_slot]).toEqual([
      0, 1
    ])
    expect(shiftedFirst.id).not.toBe(first.id)
    expect(shiftedSecond.id).not.toBe(second.id)
    expect(graph.links.has(first.id)).toBe(false)
    expect(graph.links.has(second.id)).toBe(false)
    expect(store.getLink(scope, first.id)).toBeUndefined()
    expect(store.getLink(scope, second.id)).toBeUndefined()
    expect(layoutStore.getLinkLayout(first.id)).toBeNull()
  })
})
