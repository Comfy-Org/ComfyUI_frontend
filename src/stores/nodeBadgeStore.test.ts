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

function badge(kind: BadgeData['kind'], text: string): BadgeData {
  return { kind, text }
}

describe('useNodeBadgeStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('registers a badge and reads it back', () => {
    const store = useNodeBadgeStore()
    store.registerBadge(graphA, node1, badge('extension', 'v2'))

    expect(store.getBadges(graphA, node1)).toEqual([
      { kind: 'extension', text: 'v2' }
    ])
    expect(store.getBadges(graphA, node2)).toEqual([])
  })

  it('orders rows by kind (core, credits, extension), not insertion', () => {
    const store = useNodeBadgeStore()
    store.registerBadge(graphA, node1, badge('extension', 'ext'))
    store.registerBadge(graphA, node1, badge('credits', '$0.04'))
    store.registerBadge(graphA, node1, badge('core', '#1'))

    expect(store.getBadges(graphA, node1).map((b) => b.kind)).toEqual([
      'core',
      'credits',
      'extension'
    ])
  })

  it('returns tracked rows whose writes are observable', () => {
    const store = useNodeBadgeStore()
    const row = store.registerBadge(graphA, node1, badge('extension', 'old'))

    const text = computed(() => store.getBadges(graphA, node1)[0]?.text)
    expect(text.value).toBe('old')

    row.text = 'new'

    expect(text.value).toBe('new')
  })

  it('deletes a row; only the registered row may vacate it', () => {
    const store = useNodeBadgeStore()
    const row = store.registerBadge(graphA, node1, badge('extension', 'v2'))

    expect(store.deleteBadge(graphA, node1, badge('extension', 'v2'))).toBe(
      false
    )
    expect(store.getBadges(graphA, node1)).toHaveLength(1)

    expect(store.deleteBadge(graphA, node1, row)).toBe(true)
    expect(store.getBadges(graphA, node1)).toHaveLength(0)
    expect(store.deleteBadge(graphA, node1, row)).toBe(false)
  })

  it('replaces only the written kind, preserving other kinds', () => {
    const store = useNodeBadgeStore()
    const kept = store.registerBadge(graphA, node1, badge('extension', 'ext'))
    store.setBadgesOfKind(graphA, node1, 'credits', [badge('credits', '$0.02')])

    store.setBadgesOfKind(graphA, node1, 'credits', [
      badge('credits', '$0.04'),
      badge('credits', '$0.06')
    ])

    const rows = store.getBadges(graphA, node1)
    expect(rows.map((b) => b.text)).toEqual(['$0.04', '$0.06', 'ext'])
    expect(store.deleteBadge(graphA, node1, kept)).toBe(true)
  })

  it('recomputes reads when a kind is rewritten', () => {
    const store = useNodeBadgeStore()
    store.setBadgesOfKind(graphA, node1, 'core', [badge('core', '#1')])

    const texts = computed(() =>
      store.getBadges(graphA, node1).map((b) => b.text)
    )
    expect(texts.value).toEqual(['#1'])

    store.setBadgesOfKind(graphA, node1, 'core', [badge('core', '#1 beta')])

    expect(texts.value).toEqual(['#1 beta'])
  })

  it('clears a node without touching its neighbours', () => {
    const store = useNodeBadgeStore()
    store.registerBadge(graphA, node1, badge('extension', 'a'))
    store.registerBadge(graphA, node2, badge('extension', 'b'))

    store.clearNode(graphA, node1)

    expect(store.getBadges(graphA, node1)).toEqual([])
    expect(store.getBadges(graphA, node2)).toHaveLength(1)
  })

  it('scopes buckets by graph', () => {
    const store = useNodeBadgeStore()
    store.registerBadge(graphA, node1, badge('extension', 'a'))
    store.registerBadge(graphB, node1, badge('extension', 'b'))

    store.clearGraph(graphB)

    expect(store.getBadges(graphA, node1)).toHaveLength(1)
    expect(store.getBadges(graphB, node1)).toEqual([])
  })
})
