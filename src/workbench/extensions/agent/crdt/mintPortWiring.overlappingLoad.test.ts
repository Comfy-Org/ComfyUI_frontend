import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { GraphScope } from '@/types/graphScopeId'
import type { LinkTopology } from '@/types/linkTopology'

import { beginGraphLoad, settleGraphLoad } from '@/base/graphLoadLifecycle'
import { useLinkStore } from '@/stores/linkStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import { attachMintPortWiring } from '@/workbench/extensions/agent/crdt/mintPortWiring'
import type { MintPortWiring } from '@/workbench/extensions/agent/crdt/mintPortWiring'

const ROOT_ID = 'root-uuid'
const ROOT_SCOPE: GraphScope = {
  rootGraphId: toRootGraphId(ROOT_ID),
  owningGraphId: toOwningGraphId(ROOT_ID)
}

function topology(id: number): LinkTopology {
  return {
    id: toLinkId(id),
    graphId: toOwningGraphId(ROOT_ID),
    originNodeId: toNodeId(1),
    originSlot: 0,
    targetNodeId: toNodeId(2),
    targetSlot: id,
    type: 'IMAGE'
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => {}
  const promise = new Promise<void>((fulfill) => {
    resolve = fulfill
  })
  return { promise, resolve }
}

async function runGraphLoad(pause: Promise<void>): Promise<void> {
  const token = beginGraphLoad()
  await pause
  settleGraphLoad(token)
}

describe('overlapping graph-load mint suppression', () => {
  let wiring: MintPortWiring | undefined
  let minted: GraphOperation[]

  beforeEach(() => {
    setActivePinia(createPinia())
    minted = []
    wiring = attachMintPortWiring({
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: (operations) => minted.push(...operations),
      layoutChanges: () => () => {},
      localActorPrefix: 'user-',
      getGraph: () => ({
        id: ROOT_ID,
        rootGraph: { id: ROOT_ID },
        getNodeById: () => null,
        _nodes: []
      })
    })
  })

  afterEach(() => wiring?.detach())

  it('keeps a replacement load suppressed when a stale load settles', async () => {
    const pauseA = deferred()
    const pauseB = deferred()
    const loadA = runGraphLoad(pauseA.promise)
    const loadB = runGraphLoad(pauseB.promise)
    useLinkStore().registerLink(ROOT_SCOPE, topology(1))
    expect(minted).toEqual([])

    pauseA.resolve()
    await loadA
    useLinkStore().registerLink(ROOT_SCOPE, topology(2))
    expect(minted).toEqual([])

    pauseB.resolve()
    await loadB
    useLinkStore().registerLink(ROOT_SCOPE, topology(3))

    expect(minted).toEqual([
      {
        op: 'connect',
        link_id: 3,
        from_node: toNodeId(1),
        from_slot: 0,
        to_node: toNodeId(2),
        to_slot: 3,
        link_type: 'IMAGE'
      }
    ])
  })

  it('keeps suppression active when the newer load settles first', async () => {
    const pauseA = deferred()
    const pauseB = deferred()
    const loadA = runGraphLoad(pauseA.promise)
    const loadB = runGraphLoad(pauseB.promise)

    pauseB.resolve()
    await loadB
    useLinkStore().registerLink(ROOT_SCOPE, topology(1))
    expect(minted).toEqual([])

    pauseA.resolve()
    await loadA
    useLinkStore().registerLink(ROOT_SCOPE, topology(2))

    expect(minted).toEqual([
      {
        op: 'connect',
        link_id: 2,
        from_node: toNodeId(1),
        from_slot: 0,
        to_node: toNodeId(2),
        to_slot: 2,
        link_type: 'IMAGE'
      }
    ])
  })
})
