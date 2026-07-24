import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { toLinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import { toNodeId, UNASSIGNED_NODE_ID } from '@/types/nodeId'
import type { RerouteChain } from '@/types/rerouteChain'
import { toRerouteId } from '@/types/rerouteId'
import type { UUID } from '@/utils/uuid'

import { useLinkStore } from './linkStore'
import { useRerouteStore } from './rerouteStore'

const graphA: UUID = 'graph-a'
const graphB: UUID = 'graph-b'

function chain(id: number, parentId?: number): RerouteChain {
  return {
    id: toRerouteId(id),
    parentId: parentId === undefined ? undefined : toRerouteId(parentId)
  }
}

function link(id: number, targetSlot: number, parentId?: number): LinkTopology {
  return {
    id: toLinkId(id),
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

  it('registers a chain and answers queries for it', () => {
    const store = useRerouteStore()
    store.registerReroute(graphA, chain(1))

    expect(store.getReroute(graphA, toRerouteId(1))?.id).toBe(1)
    expect(store.getReroute(graphA, toRerouteId(2))).toBeUndefined()
  })

  it('returns tracked state whose writes are observable', () => {
    const store = useRerouteStore()
    const registered = store.registerReroute(graphA, chain(2))

    const parentId = computed(
      () => store.getReroute(graphA, toRerouteId(2))?.parentId
    )
    expect(parentId.value).toBeUndefined()

    registered.parentId = toRerouteId(1)

    expect(parentId.value).toBe(1)
  })

  it('refuses to overwrite a registration held by a different chain', () => {
    const store = useRerouteStore()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const owner = store.registerReroute(graphA, chain(1))

    expect(store.registerReroute(graphA, owner)).toBe(owner)
    expect(warn).not.toHaveBeenCalled()

    const usurper = chain(1, 7)
    expect(store.registerReroute(graphA, usurper)).toBe(usurper)
    expect(warn).toHaveBeenCalledOnce()

    owner.parentId = toRerouteId(3)
    expect(store.getReroute(graphA, toRerouteId(1))?.parentId).toBe(3)
    expect(store.deleteReroute(graphA, owner)).toBe(true)

    warn.mockRestore()
  })

  it('deletes a chain; only the registered state may vacate it', () => {
    const store = useRerouteStore()
    const registered = store.registerReroute(graphA, chain(1))

    expect(store.deleteReroute(graphA, chain(1))).toBe(false)
    expect(store.getReroute(graphA, toRerouteId(1))).toBeDefined()

    expect(store.deleteReroute(graphA, registered)).toBe(true)
    expect(store.getReroute(graphA, toRerouteId(1))).toBeUndefined()
    expect(store.deleteReroute(graphA, registered)).toBe(false)
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
    const registered = linkStore.registerLink(graphA, link(10, 0))!

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

    store.clearGraph(graphB)

    expect(store.getReroute(graphA, toRerouteId(1))).toBeDefined()
    expect(store.getReroute(graphB, toRerouteId(1))).toBeUndefined()
  })
})
