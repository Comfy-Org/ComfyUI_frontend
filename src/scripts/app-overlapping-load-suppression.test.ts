import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'

import type { GraphScope } from '@/types/graphScopeId'
import type { LinkTopology } from '@/types/linkTopology'

import { useLinkStore } from '@/stores/linkStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import {
  attachMintPortWiring,
  type MintPortWiring
} from '@/workbench/extensions/agent/crdt/mintPortWiring'

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

describe('R-94 overlapping graph-load mint suppression', () => {
  let wiring: MintPortWiring | undefined

  afterEach(() => wiring?.detach())

  it('characterizes an outer close releasing suppression while a nested load remains active', () => {
    setActivePinia(createPinia())
    const minted: GraphOperation[] = []
    wiring = attachMintPortWiring({
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: (operations) => minted.push(...operations),
      layoutChanges: () => () => {},
      withLayoutActor: (_actor, apply) => apply(),
      localActorPrefix: 'user-',
      getGraph: () => ({
        id: ROOT_ID,
        rootGraph: { id: ROOT_ID },
        getNodeById: () => null,
        _nodes: []
      })
    })

    wiring.onBeforeGraphLoad()
    wiring.onBeforeGraphLoad()
    useLinkStore().registerLink(ROOT_SCOPE, topology(1))
    expect(minted).toEqual([])

    wiring.onAfterGraphConfigure()
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
