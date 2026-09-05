import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { GraphScope } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import { toNodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import { toRerouteId } from '@/types/rerouteId'
import type { RerouteChain } from '@/types/rerouteChain'
import { widgetId } from '@/types/widgetId'
import { createNodeState } from '@/utils/__tests__/litegraphTestUtils'
import type { UUID } from '@/utils/uuid'

import { useLinkStore } from './linkStore'
import { useNodeDataStore } from './nodeDataStore'
import { useRerouteStore } from './rerouteStore'
import { useWidgetValueStore } from './widgetValueStore'

/**
 * Pins the store collision contract recorded in docs/exceptions-log.md
 * (EX-002) and docs/adr/ECS-IDENTITY-0016-entity-id-collision-policy-and-recovery.md:
 * the three identity-keyed stores (nodeDataStore, linkStore, rerouteStore)
 * reject a registration at an already-occupied identity key rather than
 * overwriting it, so the caller can re-mint a new id. The structural-keyed
 * widgetValueStore instead resolves a collision at its `WidgetId`
 * (`graphId:nodeId:name`) per documented semantics: a same-type
 * re-registration keeps the incumbent's value, a different-type
 * re-registration (a recycled key) overwrites.
 */

const rootA: UUID = 'root-a'
const scopeA: GraphScope = {
  rootGraphId: toRootGraphId(rootA),
  owningGraphId: toOwningGraphId(rootA)
}
const scopeSibling: GraphScope = {
  rootGraphId: toRootGraphId(rootA),
  owningGraphId: toOwningGraphId('sub-1')
}

function nodeState(id: number, graphId: UUID = rootA): NodeState {
  return createNodeState({ id: toNodeId(id), graphId, title: `Node ${id}` })
}

function linkTopology(id: number, graphId: UUID = rootA): LinkTopology {
  return {
    id: toLinkId(id),
    graphId: toOwningGraphId(graphId),
    originNodeId: toNodeId(5),
    originSlot: 0,
    targetNodeId: toNodeId(9),
    targetSlot: id,
    type: 'INT'
  }
}

function rerouteChain(id: number, graphId: UUID = rootA): RerouteChain {
  return { id: toRerouteId(id), graphId: toOwningGraphId(graphId) }
}

describe('store collision contracts (EX-002)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('nodeDataStore rejects a registration at an occupied identity key', () => {
    const store = useNodeDataStore()
    const incumbent = nodeState(1)
    store.registerNode(scopeA, incumbent)

    const challenger = nodeState(1, 'sub-1')
    const result = store.registerNode(scopeSibling, challenger)

    expect(result).toBeUndefined()
    expect(store.getGraphNodesFor(rootA, rootA)).toEqual([incumbent])
    expect(store.getGraphNodesFor(rootA, 'sub-1')).toEqual([])
  })

  it('linkStore rejects a registration at an occupied identity key', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = useLinkStore()
    const incumbent = linkTopology(1)
    store.registerLink(scopeA, incumbent)

    const challenger = { ...linkTopology(1, 'sub-1'), targetSlot: 3 }
    const result = store.registerLink(scopeSibling, challenger)

    expect(result).toBeUndefined()
    expect(store.getTopology(scopeA.rootGraphId, toLinkId(1))?.graphId).toBe(
      scopeA.owningGraphId
    )
  })

  it('rerouteStore rejects a registration at an occupied identity key', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = useRerouteStore()
    const incumbent = store.registerReroute(scopeA, rerouteChain(1))

    const challenger = rerouteChain(1, 'sub-1')
    const result = store.registerReroute(scopeSibling, challenger)

    expect(result).toBeUndefined()
    expect(store.getReroute(scopeA, toRerouteId(1))).toEqual(incumbent)
  })

  it('widgetValueStore resolves a same-type collision at its structural key by keeping the incumbent value', () => {
    const store = useWidgetValueStore()
    const id = widgetId(rootA, toNodeId('node-1'), 'seed')
    store.registerWidget(id, { type: 'number', value: 100, options: {} })

    const resolved = store.registerWidget(id, {
      type: 'number',
      value: 999,
      options: {}
    })

    expect(resolved?.value).toBe(100)
    expect(store.getWidget(id)?.value).toBe(100)
  })

  it('widgetValueStore resolves a different-type collision at its structural key by overwriting the recycled entry', () => {
    const store = useWidgetValueStore()
    const id = widgetId(rootA, toNodeId('node-1'), 'seed')
    store.registerWidget(id, { type: 'number', value: 100, options: {} })

    const resolved = store.registerWidget(id, {
      type: 'string',
      value: 'recycled',
      options: {}
    })

    expect(resolved?.type).toBe('string')
    expect(resolved?.value).toBe('recycled')
    expect(store.getWidget(id)?.value).toBe('recycled')
  })
})
