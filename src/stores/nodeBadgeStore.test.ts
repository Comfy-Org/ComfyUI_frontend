import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { computed } from 'vue'

import type { BadgeData } from '@/types/badgeData'
import { toNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

import { useNodeBadgeStore } from './nodeBadgeStore'

const graphA: UUID = 'graph-a'
const graphB: UUID = 'graph-b'
const node1 = toNodeId(1)
const node2 = toNodeId(2)

function idRow(text: string): BadgeData {
  return { kind: 'core', part: 'id', text }
}

describe('useNodeBadgeStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('replaces rows wholesale and reads them back', () => {
    const store = useNodeBadgeStore()
    store.registerNode(graphA, node1)
    store.setBadges(graphA, node1, [idRow('#1')])

    expect(store.getBadges(graphA, node1)).toEqual([idRow('#1')])
    expect(store.getBadges(graphA, node2)).toEqual([])

    store.setBadges(graphA, node1, [
      idRow('#1'),
      { kind: 'credits', text: '$0.04' }
    ])
    expect(store.getBadges(graphA, node1).map((b) => b.text)).toEqual([
      '#1',
      '$0.04'
    ])
  })

  it('returns an identity-stable array until the next write', () => {
    const store = useNodeBadgeStore()
    store.registerNode(graphA, node1)
    store.setBadges(graphA, node1, [idRow('#1')])

    const first = store.getBadges(graphA, node1)
    expect(store.getBadges(graphA, node1)).toBe(first)

    store.setBadges(graphA, node1, [idRow('#1 beta')])
    expect(store.getBadges(graphA, node1)).not.toBe(first)
  })

  it('recomputes reads when rows are rewritten', () => {
    const store = useNodeBadgeStore()
    store.registerNode(graphA, node1)
    store.setBadges(graphA, node1, [idRow('#1')])

    const texts = computed(() =>
      store.getBadges(graphA, node1).map((b) => b.text)
    )
    expect(texts.value).toEqual(['#1'])

    store.setBadges(graphA, node1, [idRow('#1 beta')])

    expect(texts.value).toEqual(['#1 beta'])
  })

  it('registers a node with no rows and lists it', () => {
    const store = useNodeBadgeStore()
    store.registerNode(graphA, node1)

    expect(store.registeredNodeIds(graphA)).toEqual([node1])
    expect(store.getBadges(graphA, node1)).toEqual([])
    expect(store.registeredNodeIds(graphB)).toEqual([])
  })

  it('tracks registration changes reactively', () => {
    const store = useNodeBadgeStore()
    store.registerNode(graphA, node1)

    const ids = computed(() => store.registeredNodeIds(graphA))
    expect(ids.value).toEqual([node1])

    store.registerNode(graphA, node2)
    expect(ids.value).toEqual([node1, node2])

    store.unregisterNode(graphA, node2)
    expect(ids.value).toEqual([node1])
  })

  it('unregisters a node without touching its neighbours', () => {
    const store = useNodeBadgeStore()
    store.registerNode(graphA, node1)
    store.registerNode(graphA, node2)
    store.setBadges(graphA, node1, [idRow('#1')])
    store.setBadges(graphA, node2, [idRow('#2')])

    store.unregisterNode(graphA, node1)

    expect(store.getBadges(graphA, node1)).toEqual([])
    expect(store.registeredNodeIds(graphA)).toEqual([node2])
    expect(store.getBadges(graphA, node2)).toHaveLength(1)
  })

  it('refuses row writes for unregistered nodes', () => {
    const store = useNodeBadgeStore()

    store.setBadges(graphA, node1, [idRow('#1')])

    expect(store.registeredNodeIds(graphA)).toEqual([])
    expect(store.getBadges(graphA, node1)).toEqual([])
  })

  it('does not resurrect a node unregistered mid-flight', () => {
    const store = useNodeBadgeStore()
    store.registerNode(graphA, node1)
    store.setBadges(graphA, node1, [idRow('#1')])

    store.unregisterNode(graphA, node1)
    store.setBadges(graphA, node1, [idRow('#1')])

    expect(store.registeredNodeIds(graphA)).toEqual([])
  })

  it('scopes buckets by graph', () => {
    const store = useNodeBadgeStore()
    store.registerNode(graphA, node1)
    store.registerNode(graphB, node1)
    store.setBadges(graphA, node1, [idRow('a')])
    store.setBadges(graphB, node1, [idRow('b')])

    store.clearGraph(graphB)

    expect(store.getBadges(graphA, node1)).toHaveLength(1)
    expect(store.getBadges(graphB, node1)).toEqual([])
  })

  it('wakes membership readers when a new bucket appears', () => {
    const store = useNodeBadgeStore()

    const ids = computed(() => store.registeredNodeIds(graphA))
    expect(ids.value).toEqual([])

    store.registerNode(graphA, node1)

    expect(ids.value).toEqual([node1])
  })
})
