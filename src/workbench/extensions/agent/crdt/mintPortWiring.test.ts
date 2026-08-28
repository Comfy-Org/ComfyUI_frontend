import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { GraphScope } from '@/types/graphScopeId'
import type { LinkTopology } from '@/types/linkTopology'

import { useLinkStore } from '@/stores/linkStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import type { GraphOperation } from './graphOperations'
import type { LayoutChangeView } from './layoutMintPort'
import { attachMintPortWiring } from './mintPortWiring'
import type { MintPortWiring, MintableGraph } from './mintPortWiring'

const ROOT_ID = 'root-uuid'

/** Structural stand-in for the two LGraphNode members the wiring reads. */
interface FakeGraphNode {
  id?: unknown
  serialize?: () => unknown
  widgets?: { name: string; type: string; serialize?: boolean }[]
}

const ROOT_SCOPE: GraphScope = {
  rootGraphId: toRootGraphId(ROOT_ID),
  owningGraphId: toOwningGraphId(ROOT_ID)
}

function topology(id: number, targetSlot = 3): LinkTopology {
  return {
    id: toLinkId(id),
    graphId: toOwningGraphId(ROOT_ID),
    originNodeId: toNodeId(1),
    originSlot: 0,
    targetNodeId: toNodeId(2),
    targetSlot,
    type: 'IMAGE'
  }
}

async function afterSweep(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('attachMintPortWiring', () => {
  let minted: GraphOperation[]
  let wiring: MintPortWiring
  let enabled: boolean
  let bound: boolean
  let layoutListeners: Set<(change: LayoutChangeView) => void>
  let graphNodes: Map<string, FakeGraphNode>

  function deliverLayoutChange(change: LayoutChangeView): void {
    for (const listener of layoutListeners) listener(change)
  }

  const graph: MintableGraph = {
    id: ROOT_ID,
    rootGraph: { id: ROOT_ID },
    getNodeById: (id) =>
      (graphNodes.get(String(id)) as unknown as LGraphNode | undefined) ?? null,
    get _nodes() {
      return [...graphNodes.values()] as LGraphNode[]
    }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    minted = []
    enabled = true
    bound = true
    layoutListeners = new Set()
    graphNodes = new Map()
    wiring = attachMintPortWiring({
      isEnabled: () => enabled,
      isDocBound: () => bound,
      enqueue: (operations) => minted.push(...operations),
      layoutChanges: (listener) => {
        layoutListeners.add(listener)
        return () => layoutListeners.delete(listener)
      },
      withLayoutActor: (_actor, fn) => fn(),
      localActorPrefix: 'user-',
      getGraph: () => graph
    })
  })

  it('mints a concrete connect when the real link store places a link', () => {
    useLinkStore().registerLink(ROOT_SCOPE, topology(41))

    expect(minted).toEqual([
      {
        op: 'connect',
        link_id: 41,
        // The store's NodeId brand normalizes to strings; the wire vocabulary
        // treats node ids as opaque, so they pass through verbatim.
        from_node: toNodeId(1),
        from_slot: 0,
        to_node: toNodeId(2),
        to_slot: 3,
        link_type: 'IMAGE'
      }
    ])
  })

  it('maps a replace to PLACED, never DELETED (no false disconnect surfaces)', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const linkStore = useLinkStore()
    const incumbent = topology(41)
    linkStore.registerLink(ROOT_SCOPE, incumbent)

    // A rewire claims the same input slot: the store displaces the incumbent
    // internally with no deleteLink action, so the wire story is exactly one
    // new connect and zero severances.
    linkStore.replaceLink(ROOT_SCOPE, incumbent, topology(42))
    await afterSweep()

    const connects = minted.filter((operation) => operation.op === 'connect')
    expect(connects.map((operation) => operation.link_id)).toEqual([41, 42])
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('carries a real severed link into the delete_node mint', async () => {
    const linkStore = useLinkStore()
    const severed = topology(41)
    linkStore.registerLink(ROOT_SCOPE, severed)
    minted.length = 0

    linkStore.deleteLink(ROOT_SCOPE, severed)
    deliverLayoutChange({
      operation: { type: 'deleteNode', actor: 'user-abc', nodeId: toNodeId(2) }
    })
    await afterSweep()

    expect(minted).toEqual([
      { op: 'delete_node', node_id: '2', removed_links: [toLinkId(41)] }
    ])
  })

  it('mints a name-keyed set_widget with the pre-write value from the real store', () => {
    const widgetStore = useWidgetValueStore()
    const id = widgetId(ROOT_ID, toNodeId(7), 'seed')
    widgetStore.registerWidget(id, { type: 'number', value: 3 } as Parameters<
      typeof widgetStore.registerWidget
    >[1])

    widgetStore.setValue(id, 42)

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: toNodeId(7),
        widget: 'seed',
        value: 42,
        old: 3
      }
    ])
  })

  it('mints nothing for a setValue that did not apply', () => {
    useWidgetValueStore().setValue(widgetId(ROOT_ID, toNodeId(9), 'missing'), 1)

    expect(minted).toEqual([])
  })

  it('suppresses every port inside the remote scope', () => {
    wiring.runRemoteScope(() => {
      useLinkStore().registerLink(ROOT_SCOPE, topology(41))
      const widgetStore = useWidgetValueStore()
      const id = widgetId(ROOT_ID, toNodeId(7), 'seed')
      widgetStore.registerWidget(id, { type: 'number', value: 3 } as Parameters<
        typeof widgetStore.registerWidget
      >[1])
      widgetStore.setValue(id, 42)
    })

    expect(minted).toEqual([])
  })

  it('suppresses mints between the load-bracket hooks, fail-closed on a failed load', () => {
    wiring.onBeforeGraphLoad()
    useLinkStore().registerLink(ROOT_SCOPE, topology(41))
    expect(minted).toEqual([])

    // A failed load never fires afterConfigureGraph: the bracket stays open
    // (still no mints), and the NEXT load's paired hooks close it.
    wiring.onBeforeGraphLoad()
    useLinkStore().registerLink(ROOT_SCOPE, topology(42))
    expect(minted).toEqual([])

    wiring.onAfterGraphConfigure()
    useLinkStore().registerLink(ROOT_SCOPE, topology(43, 4))
    expect(minted).toHaveLength(1)
  })

  it('serializes add_node snapshots name-keyed, dropping non-value widgets', () => {
    graphNodes.set('5', {
      serialize: () => ({
        id: 5,
        type: 'LoadImage',
        widgets_values: ['positional'],
        widgets_values_named: { image: 'cat.png', upload: 'button-slot' }
      }),
      widgets: [
        { name: 'image', type: 'combo' },
        { name: 'upload', type: 'button' }
      ]
    })

    deliverLayoutChange({
      operation: {
        type: 'createNode',
        actor: 'user-abc',
        nodeId: toNodeId(5),
        layout: { position: { x: 10, y: 20 } }
      }
    })

    expect(minted).toEqual([
      {
        op: 'add_node',
        node_id: toNodeId(5),
        class_type: 'LoadImage',
        pos: [10, 20],
        node: {
          id: 5,
          type: 'LoadImage',
          widgets_values: { image: 'cat.png' }
        }
      }
    ])
  })

  it('positive control: an unbound workflow runs normally, zero mint and zero blockage', () => {
    bound = false
    const widgetStore = useWidgetValueStore()
    const id = widgetId(ROOT_ID, toNodeId(7), 'seed')
    widgetStore.registerWidget(id, { type: 'number', value: 3 } as Parameters<
      typeof widgetStore.registerWidget
    >[1])

    const placed = useLinkStore().registerLink(ROOT_SCOPE, topology(41))
    const applied = widgetStore.setValue(id, 42)

    expect(minted).toEqual([])
    expect(placed).toBeDefined()
    expect(applied).toBe(true)
    expect(widgetStore.getWidget(id)?.value).toBe(42)
  })

  it('stops observing both stores after detach', () => {
    wiring.detach()
    useLinkStore().registerLink(ROOT_SCOPE, topology(41))
    const widgetStore = useWidgetValueStore()
    const id = widgetId(ROOT_ID, toNodeId(7), 'seed')
    widgetStore.registerWidget(id, { type: 'number', value: 3 } as Parameters<
      typeof widgetStore.registerWidget
    >[1])
    widgetStore.setValue(id, 42)

    expect(minted).toEqual([])
  })
})
