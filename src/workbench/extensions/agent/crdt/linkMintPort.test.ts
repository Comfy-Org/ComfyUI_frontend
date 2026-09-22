import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RootGraphId } from '@/types/graphScopeId'
import { toRootGraphId } from '@/types/graphScopeId'

import type { GraphOperation } from './graphOperations'
import { attachLinkMintPort } from './linkMintPort'
import type {
  LinkMintPort,
  LinkScopeView,
  LinkTopologyView
} from './linkMintPort'
import { createMintSession } from './mintSession'
import type { MintSession } from './mintSession'

const ROOT_ID = 'root-uuid'
const ROOT_SCOPE: LinkScopeView = {
  rootGraphId: ROOT_ID,
  owningGraphId: ROOT_ID
}
/** Another tab's graph: the shared LGraph already carries it after a switch. */
const FOREIGN_SCOPE: LinkScopeView = {
  rootGraphId: 'other-uuid',
  owningGraphId: 'other-uuid'
}
const SUBGRAPH_SCOPE: LinkScopeView = {
  rootGraphId: 'root-uuid',
  owningGraphId: 'subgraph-uuid'
}

function topology(id: number): LinkTopologyView {
  return {
    id,
    originNodeId: 1,
    originSlot: 0,
    targetNodeId: 2,
    targetSlot: 3,
    type: 'IMAGE'
  }
}

async function afterSweep(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('attachLinkMintPort', () => {
  let minted: GraphOperation[]
  let port: LinkMintPort
  let enabled: boolean
  let bound: boolean
  let activeRootGraphId: RootGraphId | null
  let session: MintSession
  let placedListeners: Set<
    (scope: LinkScopeView, topology: LinkTopologyView) => void
  >
  let deletedListeners: Set<
    (scope: LinkScopeView, topology: LinkTopologyView) => void
  >

  function place(scope: LinkScopeView, link: LinkTopologyView): void {
    for (const listener of placedListeners) listener(scope, link)
  }

  function remove(scope: LinkScopeView, link: LinkTopologyView): void {
    for (const listener of deletedListeners) listener(scope, link)
  }

  beforeEach(() => {
    minted = []
    enabled = true
    bound = true
    activeRootGraphId = toRootGraphId(ROOT_ID)
    session = createMintSession()
    placedListeners = new Set()
    deletedListeners = new Set()
    port = attachLinkMintPort({
      events: {
        onPlaced: (listener) => {
          placedListeners.add(listener)
          return () => placedListeners.delete(listener)
        },
        onDeleted: (listener) => {
          deletedListeners.add(listener)
          return () => deletedListeners.delete(listener)
        }
      },
      session,
      isEnabled: () => enabled,
      isDocBound: () => bound,
      activeRootGraphId: () => activeRootGraphId,
      enqueue: (operations) => minted.push(...operations)
    })
  })

  it('mints a concrete connect for a local link placement', () => {
    place(ROOT_SCOPE, topology(41))

    expect(minted).toEqual([
      {
        op: 'connect',
        link_id: 41,
        from_node: 1,
        from_slot: 0,
        to_node: 2,
        to_slot: 3,
        link_type: 'IMAGE'
      }
    ])
  })

  it('never mints with the product flag off', () => {
    enabled = false
    place(ROOT_SCOPE, topology(41))

    expect(minted).toEqual([])
  })

  it('never mints without a bound doc', () => {
    bound = false
    place(ROOT_SCOPE, topology(41))

    expect(minted).toEqual([])
  })

  it('never mints inside a graph-teardown bracket (a load registers no storm)', () => {
    session.beginGraphTeardown()
    place(ROOT_SCOPE, topology(41))
    session.endGraphTeardown()

    expect(minted).toEqual([])
  })

  it('surfaces a subgraph-interior placement observably instead of minting', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    place(SUBGRAPH_SCOPE, topology(41))

    expect(minted).toEqual([])
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it('surfaces instead of minting a connect on a graph the activated document does not own', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    place(FOREIGN_SCOPE, topology(41))

    expect(minted).toEqual([])
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it('never mints a connect while no document is activated', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    activeRootGraphId = null

    place(ROOT_SCOPE, topology(41))

    expect(minted).toEqual([])
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it('never carries a foreign severance into a delete_node mint', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    remove(FOREIGN_SCOPE, topology(41))
    await afterSweep()

    // Captured for the delete that may follow, but not mintable: it belongs
    // to a graph this document does not own, so it is neither handed to a
    // mint nor surfaced as this document's divergence.
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('captures a severed link under both endpoints, consumed exactly once', () => {
    remove(ROOT_SCOPE, topology(41))

    expect(port.severances.take('2')).toEqual([41])
    expect(port.severances.take('1')).toEqual([])
  })

  it('surfaces an unconsumed local disconnect as divergence after the sweep', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    remove(ROOT_SCOPE, topology(41))
    await afterSweep()

    expect(consoleError).toHaveBeenCalledOnce()
    expect(consoleError.mock.calls[0][1]).toBe(41)
    consoleError.mockRestore()
  })

  it('stays silent for a consumed severance (the delete carried it)', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    remove(ROOT_SCOPE, topology(41))
    port.severances.take('1')
    await afterSweep()

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('stays silent for teardown severances', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    session.beginGraphTeardown()
    remove(ROOT_SCOPE, topology(41))
    session.endGraphTeardown()
    await afterSweep()

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('sweeps the capture window: a later take finds nothing', async () => {
    session.beginGraphTeardown()
    remove(ROOT_SCOPE, topology(41))
    session.endGraphTeardown()
    await afterSweep()

    expect(port.severances.take('1')).toEqual([])
    expect(port.severances.take('2')).toEqual([])
  })

  it('stops minting after detach', () => {
    port.detach()
    place(ROOT_SCOPE, topology(41))

    expect(minted).toEqual([])
  })
})
