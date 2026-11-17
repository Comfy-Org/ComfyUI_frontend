import { assert, describe, expect, it } from 'vitest'
import { toRaw } from 'vue'

import {
  toOwningGraphId,
  toRootGraphId
} from '@comfyorg/graph-model/graphScopeId'
import type { GraphScope } from '@comfyorg/graph-model/graphScopeId'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import type { LinkTopology } from '@comfyorg/graph-model/linkTopology'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { toRerouteId } from '@comfyorg/graph-model/rerouteId'
import { toSlotRecordId } from '@comfyorg/graph-model/slotRecordId'
import type { SlotRecord } from '@comfyorg/graph-model/slots'
import type { RerouteChain } from '@comfyorg/graph-model/rerouteChain'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import { createNodeState } from '@/utils/__tests__/litegraphTestUtils'
import type { UUID } from '@/utils/uuid'

import { useLinkStore } from './linkStore'
import { useNodeDataStore } from './nodeDataStore'
import { useRerouteStore } from './rerouteStore'
import { createSlotMembership, useSlotStore } from './slotStore'
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
  it('rejects a distinct slot record at an occupied ID before registering its node', () => {
    const store = useNodeDataStore()
    const record: SlotRecord = {
      id: toSlotRecordId('incumbent-slot'),
      name: 'Incumbent',
      type: 'INT',
      boundingRect: new Float64Array(4)
    }
    const incumbent = nodeState(1)
    incumbent.slots = createSlotMembership([record])
    store.registerNode(scopeA, incumbent)
    const challenger = nodeState(2, 'sub-1')
    challenger.slots = createSlotMembership(
      [],
      [{ ...record, name: 'Challenger' }]
    )

    expect(store.registerNode(scopeSibling, challenger)).toBeUndefined()
    expect(useSlotStore().getSlotRecord(record.id)?.name).toBe('Incumbent')
    expect(store.getGraphNodesFor(rootA, 'sub-1')).toEqual([])
    expect(store.deleteNode(scopeSibling, challenger)).toBe(false)
    expect(store.registerNode(scopeA, incumbent)).toBeDefined()
  })

  it('rejects distinct records sharing an ID inside a detached membership', () => {
    const store = useSlotStore()
    const record: SlotRecord = {
      id: toSlotRecordId('duplicate-slot'),
      name: 'Input',
      type: 'INT',
      boundingRect: new Float64Array(4)
    }
    const challenger = nodeState(1)
    challenger.slots = createSlotMembership([record])

    expect(
      store.editMembership(
        challenger.slots,
        () => {
          challenger.slots.outputIds.push(record.id)
          return true
        },
        { ...record, name: 'Output' }
      )
    ).toBe(false)
    expect(store.getSlotRecord(record.id)).toBeUndefined()
    expect(challenger.slots.outputIds).toEqual([])
    expect(toRaw(challenger.slots.records[record.id])).toBe(record)
  })

  it('allows the same raw slot record to have memberships in different roots', () => {
    const store = useNodeDataStore()
    const record: SlotRecord = {
      id: toSlotRecordId('shared-slot'),
      name: 'Shared',
      type: 'INT',
      boundingRect: new Float64Array(4)
    }
    const source = nodeState(1)
    source.slots = createSlotMembership([record])
    const alias = nodeState(2, 'other-root')
    alias.slots = createSlotMembership([record])
    const otherScope: GraphScope = {
      rootGraphId: toRootGraphId('other-root'),
      owningGraphId: toOwningGraphId('other-root')
    }
    store.registerNode(scopeA, source)

    expect(store.registerNode(otherScope, alias)).toBeDefined()
    store.clearOwner(scopeA)
    expect(useSlotStore().getSlotRecord(record.id)?.name).toBe('Shared')
    store.clearGraph('other-root')
    expect(useSlotStore().getSlotRecord(record.id)).toBeUndefined()
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

  it('nodeDataStore rejects a different identity at a registered id silently and without touching the incumbent', () => {
    const store = useNodeDataStore()
    const incumbent = store.registerNode(
      scopeA,
      nodeState(1, rootA, 'Incumbent')
    )
    assert(incumbent)

    const usurper = nodeState(1, rootA, 'Usurper')
    expect(store.registerNode(scopeA, usurper)).toBeUndefined()
    expect(console.warn).not.toHaveBeenCalled()

    expect(incumbent.title).toBe('Incumbent')
    expect(store.getGraphNodesFor(rootA, rootA)).toHaveLength(1)
    expect(store.ownsNode(scopeA, usurper)).toBe(false)
    expect(store.deleteNode(scopeA, usurper)).toBe(false)
  })
})
