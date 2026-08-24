import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { attachNodeToStores } from '@/core/graph/nodeShell/nodeShellLifecycle'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
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
 * (EX-002) and docs/adr/0016-entity-registration-collision-and-recovery-boundaries.md:
 * the three identity-keyed stores (nodeDataStore, linkStore, rerouteStore)
 * reject a registration at an already-occupied identity key rather than
 * overwriting it, so the caller can re-mint a new id. The structural-keyed
 * widgetValueStore instead resolves a collision at its `WidgetId`
 * (`graphId:nodeId:name`) per documented semantics: a same-type
 * re-registration keeps the incumbent's value, a different-type
 * re-registration (a recycled key) overwrites.
 *
 * The remint block pins the caller-side half of the identity contract:
 * LGraph.add resolves a rejected node registration by minting a fresh id for
 * the newcomer (via attachNodeToStores) and leaves the incumbent untouched.
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

function nodeState(
  id: number,
  graphId: UUID = rootA,
  title = `Node ${id}`
): NodeState {
  return createNodeState({ id: toNodeId(id), graphId, title })
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

  it('nodeDataStore returns the incumbent when the registered identity re-registers', () => {
    const store = useNodeDataStore()
    const registered = store.registerNode(scopeA, nodeState(1))
    assert(registered)

    expect(store.registerNode(scopeA, registered)).toBe(registered)
    expect(store.getGraphNodesFor(rootA, rootA)).toHaveLength(1)
  })

  it('nodeDataStore rejects a different identity at a registered id without touching the incumbent', () => {
    const store = useNodeDataStore()
    const incumbent = store.registerNode(
      scopeA,
      nodeState(1, rootA, 'Incumbent')
    )
    assert(incumbent)

    const usurper = nodeState(1, rootA, 'Usurper')
    expect(store.registerNode(scopeA, usurper)).toBeUndefined()

    expect(incumbent.title).toBe('Incumbent')
    expect(store.getGraphNodesFor(rootA, rootA)).toHaveLength(1)
    expect(store.ownsNode(scopeA, usurper)).toBe(false)
    expect(store.deleteNode(scopeA, usurper)).toBe(false)
  })

  it('a rejected node registration writes nothing to any store', () => {
    const nodeDataStore = useNodeDataStore()
    const widgetValueStore = useWidgetValueStore()
    const linkStore = useLinkStore()
    const rerouteStore = useRerouteStore()
    assert(nodeDataStore.registerNode(scopeA, nodeState(1)))

    expect(
      nodeDataStore.registerNode(scopeA, nodeState(1, rootA, 'Usurper'))
    ).toBeUndefined()

    expect(nodeDataStore.getGraphNodesFor(rootA, rootA)).toHaveLength(1)
    expect(widgetValueStore.getNodeWidgetIds(rootA, toNodeId(1))).toEqual([])
    expect([...linkStore.graphTopologies(scopeA)]).toEqual([])
    expect(rerouteStore.getReroute(scopeA, toRerouteId(1))).toBeUndefined()
  })

  describe('LGraph.add remint path (caller-side resolution of an identity rejection)', () => {
    it('remints a newcomer that collides with a registered id, leaving the incumbent untouched', () => {
      const graph = new LGraph()
      const incumbent = new LGraphNode('Incumbent')
      graph.add(incumbent)
      const takenId = incumbent.id

      const newcomer = new LGraphNode('Newcomer')
      newcomer.id = takenId
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      graph.add(newcomer)

      expect(newcomer.id).not.toBe(takenId)
      expect(graph.getNodeById(takenId)).toBe(incumbent)
      expect(graph.getNodeById(newcomer.id)).toBe(newcomer)
      expect(incumbent.title).toBe('Incumbent')
      expect(
        useNodeDataStore().getGraphNodesFor(graph.id, graph.id)
      ).toHaveLength(2)
    })

    it('re-attaching the already-registered instance keeps its id without minting', () => {
      const graph = new LGraph()
      const node = new LGraphNode('Incumbent')
      graph.add(node)
      const registeredId = node.id

      const mintId = vi.fn(() => {
        throw new Error('re-attaching the incumbent must not mint an id')
      })
      attachNodeToStores(graph, node, mintId)

      expect(mintId).not.toHaveBeenCalled()
      expect(node.id).toBe(registeredId)
      expect(
        useNodeDataStore().getGraphNodesFor(graph.id, graph.id)
      ).toHaveLength(1)
    })

    it('warns with the collided id, reminted id, and root graph id', () => {
      const graph = new LGraph()
      const incumbent = new LGraphNode('Incumbent')
      graph.add(incumbent)
      const collidedId = incumbent.id
      const newcomer = new LGraphNode('Newcomer')
      newcomer.id = collidedId
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      graph.add(newcomer)

      expect(newcomer.id).not.toBe(collidedId)
      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0][0]).toContain(`Node id ${collidedId} `)
      expect(warn.mock.calls[0][0]).toContain(`reminted as ${newcomer.id}`)
      expect(warn.mock.calls[0][0]).toContain(
        `root graph ${graph.rootGraph.id}`
      )
    })
  })
})
