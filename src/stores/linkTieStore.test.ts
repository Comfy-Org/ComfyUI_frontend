import { describe, expect, it } from 'vitest'

import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'

import { useLinkTieStore } from './linkTieStore'

const graphA = {
  rootGraphId: toRootGraphId('graph-a'),
  owningGraphId: toOwningGraphId('graph-a')
}
const graphASubgraph = {
  rootGraphId: graphA.rootGraphId,
  owningGraphId: toOwningGraphId('graph-a-subgraph')
}

const A = toLinkId(1)
const B = toLinkId(2)
const C = toLinkId(3)

describe('useLinkTieStore', () => {
  it('numbers ties per graph', () => {
    const store = useLinkTieStore()

    const first = store.addTie(graphA, { pos: [0, 0], angle: 0, linkIds: [A] })
    const second = store.addTie(graphA, { pos: [0, 0], angle: 0, linkIds: [B] })
    const other = store.addTie(graphASubgraph, {
      pos: [0, 0],
      angle: 0,
      linkIds: [A]
    })

    expect([first.id, second.id, other.id]).toEqual([1, 2, 1])
    expect(store.getTies(graphASubgraph)).toEqual([other])
  })

  it('releases links from their ties, dropping ties left empty', () => {
    const store = useLinkTieStore()
    const shared = store.addTie(graphA, {
      pos: [10, 20],
      angle: 1,
      linkIds: [A, B, C]
    })
    store.addTie(graphA, { pos: [0, 0], angle: 0, linkIds: [B] })

    const released = store.releaseLinks(graphA, [B])

    expect(released).toEqual([
      { ...shared, linkIds: [B] },
      expect.objectContaining({ linkIds: [B] })
    ])
    expect(store.getTies(graphA)).toEqual([{ ...shared, linkIds: [A, C] }])
  })

  it('clears every graph under a root', () => {
    const store = useLinkTieStore()
    store.addTie(graphA, { pos: [0, 0], angle: 0, linkIds: [A] })
    store.addTie(graphASubgraph, { pos: [0, 0], angle: 0, linkIds: [A] })

    store.clearGraph(graphA.rootGraphId)

    expect(store.getTies(graphA)).toEqual([])
    expect(store.getTies(graphASubgraph)).toEqual([])
  })
})
