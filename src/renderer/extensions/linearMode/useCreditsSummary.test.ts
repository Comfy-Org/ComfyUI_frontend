import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCreditsSummary } from '@/renderer/extensions/linearMode/useCreditsSummary'

const appMock = vi.hoisted(() => ({
  isGraphReady: true,
  graph: { nodes: [] as unknown[] }
}))

const trackNodePrice = vi.hoisted(() => vi.fn())

vi.mock('@/scripts/app', () => ({ app: appMock }))

vi.mock('@/composables/node/usePriceBadge', () => ({
  usePriceBadge: () => ({
    isCreditsBadge: (badge: { credits?: boolean }) => badge?.credits === true
  })
}))

vi.mock(
  '@/renderer/extensions/vueNodes/composables/usePartitionedBadges',
  () => ({ trackNodePrice })
)

interface FakeNode {
  id: string
  title: string
  badges: unknown[]
  isSubgraphNode: () => boolean
  subgraph?: { nodes: FakeNode[] }
}

function node(id: string, title: string, badges: unknown[] = []): FakeNode {
  return { id, title, badges, isSubgraphNode: () => false }
}

function subgraphNode(id: string, inner: FakeNode[] = []): FakeNode {
  return {
    id,
    title: 'group',
    badges: [],
    isSubgraphNode: () => true,
    subgraph: { nodes: inner }
  }
}

const creditsBadge = (text: string) => ({ text, credits: true })

beforeEach(() => {
  appMock.isGraphReady = true
  appMock.graph = { nodes: [] }
  trackNodePrice.mockClear()
})

describe('useCreditsSummary', () => {
  it('returns nothing until the graph is ready', () => {
    appMock.isGraphReady = false
    appMock.graph = { nodes: [node('a', 'A', [creditsBadge('99')])] }

    expect(useCreditsSummary().creditsBadges.value).toEqual([])
  })

  it('summarizes only priced leaf nodes as title/price/nodeId', () => {
    appMock.graph = {
      nodes: [
        node('a', 'Flux', [creditsBadge('99 credits/Run')]),
        node('b', 'Free Node', [{ text: 'no cost' }]),
        subgraphNode('s', [node('c', 'Inner', [creditsBadge('12 credits')])])
      ]
    }

    expect(useCreditsSummary().creditsBadges.value).toEqual([
      { title: 'Flux', price: '99 credits/Run', nodeId: 'a' },
      { title: 'Inner', price: '12 credits', nodeId: 'c' }
    ])
  })

  it('tracks pricing dependencies only for the priced nodes', () => {
    appMock.graph = {
      nodes: [
        node('a', 'Flux', [creditsBadge('99')]),
        node('b', 'Free Node', [])
      ]
    }

    expect(useCreditsSummary().creditsBadges.value).toHaveLength(1)

    expect(trackNodePrice).toHaveBeenCalledTimes(1)
    expect(trackNodePrice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a' })
    )
  })
})
