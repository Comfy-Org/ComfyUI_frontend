import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import { toNodeId, UNASSIGNED_NODE_ID } from '@/types/nodeId'
import type { RerouteChain } from '@/types/rerouteChain'
import { toRerouteId } from '@/types/rerouteId'

import { useLinkStore } from './linkStore'
import { EMPTY_MEMBERSHIP, useRerouteStore } from './rerouteStore'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mockReportError
}))

const graphA = {
  rootGraphId: toRootGraphId('graph-a'),
  owningGraphId: toOwningGraphId('graph-a')
}
const graphB = {
  rootGraphId: toRootGraphId('graph-b'),
  owningGraphId: toOwningGraphId('graph-b')
}
const graphASibling = {
  rootGraphId: graphA.rootGraphId,
  owningGraphId: toOwningGraphId('graph-a-sibling')
}

function chain(id: number, parentId?: number): RerouteChain {
  return {
    id: toRerouteId(id),
    graphId: graphA.owningGraphId,
    parentId: parentId === undefined ? undefined : toRerouteId(parentId)
  }
}

function link(id: number, targetSlot: number, parentId?: number): LinkTopology {
  return {
    id: toLinkId(id),
    graphId: graphA.owningGraphId,
    originNodeId: toNodeId(5),
    originSlot: 0,
    targetNodeId: toNodeId(9),
    targetSlot,
    type: 'INT',
    parentId: parentId === undefined ? undefined : toRerouteId(parentId)
  }
}

describe('useRerouteStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('refuses to overwrite a registration held by a different chain', () => {
    const store = useRerouteStore()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const owner = store.registerReroute(graphA, chain(1))
    assert(owner)

    expect(store.registerReroute(graphA, owner)).toBe(owner)

    const usurper = chain(1, 7)
    expect(store.registerReroute(graphA, usurper)).toBeUndefined()
    expect(error).toHaveBeenCalledOnce()
    expect(mockReportError).toHaveBeenCalledWith(expect.any(String), {
      errorType: 'reroute_store_ownership_conflict'
    })

    expect(store.deleteReroute(graphA, usurper)).toBe(false)
    expect(store.getReroute(graphA, toRerouteId(1))).toBe(owner)

    owner.parentId = toRerouteId(3)
    expect(store.getReroute(graphA, toRerouteId(1))?.parentId).toBe(3)
    expect(store.deleteReroute(graphA, owner)).toBe(true)
  })

  it('rejects the registered reroute identity from a sibling owner', () => {
    const store = useRerouteStore()
    const registered = store.registerReroute(graphA, chain(1))
    assert(registered)

    expect(store.registerReroute(graphASibling, registered)).toBeUndefined()
    expect(registered.graphId).toBe(graphA.owningGraphId)
    expect(store.getReroute(graphA, registered.id)).toBe(registered)
    expect(store.getReroute(graphASibling, registered.id)).toBeUndefined()
  })

  it('deletes a chain; only the registered state may vacate it', () => {
    const store = useRerouteStore()
    const registered = store.registerReroute(graphA, chain(1))
    assert(registered)

    expect(store.deleteReroute(graphA, chain(1))).toBe(false)
    expect(store.getReroute(graphA, toRerouteId(1))).toBeDefined()

    expect(store.deleteReroute(graphA, registered)).toBe(true)
    expect(store.getReroute(graphA, toRerouteId(1))).toBeUndefined()
    expect(store.deleteReroute(graphA, registered)).toBe(false)
  })

  it('reuses a deleted reroute id for a replacement chain', () => {
    const store = useRerouteStore()
    const registered = store.registerReroute(graphA, chain(1))
    assert(registered)
    const current = computed(() => store.getReroute(graphA, registered.id))
    expect(current.value).toBe(registered)

    store.deleteReroute(graphA, registered)
    expect(current.value).toBeUndefined()

    const replacement = chain(1, 2)
    const reRegistered = store.registerReroute(graphA, replacement)
    expect(current.value).toBe(reRegistered)
  })

  it('tracks registration after reading membership from a missing scope', () => {
    const store = useRerouteStore()
    const membership = computed(() =>
      store.getMembership(graphA, toRerouteId(1))
    )
    expect(membership.value).toBe(EMPTY_MEMBERSHIP)

    store.registerReroute(graphA, chain(1))
    useLinkStore().registerLink(graphA, link(10, 0, 1))

    expect([...membership.value.linkIds]).toEqual([10])
  })

  it('derives membership from the links’ parentId chains', () => {
    const store = useRerouteStore()
    const linkStore = useLinkStore()
    store.registerReroute(graphA, chain(1))
    store.registerReroute(graphA, chain(2, 1))
    linkStore.registerLink(graphA, link(10, 0, 2))
    linkStore.registerLink(graphA, link(11, 1, 1))
    linkStore.registerLink(graphA, link(12, 2))

    const terminal = store.getMembership(graphA, toRerouteId(2))
    const upstream = store.getMembership(graphA, toRerouteId(1))

    expect([...terminal.linkIds]).toEqual([10])
    expect([...upstream.linkIds]).toEqual([10, 11])
    expect(terminal.floatingLinkIds.size).toBe(0)
  })

  it('excludes missing and sibling-owned reroutes from membership', () => {
    const store = useRerouteStore()
    const linkStore = useLinkStore()
    store.registerReroute(graphA, chain(1))
    store.registerReroute(graphASibling, chain(2, 1))
    linkStore.registerLink(graphA, link(10, 0, 3))
    linkStore.registerLink(graphA, link(11, 1, 2))

    expect(store.getMembership(graphA, toRerouteId(3))).toBe(EMPTY_MEMBERSHIP)
    expect(store.getMembership(graphA, toRerouteId(2))).toBe(EMPTY_MEMBERSHIP)
    expect(store.getMembership(graphA, toRerouteId(1))).toBe(EMPTY_MEMBERSHIP)
  })

  it('splits floating links into floatingLinkIds', () => {
    const store = useRerouteStore()
    const linkStore = useLinkStore()
    store.registerReroute(graphA, chain(1))
    linkStore.registerLink(graphA, {
      ...link(10, 0, 1),
      targetNodeId: UNASSIGNED_NODE_ID,
      targetSlot: -1
    })

    const membership = store.getMembership(graphA, toRerouteId(1))

    expect([...membership.floatingLinkIds]).toEqual([10])
    expect(membership.linkIds.size).toBe(0)
  })

  it('updates membership when a link’s parentId changes', () => {
    const store = useRerouteStore()
    const linkStore = useLinkStore()
    store.registerReroute(graphA, chain(1))
    const registered = linkStore.registerLink(graphA, link(10, 0))
    assert(registered)

    expect(store.getMembership(graphA, toRerouteId(1)).linkIds.size).toBe(0)

    registered.parentId = toRerouteId(1)

    expect([...store.getMembership(graphA, toRerouteId(1)).linkIds]).toEqual([
      10
    ])
  })

  it('updates membership when a reroute is re-parented', () => {
    const store = useRerouteStore()
    const linkStore = useLinkStore()
    store.registerReroute(graphA, chain(1))
    const terminal = store.registerReroute(graphA, chain(2))
    assert(terminal)
    linkStore.registerLink(graphA, link(10, 0, 2))

    expect(store.getMembership(graphA, toRerouteId(1)).linkIds.size).toBe(0)

    terminal.parentId = toRerouteId(1)

    expect([...store.getMembership(graphA, toRerouteId(1)).linkIds]).toEqual([
      10
    ])
  })

  it('terminates membership walks on parentId cycles', () => {
    const store = useRerouteStore()
    const linkStore = useLinkStore()
    store.registerReroute(graphA, chain(1, 2))
    store.registerReroute(graphA, chain(2, 1))
    linkStore.registerLink(graphA, link(10, 0, 2))

    expect([...store.getMembership(graphA, toRerouteId(1)).linkIds]).toEqual([
      10
    ])
    expect([...store.getMembership(graphA, toRerouteId(2)).linkIds]).toEqual([
      10
    ])
  })

  it('scopes buckets by graph', () => {
    const store = useRerouteStore()
    store.registerReroute(graphA, chain(1))
    store.registerReroute(graphB, chain(1, 7))

    expect(store.getReroute(graphA, toRerouteId(1))?.parentId).toBeUndefined()
    expect(store.getReroute(graphB, toRerouteId(1))?.parentId).toBe(7)

    store.clearGraph(graphB.rootGraphId)

    expect(store.getReroute(graphA, toRerouteId(1))).toBeDefined()
    expect(store.getReroute(graphB, toRerouteId(1))).toBeUndefined()
  })

  it('rejects a duplicate id before assigning it to the requesting graph', () => {
    const store = useRerouteStore()
    const first = chain(1)
    const duplicate = chain(1, 7)

    const registered = store.registerReroute(graphA, first)
    const rejected = store.registerReroute(graphASibling, duplicate)

    expect(registered?.id).toBe(first.id)
    expect(rejected).toBeUndefined()
    expect(duplicate).not.toHaveProperty('graphId', graphASibling.owningGraphId)
    expect(store.getReroute(graphA, toRerouteId(1))).toBe(registered)
    expect(store.getReroute(graphASibling, toRerouteId(1))).toBeUndefined()
  })

  it('only deletes the registered identity from its owning graph', () => {
    const store = useRerouteStore()
    const registered = store.registerReroute(graphA, chain(1))
    assert(registered)
    const impostor = chain(1)

    expect(store.deleteReroute(graphASibling, registered)).toBe(false)
    expect(store.deleteReroute(graphA, impostor)).toBe(false)
    expect(store.getReroute(graphA, toRerouteId(1))).toBe(registered)
  })

  it('isolates chains and memberships by owner', () => {
    const store = useRerouteStore()
    const linkStore = useLinkStore()
    store.registerReroute(graphA, chain(1))
    store.registerReroute(graphASibling, chain(2, 7))
    linkStore.registerLink(graphA, link(10, 0, 1))
    linkStore.registerLink(graphASibling, link(20, 0, 2))

    expect([...store.getMembership(graphA, toRerouteId(1)).linkIds]).toEqual([
      10
    ])
    expect([
      ...store.getMembership(graphASibling, toRerouteId(2)).linkIds
    ]).toEqual([20])

    store.clearOwner(graphA)

    expect(store.getReroute(graphA, toRerouteId(1))).toBeUndefined()
    expect(store.getReroute(graphASibling, toRerouteId(2))?.parentId).toBe(7)

    store.clearGraph(graphA.rootGraphId)

    expect(store.getReroute(graphASibling, toRerouteId(2))).toBeUndefined()
  })

  it('re-evaluates membership when a cleared owner is recreated', () => {
    const store = useRerouteStore()
    const linkStore = useLinkStore()
    store.registerReroute(graphA, chain(1))
    store.registerReroute(graphA, chain(2, 1))
    linkStore.registerLink(graphA, link(10, 0, 2))
    const membership = computed(() =>
      store.getMembership(graphA, toRerouteId(1))
    )
    expect([...membership.value.linkIds]).toEqual([10])

    store.clearOwner(graphA)
    expect(membership.value.linkIds.size).toBe(0)

    store.registerReroute(graphA, chain(1))
    store.registerReroute(graphA, chain(2, 1))

    expect([...membership.value.linkIds]).toEqual([10])
  })
})
