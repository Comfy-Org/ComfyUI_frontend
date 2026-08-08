import { describe, expect, it } from 'vitest'

import {
  createLGraphState,
  mintGroupId,
  mintLinkId,
  mintNodeId,
  mintRerouteId,
  observeGroupId,
  observeLinkId,
  observeNodeId,
  observeRerouteId,
  restoreIdState,
  snapshotIdState
} from '@/types/idAllocation'
import { toGroupId } from '@/types/groupId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'

describe('idAllocation', () => {
  it('mints increasing ids for each entity kind', () => {
    const state = createLGraphState()

    expect([mintNodeId(state), mintNodeId(state)]).toEqual(['1', '2'])
    expect([mintGroupId(state), mintGroupId(state)]).toEqual([1, 2])
    expect([mintLinkId(state), mintLinkId(state)]).toEqual([1, 2])
    expect([mintRerouteId(state), mintRerouteId(state)]).toEqual([1, 2])
  })

  it('observes higher ids and ignores lower ids', () => {
    const state = createLGraphState()

    observeNodeId(state, toNodeId(4))
    observeNodeId(state, toNodeId(2))
    observeGroupId(state, toGroupId(5))
    observeGroupId(state, toGroupId(3))
    observeLinkId(state, toLinkId(6))
    observeLinkId(state, toLinkId(4))
    observeRerouteId(state, toRerouteId(7))
    observeRerouteId(state, toRerouteId(5))

    expect(state).toEqual({
      lastGroupId: 5,
      lastNodeId: 4,
      lastLinkId: 6,
      lastRerouteId: 7
    })
  })

  it('observes numeric-string node ids', () => {
    const state = createLGraphState()

    observeNodeId(state, toNodeId('12'))
    observeNodeId(state, toNodeId('named'))

    expect(state.lastNodeId).toBe(12)
  })

  it('restores a snapshot in place', () => {
    const state = createLGraphState()
    const snapshot = snapshotIdState(state)
    mintNodeId(state)
    mintLinkId(state)

    restoreIdState(state, snapshot)

    expect(state).toEqual(snapshot)
  })
})
