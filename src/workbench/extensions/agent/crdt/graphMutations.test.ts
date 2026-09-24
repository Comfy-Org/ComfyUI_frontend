import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { toRaw } from 'vue'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import {
  graphScopeOf,
  toOwningGraphId,
  toRootGraphId
} from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import type { LinkId } from '@/types/linkId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import type { WidgetStateInit } from '@/types/widgetState'
import { createNodeState } from '@/utils/__tests__/litegraphTestUtils'

import type {
  GraphMutationBatch,
  SemanticLiveNodeQueryPort,
  SemanticPlacementPort
} from './graphMutations'
import { createGraphMutations } from './graphMutations'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

class ContractSampler extends LGraphNode {
  static override title = 'Contract Sampler'
  constructor() {
    super('Contract Sampler')
  }
}

const scope = {
  rootGraphId: toRootGraphId('root'),
  owningGraphId: toOwningGraphId('root')
}
const otherScope = {
  rootGraphId: toRootGraphId('other-root'),
  owningGraphId: toOwningGraphId('other-root')
}
const context: RemoteMutationContext = {
  source: 'agent-remote',
  actor: 'agent:test',
  opId: 'op-1'
}

function node(id: number, widgets_values: Record<string, unknown> = {}) {
  return {
    id,
    type: `Type${id}`,
    title: `Node ${id}`,
    pos: [id * 10, id * 20],
    size: [200, 100],
    flags: { pinned: true },
    inputs: [{ name: 'in', type: 'IMAGE', link: null }],
    outputs: [{ name: 'out', type: 'IMAGE', links: [] }],
    properties: { source: 'mint-time' },
    widgets_values
  }
}

function mockNodeDef(overrides: Partial<ComfyNodeDef> = {}): ComfyNodeDef {
  return {
    name: 'MockNode',
    display_name: 'Mock Node',
    category: 'test',
    python_module: 'test_module',
    description: 'Test node',
    input: {},
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: false,
    deprecated: false,
    experimental: false,
    ...overrides
  }
}

type LiveWidget = WidgetStateInit & { name: string }

const samplerWidgets: readonly LiveWidget[] = [
  { name: 'steps', type: 'number', value: 20, options: { min: 1, max: 100 } },
  { name: 'seed', type: 'number', value: 7, options: { min: 0 } },
  { name: 'run', type: 'button', value: null, options: {}, serialize: false }
]
const noteWidgets: readonly LiveWidget[] = [
  {
    name: 'text',
    type: 'markdown',
    value: '# Draft',
    options: { multiline: true }
  }
]
const objectWidgets: readonly LiveWidget[] = [
  { name: 'config', type: 'legacy', value: { mode: 'auto' }, options: {} }
]

describe('graphMutations', () => {
  const createLayout = vi.fn()
  const deleteLayouts = vi.fn()
  const createdLayouts = new Map<
    string,
    {
      position: { x: number; y: number }
      size: { width: number; height: number }
    }
  >()
  const placement: SemanticPlacementPort = {
    nodeBounds: (_scope, nodeId) => {
      const layout = createdLayouts.get(String(nodeId))
      return layout
        ? {
            x: layout.position.x,
            y: layout.position.y,
            width: layout.size.width,
            height: layout.size.height
          }
        : null
    },
    viewportBounds: () => null
  }
  const setLiveWidgetValue = vi.fn(
    (
      _scope,
      _nodeId,
      _name,
      value
    ):
      | { status: 'skipped' }
      | {
          status: 'applied' | 'rolledBack'
          resolvedValue: typeof value
        } => ({
      status: 'applied',
      resolvedValue: value
    })
  )

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    createdLayouts.clear()
    createLayout.mockReset()
    createLayout.mockImplementation((_scope, nodeId, layout) => {
      createdLayouts.set(String(nodeId), layout)
    })
    deleteLayouts.mockReset()
    deleteLayouts.mockImplementation((_scope, nodeIds) => {
      for (const nodeId of nodeIds) createdLayouts.delete(String(nodeId))
    })
    setLiveWidgetValue.mockReset()
    mockReportError.mockReset()
    LiteGraph.registerNodeType('ContractSampler', ContractSampler)
  })

  function mutations(liveNodes?: SemanticLiveNodeQueryPort) {
    return createGraphMutations({
      getScope: () => scope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts },
      placement,
      liveWidgets: { setValue: setLiveWidgetValue },
      liveNodes
    })
  }

  function registerLiveWidgets(id: number, widgets: readonly LiveWidget[]) {
    const store = useWidgetValueStore()
    for (const { name, ...init } of widgets) {
      store.registerWidget(widgetId('root', toNodeId(id), name), init)
    }
    return store.getNodeWidgets('root', toNodeId(id))
  }

  function widgetTuples(id: number) {
    return useWidgetValueStore()
      .getNodeWidgets('root', toNodeId(id))
      .map(({ name, type, options, value }) => [name, type, options, value])
  }

  describe('doc widget payload applied to a live node', () => {
    it.for([
      {
        payload: 'omitted',
        via: 'reconcileNode',
        live: samplerWidgets,
        widgets_values: undefined,
        expected: [
          ['steps', 'number', { min: 1, max: 100 }, 20],
          ['seed', 'number', { min: 0 }, 7],
          ['run', 'button', {}, null]
        ]
      },
      {
        payload: 'empty positional',
        via: 'reconcileNode',
        live: samplerWidgets,
        widgets_values: [],
        expected: [
          ['steps', 'number', { min: 1, max: 100 }, 20],
          ['seed', 'number', { min: 0 }, 7],
          ['run', 'button', {}, null]
        ]
      },
      {
        payload: 'empty named',
        via: 'reconcileNode',
        live: samplerWidgets,
        widgets_values: {},
        expected: [
          ['steps', 'number', { min: 1, max: 100 }, 20],
          ['seed', 'number', { min: 0 }, 7],
          ['run', 'button', {}, null]
        ]
      },
      {
        payload: 'positional',
        via: 'reconcileNode',
        live: samplerWidgets,
        widgets_values: [21, 8],
        expected: [
          ['steps', 'number', { min: 1, max: 100 }, 21],
          ['seed', 'number', { min: 0 }, 8],
          ['run', 'button', {}, null]
        ]
      },
      {
        payload: 'positional past the serialized slots',
        via: 'reconcileNode',
        live: samplerWidgets,
        widgets_values: [21, 8, 99],
        expected: [
          ['steps', 'number', { min: 1, max: 100 }, 21],
          ['seed', 'number', { min: 0 }, 8],
          ['run', 'button', {}, null]
        ]
      },
      {
        payload: 'complete named',
        via: 'reconcileNode',
        live: samplerWidgets,
        widgets_values: { steps: 21, seed: 8 },
        expected: [
          ['steps', 'number', { min: 1, max: 100 }, 21],
          ['seed', 'number', { min: 0 }, 8],
          ['run', 'button', {}, null]
        ]
      },
      {
        payload: 'partial named',
        via: 'reconcileNode',
        live: samplerWidgets,
        widgets_values: { steps: 21 },
        expected: [
          ['steps', 'number', { min: 1, max: 100 }, 21],
          ['seed', 'number', { min: 0 }, 7],
          ['run', 'button', {}, null]
        ]
      },
      {
        payload: 'named with a widget the node lacks',
        via: 'reconcileNode',
        live: samplerWidgets,
        widgets_values: { steps: 21, extra: 'x' },
        expected: [
          ['steps', 'number', { min: 1, max: 100 }, 21],
          ['seed', 'number', { min: 0 }, 7],
          ['run', 'button', {}, null],
          ['extra', 'string', {}, 'x']
        ]
      },
      {
        payload: 'partial named through a field resync',
        via: 'reconcileNodeFields',
        live: samplerWidgets,
        widgets_values: { seed: 8 },
        expected: [
          ['steps', 'number', { min: 1, max: 100 }, 20],
          ['seed', 'number', { min: 0 }, 8],
          ['run', 'button', {}, null]
        ]
      },
      {
        payload: 'opaque positional for a frontend-only node',
        via: 'reconcileNode',
        live: noteWidgets,
        widgets_values: ['# Final'],
        expected: [['text', 'markdown', { multiline: true }, '# Final']]
      }
    ] as const)(
      '$payload payload via $via',
      ({ via, live, widgets_values, expected }) => {
        const graph = mutations()
        graph.addNode(node(1), context)
        const before = registerLiveWidgets(1, live)

        expect(
          graph.batch(context, (batch) => {
            batch[via]({ ...node(1), widgets_values })
          })
        ).toBe(true)

        expect(widgetTuples(1)).toEqual(expected)
        const after = useWidgetValueStore().getNodeWidgets('root', toNodeId(1))
        for (const [index, state] of before.entries()) {
          expect(after[index]).toBe(state)
        }
      }
    )
  })

  describe('reconcileNode does not clobber a locally dirty widget', () => {
    it('keeps skipping every stale full reconcile until one matches the local value', () => {
      const graph = mutations()
      graph.addNode(node(1), context)
      registerLiveWidgets(1, samplerWidgets)
      const id = widgetId('root', toNodeId(1), 'steps')
      // A local edit that bypassed this module's commit (a human typing, or
      // the litegraph widget's own `.value` setter) carries no
      // RemoteMutationContext, so the store marks it locally dirty.
      useWidgetValueStore().setValue(id, 99)

      // Two stale full reconciles in a row - e.g. an unbound local edit that
      // never minted, followed by a rejected duplicate-add echo re-arming
      // full reconciliation before the genuinely newer value lands - must
      // not clobber the edit just because the first one was already
      // skipped: the guard is not one-shot.
      for (const stale of [21, 22]) {
        expect(
          graph.batch(context, (batch) => {
            batch.reconcileNode({
              ...node(1),
              widgets_values: { steps: stale }
            })
          })
        ).toBe(true)
        expect(useWidgetValueStore().getWidget(id)?.value).toBe(99)
        expect(useWidgetValueStore().isLocallyDirty(id)).toBe(true)
      }

      // Once a reconcile's own candidate value already matches the local
      // edit, the document has caught up: the write lands (and, carrying a
      // context, clears the mark itself).
      expect(
        graph.batch(context, (batch) => {
          batch.reconcileNode({ ...node(1), widgets_values: { steps: 99 } })
        })
      ).toBe(true)
      expect(useWidgetValueStore().getWidget(id)?.value).toBe(99)
      expect(useWidgetValueStore().isLocallyDirty(id)).toBe(false)
    })

    it('also resolves via an explicit single-widget setWidget op regardless of value', () => {
      const graph = mutations()
      graph.addNode(node(1), context)
      registerLiveWidgets(1, samplerWidgets)
      const id = widgetId('root', toNodeId(1), 'steps')
      useWidgetValueStore().setValue(id, 99)

      expect(
        graph.batch(context, (batch) => {
          batch.reconcileNode({ ...node(1), widgets_values: { steps: 21 } })
        })
      ).toBe(true)
      expect(useWidgetValueStore().isLocallyDirty(id)).toBe(true)

      // An intentional remote write for this exact widget bypasses the
      // guard entirely (it never goes through `applyWidgetValues`), so it
      // resolves the mark even though its value differs from both the local
      // edit and the stale snapshot.
      expect(graph.setWidget(toNodeId(1), 'steps', 30, context)).toBe(true)
      expect(useWidgetValueStore().getWidget(id)?.value).toBe(30)
      expect(useWidgetValueStore().isLocallyDirty(id)).toBe(false)
    })

    it('releases an object-valued named widget by deep equality, not reference equality', () => {
      const graph = mutations()
      graph.addNode(node(1), context)
      registerLiveWidgets(1, objectWidgets)
      const id = widgetId('root', toNodeId(1), 'config')
      const widgetStore = useWidgetValueStore()
      widgetStore.setValue(id, { mode: 'manual' })

      // A stale reconcile whose candidate is structurally different keeps
      // skipping, same as the primitive case.
      expect(
        graph.batch(context, (batch) => {
          batch.reconcileNode({
            ...node(1),
            widgets_values: { config: { mode: 'auto' } }
          })
        })
      ).toBe(true)
      expect(widgetStore.getWidget(id)?.value).toEqual({ mode: 'manual' })
      expect(widgetStore.isLocallyDirty(id)).toBe(true)

      // `parseWidgetValues` clones every object candidate, so the reconcile
      // that finally "matches" the local edit never delivers the *same*
      // object instance - only one that is structurally identical. The
      // guard must compare by value: an Object.is/=== comparison would see
      // two distinct clones as unequal forever and the mark would never
      // clear.
      expect(
        graph.batch(context, (batch) => {
          batch.reconcileNode({
            ...node(1),
            widgets_values: { config: { mode: 'manual' } }
          })
        })
      ).toBe(true)
      expect(widgetStore.getWidget(id)?.value).toEqual({ mode: 'manual' })
      expect(widgetStore.isLocallyDirty(id)).toBe(false)
    })

    it('releases an object-valued positional widget by deep equality, not reference equality', () => {
      const graph = mutations()
      graph.addNode(node(1), context)
      registerLiveWidgets(1, objectWidgets)
      const id = widgetId('root', toNodeId(1), 'config')
      const widgetStore = useWidgetValueStore()
      widgetStore.setValue(id, { mode: 'manual' })

      expect(
        graph.batch(context, (batch) => {
          batch.reconcileNode({
            ...node(1),
            widgets_values: [{ mode: 'auto' }]
          })
        })
      ).toBe(true)
      expect(widgetStore.getWidget(id)?.value).toEqual({ mode: 'manual' })
      expect(widgetStore.isLocallyDirty(id)).toBe(true)

      // Same catch-up case as the named path, but through the positional
      // branch (`applyPositionalWidgetValues`), which shares the same
      // `skipStaleReconcile` guard.
      expect(
        graph.batch(context, (batch) => {
          batch.reconcileNode({
            ...node(1),
            widgets_values: [{ mode: 'manual' }]
          })
        })
      ).toBe(true)
      expect(widgetStore.getWidget(id)?.value).toEqual({ mode: 'manual' })
      expect(widgetStore.isLocallyDirty(id)).toBe(false)
    })
  })

  describe('a suppressed structural replay does not arm the guard', () => {
    // A workflow load (e.g. switching back to a tab) reconfigures the live
    // node from that tab's own locally-saved snapshot, which can predate a
    // background CRDT edit made while the tab was unbound. That replay is a
    // context-less write, indistinguishable from a human edit to the guard
    // unless the caller (agentPanel's beforeLoadGraph/afterConfigureGraph)
    // brackets it with local-dirty-tracking suppression.
    it('lets the next catch-up reconcile land the real value', () => {
      const graph = mutations()
      graph.addNode(node(1), context)
      registerLiveWidgets(1, samplerWidgets)
      const id = widgetId('root', toNodeId(1), 'steps')
      const widgetStore = useWidgetValueStore()
      // The agent's edit already landed on canonical state (steps: 20 -> 30)
      // while this tab was backgrounded.
      widgetStore.setValue(id, 30, context)

      // The load's own configure() re-applies the tab's stale, pre-edit
      // snapshot (steps: 20) onto the already-canonical widget, bracketed
      // the way agentPanel.ts brackets it.
      widgetStore.beginLocalDirtyTrackingSuppression()
      widgetStore.setValue(id, 20)
      widgetStore.endLocalDirtyTrackingSuppression()

      expect(widgetStore.isLocallyDirty(id)).toBe(false)

      // The CRDT rebind's catch-up reconcile, re-delivering the value the
      // agent set while this tab was backgrounded, is not mistaken for
      // clobbering a local edit.
      expect(
        graph.batch(context, (batch) => {
          batch.reconcileNode({ ...node(1), widgets_values: { steps: 30 } })
        })
      ).toBe(true)
      expect(widgetStore.getWidget(id)?.value).toBe(30)
    })

    it('regression: without suppression, the same replay would strand the widget until the real value matches', () => {
      const graph = mutations()
      graph.addNode(node(1), context)
      registerLiveWidgets(1, samplerWidgets)
      const id = widgetId('root', toNodeId(1), 'steps')
      const widgetStore = useWidgetValueStore()
      widgetStore.setValue(id, 30, context)

      // Same stale replay, but unsuppressed: it is indistinguishable from a
      // human edit, so it arms the guard.
      widgetStore.setValue(id, 20)
      expect(widgetStore.isLocallyDirty(id)).toBe(true)

      // The guard keeps skipping every catch-up reconcile that still
      // doesn't match, stranding the widget at the load's stale snapshot
      // instead of the agent's edit - not just for the first one.
      for (let i = 0; i < 2; i++) {
        expect(
          graph.batch(context, (batch) => {
            batch.reconcileNode({ ...node(1), widgets_values: { steps: 30 } })
          })
        ).toBe(true)
        expect(widgetStore.getWidget(id)?.value).toBe(20)
        expect(widgetStore.isLocallyDirty(id)).toBe(true)
      }

      // Only an explicit single-widget op, or a reconcile that finally
      // carries the value already sitting on the widget, resolves it.
      expect(graph.setWidget(toNodeId(1), 'steps', 30, context)).toBe(true)
      expect(widgetStore.getWidget(id)?.value).toBe(30)
      expect(widgetStore.isLocallyDirty(id)).toBe(false)
    })
  })

  it('reconcileNodeFields does not guard a subgraph host widget the same way', () => {
    // A host's promoted widgets are wired by SubgraphNode's own projection,
    // which writes them directly (no RemoteMutationContext) as a routine,
    // structural part of attaching the host, not a human edit; guarding here
    // too would leave a host widget stuck at a stale value forever.
    const graph = mutations()
    graph.addNode(node(1), context)
    registerLiveWidgets(1, samplerWidgets)
    const id = widgetId('root', toNodeId(1), 'steps')
    useWidgetValueStore().setValue(id, 99)

    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNodeFields({ ...node(1), widgets_values: { steps: 21 } })
      })
    ).toBe(true)
    expect(useWidgetValueStore().getWidget(id)?.value).toBe(21)
  })

  it.for([
    { title: undefined, type: 'ContractSampler', expected: 'Contract Sampler' },
    { title: '', type: 'ContractSampler', expected: 'Contract Sampler' },
    { title: 'Custom', type: 'ContractSampler', expected: 'Custom' },
    { title: undefined, type: 'Unregistered', expected: 'Unregistered' }
  ])(
    'titles a reconciled $type node with $title as $expected',
    ({ title, type, expected }) => {
      const graph = mutations()
      graph.addNode({ ...node(1), type, title: 'Before' }, context)

      expect(
        graph.batch(context, (batch) => {
          batch.reconcileNode({ ...node(1), type, title })
        })
      ).toBe(true)

      expect(
        useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))?.title
      ).toBe(expected)
    }
  )

  // A canvas rename never writes back into the CRDT doc
  // (useNodeEventHandlers.ts's handleNodeTitleUpdate only touches the live
  // node), so `prepareNode` compares the incoming title against the title
  // recorded on the node's `lastSerialization` baseline: an unchanged doc
  // title is a stale replay and keeps the live rename, while a title that
  // differs from that baseline is a genuine doc-side change and still wins.
  it('keeps a locally renamed title through a reconcile carrying the stale doc title', () => {
    const graph = mutations()
    graph.addNode(node(1), context)
    const live = useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))
    assert.exists(live)
    live.title = 'My Custom Sampler'

    expect(
      graph.batch(context, (batch) => {
        // Same payload the doc minted node(1) with — the doc was never
        // told about the rename, so this is genuinely what it still holds.
        batch.reconcileNode(node(1))
      })
    ).toBe(true)

    expect(
      useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))?.title
    ).toBe('My Custom Sampler')
  })

  // A record that predates any CRDT reconcile (e.g. a plain canvas-added
  // node) has no baseline at all, so an equally titleless payload is not
  // evidence the doc's title is unchanged — it should fall back through
  // `nodeTitle`, not pin the node at whatever placeholder title it happens
  // to carry.
  it('does not preserve a pre-existing title with no CRDT baseline against an equally titleless payload', () => {
    const graph = mutations()
    useNodeDataStore().registerNode(
      scope,
      createNodeState({
        id: toNodeId(5),
        graphId: scope.owningGraphId,
        type: 'Type5',
        title: ''
      })
    )

    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNode({ id: 5, type: 'Type5' })
      })
    ).toBe(true)

    expect(
      useNodeDataStore().getNode(scope.rootGraphId, toNodeId(5))?.title
    ).toBe('Type5')
  })

  it('still applies a title the doc payload genuinely changed to', () => {
    const graph = mutations()
    graph.addNode(node(1), context)
    const live = useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))
    assert.exists(live)
    live.title = 'My Custom Sampler'

    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNode({ ...node(1), title: 'Renamed By Agent' })
      })
    ).toBe(true)

    expect(
      useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))?.title
    ).toBe('Renamed By Agent')
  })

  it('uses the replacement payload title on a type-changing reconcile, not a stale local rename', () => {
    const graph = mutations()
    graph.addNode(node(1), context)
    const existing = useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))
    assert.exists(existing)
    existing.title = 'Local title'

    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNodeFields({
          ...node(1, { replacement: 2 }),
          type: 'Replacement'
        })
      })
    ).toBe(true)

    expect(
      useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))?.title
    ).toBe('Node 1')
  })

  // A host resync carries an explicit (even if empty/undefined) title that
  // differs from the `lastSerialization` baseline, so it reads as a genuine
  // doc-side change under the same-session fix above and still overwrites
  // the live rename. Left as a known, intentionally unfixed repro.
  it.fails('keeps a live-renamed title across a reconcile the doc never learned about', () => {
    const graph = mutations()
    graph.addNode(node(1), context)
    const existing = useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))
    assert.exists(existing)
    existing.title = 'My Renamed Sampler'

    expect(
      graph.batch({ ...context, opId: 'resync' }, (batch) => {
        batch.reconcileNode({ ...node(1), title: undefined })
      })
    ).toBe(true)

    expect(
      useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))?.title
    ).toBe('My Renamed Sampler')
  })

  // `assignNodeFields` (nodeDataStore.ts) unconditionally resets `color`/
  // `bgcolor` to `undefined` before applying the replacement's own fields.
  // Preservation instead comes from `prepareNode` (graphMutations.ts): for a
  // same-type incumbent, `resolveNodeColors` copies the incumbent's color
  // onto the replacement object before it ever reaches `assignNodeFields`,
  // so the "reset" sees a replacement that already carries the live color.
  it('keeps a locally set node color through a reconcile whose payload carries none', () => {
    const graph = mutations()
    graph.addNode(node(1), context)
    const live = useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))
    assert.exists(live)
    live.color = '#ff0000'

    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNode(node(1))
      })
    ).toBe(true)

    expect(
      useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))?.color
    ).toBe('#ff0000')
  })

  it('adds the authoritative payload directly to node, widget, and layout stores', () => {
    expect(mutations().addNode(node(7, { seed: 42 }), context)).toBe(true)

    const [state] = useNodeDataStore().getGraphNodesFor('root', 'root')
    expect(state).toMatchObject({
      id: '7',
      type: 'Type7',
      title: 'Node 7',
      flags: { pinned: true },
      properties: { source: 'mint-time' }
    })
    expect(state.lastSerialization).toEqual(node(7, { seed: 42 }))
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(7), 'seed'))
    ).toMatchObject({ name: 'seed', value: 42, type: 'number' })
    expect(createLayout).toHaveBeenCalledWith(
      scope,
      toNodeId(7),
      {
        position: { x: 70, y: 140 },
        size: { width: 200, height: 100 }
      },
      context
    )
  })

  it('keeps runtime-only fields out of prepared slots', () => {
    const graph = mutations()
    const payload = {
      ...node(7),
      inputs: [
        {
          name: 'in',
          type: 'IMAGE',
          label: 'Input',
          link: null,
          _node: { corrupt: true }
        }
      ],
      outputs: [
        {
          name: 'out',
          type: 'IMAGE',
          label: 'Output',
          links: [],
          _data: { corrupt: true }
        }
      ]
    }

    expect(graph.addNode(payload, context)).toBe(true)

    const state = useNodeDataStore().getNode(scope.rootGraphId, toNodeId(7))
    expect(state?.inputs[0]).toMatchObject({ name: 'in', label: 'Input' })
    expect(state?.outputs[0]).toMatchObject({ name: 'out', label: 'Output' })
    expect(state?.inputs[0]).not.toHaveProperty('_node')
    expect(state?.outputs[0]).not.toHaveProperty('_data')
  })

  it('repositions a template node placed far from an existing node', () => {
    const graph = mutations()
    graph.addNode({ ...node(1), pos: [0, 0] }, context)
    createLayout.mockClear()

    expect(graph.addNode({ ...node(2), pos: [9000, 9000] }, context)).toBe(true)

    const [, , layout] = createLayout.mock.calls[0]
    expect(Math.hypot(layout.position.x, layout.position.y)).toBeLessThan(2000)
    expect(
      useNodeDataStore().getNode(scope.rootGraphId, toNodeId(2))
        ?.lastSerialization?.pos
    ).toEqual([layout.position.x, layout.position.y])
  })

  it('keeps a far batch layout intact, moved by one shared offset', () => {
    const graph = mutations()
    graph.addNode({ ...node(1), pos: [0, 0] }, context)
    createLayout.mockClear()

    expect(
      graph.batch(context, (batch) => {
        batch.addNode({ ...node(2), pos: [9000, 9000] })
        batch.addNode({ ...node(3), pos: [9400, 9100] })
      })
    ).toBe(true)

    const [first, second] = createLayout.mock.calls.map(
      ([, , layout]) => layout.position
    )
    expect(second.x - first.x).toBe(400)
    expect(second.y - first.y).toBe(100)
    expect(Math.hypot(first.x, first.y)).toBeLessThan(2000)
  })

  it.for(['reconcileNode', 'reconcileNodeFields'] as const)(
    'keeps doc coordinates when a resync materializes a missing node via %s',
    (via) => {
      const graph = mutations()
      graph.addNode({ ...node(1), pos: [0, 0] }, context)
      createLayout.mockClear()

      expect(
        graph.batch(context, (batch) => {
          batch[via]({ ...node(2), pos: [9000, 9000] })
        })
      ).toBe(true)

      const [, , layout] = createLayout.mock.calls[0]
      expect(layout.position).toEqual({ x: 9000, y: 9000 })
    }
  )

  it('projects a remote widget value into the live widget adapter', () => {
    const graph = mutations()
    expect(graph.addNode(node(7, { image: 'before.png' }), context)).toBe(true)
    setLiveWidgetValue.mockClear()

    expect(graph.setWidget(toNodeId(7), 'image', 'after.png', context)).toBe(
      true
    )

    expect(setLiveWidgetValue).toHaveBeenCalledOnce()
    expect(setLiveWidgetValue).toHaveBeenCalledWith(
      scope,
      toNodeId(7),
      'image',
      'after.png',
      context
    )
  })

  it('projects add-node widget values before committing them to the store', () => {
    setLiveWidgetValue.mockImplementation(() => {
      expect(
        useWidgetValueStore().getWidget(widgetId('root', toNodeId(7), 'image'))
      ).toBeUndefined()
      return { status: 'applied', resolvedValue: 'added.png' }
    })

    expect(mutations().addNode(node(7, { image: 'added.png' }), context)).toBe(
      true
    )
    expect(setLiveWidgetValue).toHaveBeenCalledWith(
      scope,
      toNodeId(7),
      'image',
      'added.png',
      context
    )
  })

  it('converges canonical state on the live widget rollback value, not the remote value', () => {
    const graph = mutations()
    expect(graph.addNode(node(7, { image: 'before.png' }), context)).toBe(true)
    setLiveWidgetValue.mockReset()
    setLiveWidgetValue.mockReturnValue({
      status: 'rolledBack',
      resolvedValue: 'before.png'
    })

    expect(graph.setWidget(toNodeId(7), 'image', 'after.png', context)).toBe(
      true
    )

    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(7), 'image'))
    ).toMatchObject({ value: 'before.png' })
  })

  it.for([null, undefined])(
    'preserves a nullish live widget result of %s',
    (resolvedValue) => {
      const graph = mutations()
      expect(graph.addNode(node(7, { image: 'before.png' }), context)).toBe(
        true
      )
      setLiveWidgetValue.mockReset()
      setLiveWidgetValue.mockReturnValue({
        status: 'applied',
        resolvedValue
      })

      expect(graph.setWidget(toNodeId(7), 'image', 'after.png', context)).toBe(
        true
      )
      expect(
        useWidgetValueStore().getWidget(widgetId('root', toNodeId(7), 'image'))
      ).toMatchObject({ value: resolvedValue })
    }
  )

  it('commits the remote value when live projection is skipped', () => {
    const graph = mutations()
    expect(graph.addNode(node(7, { image: 'before.png' }), context)).toBe(true)
    setLiveWidgetValue.mockReset()
    setLiveWidgetValue.mockReturnValue({ status: 'skipped' })

    expect(graph.setWidget(toNodeId(7), 'image', 'after.png', context)).toBe(
      true
    )
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(7), 'image'))
    ).toMatchObject({ value: 'after.png' })
  })

  it('retains supplied link ids and atomically displaces the target occupant', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode(node(2))
      batch.addNode(node(3))
    })
    expect(
      graph.connect(
        {
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 3,
          targetSlot: 0,
          type: 'IMAGE'
        },
        context
      )
    ).toBe(true)
    expect(
      graph.connect(
        {
          id: 10,
          originNodeId: 2,
          originSlot: 0,
          targetNodeId: 3,
          targetSlot: 0,
          type: 'IMAGE'
        },
        context
      )
    ).toBe(true)

    const links = useLinkStore()
    expect(links.getTopology(scope.rootGraphId, toLinkId(9))).toBeUndefined()
    expect(links.getTopology(scope.rootGraphId, toLinkId(10))).toMatchObject({
      originNodeId: '2',
      targetNodeId: '3'
    })
  })

  it('validates the whole plan before committing any writes', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const applied = mutations().batch(context, (batch) => {
      batch.addNode(node(1))
      batch.connect({
        id: 1,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 404,
        targetSlot: 0,
        type: 'IMAGE'
      })
    })

    expect(applied).toBe(false)
    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
    expect(createLayout).not.toHaveBeenCalled()
    error.mockRestore()
  })

  // The agent's connect tool used to wire an IMAGE output straight into a
  // STRING prompt input (Grok Image Edit, GPT Image 2) and have the mutation
  // accepted as if valid — only ComfyUI's execution-time prompt validator
  // caught it later, long after the agent had told the user the graph was
  // built. The interactive canvas never allows this: LGraphNode.connectSlots
  // gates every human-dragged link on LiteGraph.isValidConnection(output.type,
  // input.type). This remote/CRDT path is the ONLY way the agent edits the
  // graph, so `connect` now runs the same isValidConnection check against the
  // origin output's declared type and the target input's before applying it.
  it('rejects connecting an incompatible slot type pair', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const graph = mutations()
    const applied = graph.batch(context, (batch) => {
      batch.addNode({
        ...node(1),
        outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }]
      })
      batch.addNode({
        ...node(2),
        inputs: [{ name: 'prompt', type: 'STRING', link: null }]
      })
      batch.connect({
        id: 1,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 2,
        targetSlot: 0,
        type: 'STRING'
      })
    })

    // A human dragging this exact link on canvas is refused by
    // LiteGraph.isValidConnection; the agent's remote mutation path refuses
    // it too instead of silently wiring IMAGE into a STRING input.
    expect(applied).toBe(false)
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(1))
    ).toBeUndefined()
    error.mockRestore()
  })

  it('rejects a sibling-owned node collision before committing earlier writes', () => {
    const siblingScope = {
      rootGraphId: scope.rootGraphId,
      owningGraphId: toOwningGraphId('sibling')
    }
    const sibling = createGraphMutations({
      getScope: () => siblingScope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts },
      placement
    })
    sibling.addNode(node(9), context)
    createLayout.mockClear()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const applied = mutations().batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode(node(9))
    })

    expect(applied).toBe(false)
    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'sibling')
        .map(({ id }) => id)
    ).toEqual([toNodeId(9)])
    expect(createLayout).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('rejects a sibling-owned link removal before committing earlier writes', () => {
    const siblingScope = {
      rootGraphId: scope.rootGraphId,
      owningGraphId: toOwningGraphId('sibling')
    }
    const sibling = createGraphMutations({
      getScope: () => siblingScope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts },
      placement
    })
    sibling.batch(context, (batch) => {
      batch.addNode(node(8))
      batch.addNode(node(9))
      batch.connect({
        id: 99,
        originNodeId: 8,
        originSlot: 0,
        targetNodeId: 9,
        targetSlot: 0,
        type: 'IMAGE'
      })
    })
    createLayout.mockClear()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const applied = mutations().batch(context, (batch) => {
      batch.addNode(node(1))
      batch.removeLinks([99])
    })

    expect(applied).toBe(false)
    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(99))
    ).toBeDefined()
    expect(createLayout).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('rejects unkeyable widgets before committing any writes', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const applied = mutations().batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode(node(2, { '': 42 }))
    })

    expect(applied).toBe(false)
    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
    expect(createLayout).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('reconciles a seeded node while preserving renderer-owned layout', () => {
    const graph = mutations()
    graph.addNode(node(1, { seed: 1, stale: 'old' }), context)
    const [existing] = useNodeDataStore().getGraphNodesFor('root', 'root')
    const liveWidgetState = useWidgetValueStore().getWidget(
      widgetId('root', toNodeId(1), 'seed')
    )
    createLayout.mockClear()
    deleteLayouts.mockClear()

    expect(
      graph.batch({ ...context, opId: 'bootstrap' }, (batch) => {
        batch.reconcileNode({
          ...node(1, { seed: 42 }),
          title: 'Seeded authority'
        })
      })
    ).toBe(true)

    const [reconciled] = useNodeDataStore().getGraphNodesFor('root', 'root')
    expect(reconciled).toBe(existing)
    expect(reconciled.title).toBe('Seeded authority')
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), 'seed'))
    ).toBe(liveWidgetState)
    expect(liveWidgetState?.value).toBe(42)
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), 'stale'))
        ?.value
    ).toBe('old')
    expect(graph.setWidget(toNodeId(1), 'seed', 84, context)).toBe(true)
    expect(liveWidgetState?.value).toBe(84)
    expect(deleteLayouts).not.toHaveBeenCalled()
    expect(createLayout).not.toHaveBeenCalled()
  })

  // A reconcile must not wholesale-replace a live node's presentation-only
  // `color` or an autogrow input's client-computed `localized_name` when the
  // CRDT payload omits them, since the document never carries either field.
  it("keeps a live node's color and friendly input label across a reconcile", () => {
    const graph = mutations()
    graph.addNode(node(1), context)
    const [existing] = useNodeDataStore().getGraphNodesFor('root', 'root')
    existing.color = '#ff0000'
    existing.inputs[0].localized_name = 'image_1'

    expect(
      graph.batch({ ...context, opId: 'resync' }, (batch) => {
        batch.reconcileNode({ ...node(1), title: 'Reconciled' })
      })
    ).toBe(true)

    const [reconciled] = useNodeDataStore().getGraphNodesFor('root', 'root')
    expect(reconciled.color).toBe('#ff0000')
    expect(reconciled.inputs[0].localized_name).toBe('image_1')
  })

  // The merge must still be a merge, not a pin: when the doc payload *does*
  // carry an explicit color, or the slot at that index is genuinely a
  // different input (not just a redundant resync of the same one), the fix
  // must not keep stale values behind the live node's back.
  it('still applies a color the doc payload sets, and does not carry a stale label onto a genuinely different input at the same slot index', () => {
    const graph = mutations()
    graph.addNode(node(1), context)
    const [existing] = useNodeDataStore().getGraphNodesFor('root', 'root')
    existing.color = '#ff0000'
    existing.inputs[0].localized_name = 'image_1'

    expect(
      graph.batch({ ...context, opId: 'resync' }, (batch) => {
        batch.reconcileNode({
          ...node(1),
          color: '#00ff00',
          inputs: [{ name: 'a-different-input', type: 'IMAGE', link: null }]
        })
      })
    ).toBe(true)

    const [reconciled] = useNodeDataStore().getGraphNodesFor('root', 'root')
    expect(reconciled.color).toBe('#00ff00')
    expect(reconciled.inputs[0].localized_name).toBeUndefined()
  })

  it('resyncs scalar fields without touching slots, widgets, or layout', () => {
    const graph = mutations()
    graph.addNode(node(1, { seed: 1 }), context)
    graph.addNode(node(2), context)
    expect(
      graph.connect(
        {
          id: 9,
          originNodeId: 2,
          originSlot: 0,
          targetNodeId: 1,
          targetSlot: 0,
          type: 'IMAGE',
          targetInputs: [{ name: 'in', type: 'IMAGE', link: toLinkId(9) }]
        },
        context
      )
    ).toBe(true)
    const [existing] = useNodeDataStore().getGraphNodesFor('root', 'root')
    const [inputBefore] = existing.inputs
    expect(inputBefore.link).toBe(toLinkId(9))
    createLayout.mockClear()
    deleteLayouts.mockClear()

    expect(
      graph.batch({ ...context, opId: 'resync' }, (batch) => {
        batch.reconcileNodeFields({
          ...node(1),
          title: 'Renamed host',
          mode: 2,
          flags: { collapsed: true },
          properties: { source: 'doc' },
          // Doc slot records are stale on purpose: they must be ignored.
          inputs: [{ name: 'in', type: 'IMAGE', link: null }],
          widgets_values: {}
        })
      })
    ).toBe(true)

    const [resynced] = useNodeDataStore().getGraphNodesFor('root', 'root')
    expect(resynced).toBe(existing)
    expect(resynced.title).toBe('Renamed host')
    expect(resynced.mode).toBe(2)
    expect(resynced.flags).toEqual({ collapsed: true })
    expect(resynced.properties).toEqual({ source: 'doc' })
    expect(resynced.inputs[0]).toBe(inputBefore)
    expect(resynced.inputs[0].link).toBe(toLinkId(9))
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), 'seed'))
        ?.value
    ).toBe(1)
    expect(deleteLayouts).not.toHaveBeenCalled()
    expect(createLayout).not.toHaveBeenCalled()
  })

  it('adds a missing field-reconciled node and rejects incomplete payloads', () => {
    const graph = mutations()
    graph.addNode(node(1, { seed: 1 }), context)

    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNodeFields({ ...node(3), title: 'Ghost' })
      })
    ).toBe(true)
    expect(
      useNodeDataStore().getNode(scope.rootGraphId, toNodeId(3))?.title
    ).toBe('Ghost')
    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNodeFields({ ...node(1), type: '' })
      })
    ).toBe(false)
    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNodeFields({ ...node(1), title: 'Live' })
        batch.reconcileNodeFields({ ...node(4), type: '' })
      })
    ).toBe(false)

    expect(
      useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))?.title
    ).toBe('Node 1')
  })

  it('replaces a field-reconciled node when its type changes', () => {
    const graph = mutations()
    graph.addNode(node(1, { seed: 1 }), context)
    const existing = useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))
    assert.exists(existing)
    existing.color = '#432'
    existing.bgcolor = '#653'
    existing.inputs[0].localized_name = 'old display name'
    createLayout.mockClear()
    deleteLayouts.mockClear()

    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNodeFields({
          ...node(1, { replacement: 2 }),
          type: 'Replacement'
        })
      })
    ).toBe(true)

    const replacement = useNodeDataStore().getNode(
      scope.rootGraphId,
      toNodeId(1)
    )
    expect(replacement).not.toBe(existing)
    expect(replacement?.type).toBe('Replacement')
    expect(replacement?.color).toBeUndefined()
    expect(replacement?.bgcolor).toBeUndefined()
    expect(replacement?.inputs[0].localized_name).toBeUndefined()
    expect(
      useWidgetValueStore().getWidget(
        widgetId(scope.rootGraphId, toNodeId(1), 'replacement')
      )?.value
    ).toBe(2)
    expect(deleteLayouts).not.toHaveBeenCalled()
    expect(createLayout).toHaveBeenCalledOnce()
    expect(createdLayouts.has('1')).toBe(true)
  })

  it('keeps a document-only input at the prepared link target after replacing the input set', () => {
    const graph = mutations()
    graph.addNode(node(1), context)
    graph.addNode(
      {
        ...node(2),
        inputs: [
          { name: 'in', type: 'IMAGE', link: null },
          { name: 'spare', type: 'IMAGE', link: null }
        ]
      },
      context
    )

    expect(
      graph.connect(
        {
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 1,
          type: 'IMAGE',
          targetInputs: [
            { name: 'in', type: 'IMAGE', link: null },
            { name: 'new_from_doc', type: 'IMAGE', link: toLinkId(9) }
          ]
        },
        context
      )
    ).toBe(true)

    const target = useNodeDataStore().getNode(scope.rootGraphId, toNodeId(2))
    const topology = useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    assert.exists(target)
    assert.exists(topology)
    expect(target.inputs.map(({ name }) => name)).toEqual([
      'in',
      'new_from_doc'
    ])
    expect(target.inputs[topology.targetSlot]).toMatchObject({
      name: 'new_from_doc',
      link: toLinkId(9)
    })
  })

  it('updates endpoint slot records while retaining the supplied link id', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode(node(2))
      batch.connect({
        id: 9,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 2,
        targetSlot: 1,
        type: 'IMAGE',
        originOutputs: [{ name: 'out', type: 'IMAGE', links: [toLinkId(9)] }],
        targetInputs: [
          { name: 'in', type: 'IMAGE', link: null },
          { name: 'grown', type: 'IMAGE', link: toLinkId(9) }
        ]
      })
    })

    const states = useNodeDataStore().getGraphNodesFor('root', 'root')
    expect(
      states.find(({ id }) => id === toNodeId(1))?.outputs[0].links
    ).toEqual([toLinkId(9)])
    expect(states.find(({ id }) => id === toNodeId(2))?.inputs).toHaveLength(2)
    expect(
      states.find(({ id }) => id === toNodeId(2))?.inputs[1]
    ).toMatchObject({
      name: 'grown',
      link: toLinkId(9)
    })
  })

  it('drops a removed leading output instead of duplicating the surviving one', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode({
        ...node(1),
        outputs: [
          { name: 'removed', type: 'IMAGE', links: [] },
          { name: 'kept', type: 'IMAGE', links: [] }
        ]
      })
      batch.addNode(node(2))
    })
    const outputs = useNodeDataStore().getNode('root', toNodeId(1))?.outputs
    assert.exists(outputs)

    expect(
      graph.batch({ ...context, opId: 'connect-onto-kept' }, (batch) => {
        batch.connect({
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 0,
          type: 'IMAGE',
          // The document has already dropped 'removed' by the time this
          // snapshot was taken, so 'kept' (live index 1) is its sole,
          // index-0 output.
          originOutputs: [{ name: 'kept', type: 'IMAGE', links: [toLinkId(9)] }]
        })
      })
    ).toBe(true)

    const origin = useNodeDataStore().getNode('root', toNodeId(1))
    assert.exists(origin)
    expect(origin.outputs).toBe(outputs)
    expect(origin.outputs.map(({ name }) => name)).toEqual(['kept'])
    expect(origin.outputs).toHaveLength(1)
  })

  it('keeps the live link on target slots whose supplied record omits link', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode(node(2))
      batch.addNode(node(3))
      batch.connect({
        id: 5,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 2,
        targetSlot: 0,
        type: 'IMAGE',
        targetInputs: [
          { name: 'in', type: 'IMAGE', link: toLinkId(5) },
          { name: 'grown', type: 'IMAGE', link: null }
        ]
      })
    })

    expect(
      graph.batch({ ...context, opId: 'op-2' }, (batch) => {
        batch.connect({
          id: 9,
          originNodeId: 3,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 1,
          type: 'IMAGE',
          targetInputs: [
            { name: 'in', type: 'IMAGE' },
            { name: 'grown', type: 'IMAGE', link: toLinkId(9) }
          ]
        })
      })
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ link }) => link)).toEqual([
      toLinkId(5),
      toLinkId(9)
    ])
  })

  it('lets two connects on one target within a batch both keep their links', () => {
    const graph = mutations()
    graph.addNode(node(1), context)
    graph.addNode(
      {
        ...node(2),
        inputs: [
          { name: 'in', type: 'IMAGE', link: null },
          { name: 'grown', type: 'IMAGE', link: null }
        ]
      },
      context
    )
    graph.addNode(node(3), context)
    const target = useNodeDataStore().getNode('root', toNodeId(2))!
    const [firstInput, grownInput] = target.inputs
    Object.assign(firstInput, { label: 'live input' })
    Object.assign(grownInput, { label: 'live grown input' })

    expect(
      graph.batch(context, (batch) => {
        batch.connect({
          id: 5,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 0,
          type: 'IMAGE',
          targetInputs: [
            { name: 'in', type: 'IMAGE', link: toLinkId(5) },
            { name: 'grown', type: 'IMAGE' }
          ]
        })
        batch.connect({
          id: 9,
          originNodeId: 3,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 1,
          type: 'IMAGE',
          targetInputs: [
            { name: 'in', type: 'IMAGE' },
            { name: 'grown', type: 'IMAGE', link: toLinkId(9) }
          ]
        })
      })
    ).toBe(true)

    expect(target.inputs.map(({ link }) => link)).toEqual([
      toLinkId(5),
      toLinkId(9)
    ])
    expect(target.inputs[0]).toBe(firstInput)
    expect(target.inputs[1]).toBe(grownInput)
    expect(target.inputs.map(({ label }) => label)).toEqual([
      'live input',
      'live grown input'
    ])
  })

  it('merges input and output updates for self-links within a batch', () => {
    const graph = mutations()
    expect(
      graph.batch(context, (batch) => {
        batch.addNode({
          ...node(1),
          inputs: [
            { name: 'in-0', type: 'IMAGE', link: null },
            { name: 'in-1', type: 'IMAGE', link: null }
          ],
          outputs: [{ name: 'out-0', type: 'IMAGE', links: [] }]
        })
        batch.connect({
          id: 5,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 1,
          targetSlot: 0,
          type: 'IMAGE',
          originOutputs: [
            { name: 'out-0', type: 'IMAGE', links: [toLinkId(5)] },
            { name: 'out-1', type: 'IMAGE', links: [] }
          ],
          targetInputs: [
            { name: 'in-0', type: 'IMAGE', link: toLinkId(5) },
            { name: 'in-1', type: 'IMAGE', link: null }
          ]
        })
        batch.connect({
          id: 9,
          originNodeId: 1,
          originSlot: 1,
          targetNodeId: 1,
          targetSlot: 1,
          type: 'IMAGE',
          targetInputs: [
            { name: 'in-0', type: 'IMAGE', link: toLinkId(5) },
            { name: 'in-1', type: 'IMAGE', link: toLinkId(9) }
          ]
        })
      })
    ).toBe(true)

    const [state] = useNodeDataStore().getGraphNodesFor('root', 'root')
    expect(state.inputs.map(({ link }) => link)).toEqual([
      toLinkId(5),
      toLinkId(9)
    ])
    expect(state.outputs.map(({ links }) => links)).toEqual([[toLinkId(5)], []])
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    ).toBeDefined()
  })

  it("patches only a target slot's presentation fields, never its boundingRect", () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode(node(2))
    })
    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    assert.exists(target)
    const liveBoundingRect: readonly [number, number, number, number] = [
      1, 2, 3, 4
    ]
    target.inputs[0].boundingRect = liveBoundingRect
    const [first] = target.inputs

    expect(
      graph.connect(
        {
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 0,
          type: 'IMAGE',
          targetInputs: [
            {
              name: 'in',
              localized_name: 'Renamed',
              type: 'IMAGE',
              link: toLinkId(9)
            }
          ]
        },
        context
      )
    ).toBe(true)

    expect(target.inputs[0]).toBe(first)
    expect(target.inputs[0].localized_name).toBe('Renamed')
    // Not the stub `prepareInputSlot` bakes into the serialized side: the
    // live measurement must survive the patch untouched.
    expect(target.inputs[0].boundingRect).toEqual([1, 2, 3, 4])
  })

  it('never resurrects a live output beyond the ones the document supplies', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode({
        ...node(1),
        outputs: [
          { name: 'out-0', type: 'IMAGE', links: [] },
          { name: 'out-1', type: 'IMAGE', links: [] }
        ]
      })
      batch.addNode(node(2))
    })

    expect(
      graph.connect(
        {
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 0,
          type: 'IMAGE',
          originOutputs: [
            { name: 'out-0', type: 'IMAGE', links: [toLinkId(9)] }
          ]
        },
        context
      )
    ).toBe(true)

    const origin = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(1))
    expect(origin?.outputs).toHaveLength(1)
    expect(origin?.outputs[0]).toMatchObject({
      name: 'out-0',
      links: [toLinkId(9)]
    })
  })

  it('keeps two identically named target inputs as distinct live slots', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [
          { name: 'dup', type: 'IMAGE', link: null },
          { name: 'dup', type: 'IMAGE', link: null }
        ]
      })
    })
    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    assert.exists(target)
    const [first, second] = target.inputs

    expect(
      graph.connect(
        {
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 1,
          type: 'IMAGE',
          targetInputs: [
            { name: 'dup', type: 'IMAGE', link: null },
            { name: 'dup', type: 'IMAGE', link: toLinkId(9) }
          ]
        },
        context
      )
    ).toBe(true)

    expect(target.inputs).toHaveLength(2)
    expect(target.inputs[0]).toBe(first)
    expect(target.inputs[1]).toBe(second)
    expect(target.inputs.map(({ link }) => link)).toEqual([null, toLinkId(9)])
  })

  it('grows a live target to match a document that repeats a shared input name more often than live has it', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [{ name: 'dup', type: 'IMAGE', link: null }]
      })
    })

    expect(
      graph.connect(
        {
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 1,
          type: 'IMAGE',
          targetInputs: [
            { name: 'dup', type: 'IMAGE', link: null },
            { name: 'dup', type: 'IMAGE', link: toLinkId(9) }
          ]
        },
        context
      )
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ link }) => link)).toEqual([null, toLinkId(9)])
  })

  it('drops a live-only linked input the reconciled document no longer names', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [
          { name: 'in', type: 'IMAGE', link: null },
          { name: 'grown', type: 'IMAGE', link: null }
        ]
      })
      batch.connect({
        id: 9,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 2,
        targetSlot: 1,
        type: 'IMAGE',
        targetInputs: [
          { name: 'in', type: 'IMAGE', link: null },
          { name: 'grown', type: 'IMAGE', link: toLinkId(9) }
        ]
      })
    })

    expect(
      graph.batch({ ...context, opId: 'shrink' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          inputs: [{ name: 'in', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual(['in'])
  })

  it('drops the excess linked occurrence when a document shrinks a duplicate-named input', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [{ name: 'dup', type: 'IMAGE', link: null }]
      })
      batch.connect({
        id: 9,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 2,
        targetSlot: 1,
        type: 'IMAGE',
        targetInputs: [
          { name: 'dup', type: 'IMAGE', link: null },
          { name: 'dup', type: 'IMAGE', link: toLinkId(9) }
        ]
      })
    })

    expect(
      graph.batch({ ...context, opId: 'shrink-dup' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          inputs: [{ name: 'dup', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual(['dup'])
    expect(target?.inputs[0]?.link).toBeNull()
  })

  it('keeps an unlinked grown input the document has not caught up to yet', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        // `group.grown_0`, not a bare name: an unlinked live-only leftover
        // is only tolerated as unpropagated growth when it is shaped like an
        // autogrow slot's default naming, ending in its ordinal (see
        // `drops an ordinary unlinked extra input...` and the
        // DynamicCombo test below for the same leftover without that shape).
        inputs: [
          { name: 'in', type: 'IMAGE', link: null },
          { name: 'group.grown_0', type: 'IMAGE', link: null }
        ]
      })
    })

    expect(
      graph.batch({ ...context, opId: 'resync' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          title: 'Resynced',
          inputs: [{ name: 'in', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual([
      'in',
      'group.grown_0'
    ])
  })

  it("keeps an unlinked grown input when the live node answers 'unavailable' (activate/resubscribe, before the live node can answer), falling back to the name-shape heuristic instead of treating it as not a member", () => {
    // A wired `liveNodes` port that cannot yet answer for this node (e.g.
    // right after activate/resubscribe, before the live node exists) must
    // fall back to `nameShapeAutogrowGroupOf` exactly like having no port at
    // all -- not be trusted as an authoritative "not a member", which would
    // drop the spare and misattribute a later link (see the DynamicCombo
    // "confirms it belongs to no autogrow group" test above for what an
    // authoritative "no" from a live port should do instead).
    const graph = mutations({
      autogrowGroupOf: () => ({ kind: 'unavailable' })
    })
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [
          { name: 'in', type: 'IMAGE', link: null },
          { name: 'group.grown_0', type: 'IMAGE', link: null }
        ]
      })
    })

    expect(
      graph.batch(
        { ...context, opId: 'resubscribe-before-live-answers' },
        (batch) => {
          batch.reconcileNode({
            ...node(2),
            title: 'Resynced',
            inputs: [{ name: 'in', type: 'IMAGE' }]
          })
        }
      )
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual([
      'in',
      'group.grown_0'
    ])
  })

  it('drops an ordinary unlinked extra input the document legitimately dropped', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [
          { name: 'keep', type: 'IMAGE', link: null },
          { name: 'obsolete', type: 'IMAGE', link: null }
        ]
      })
    })

    expect(
      graph.batch({ ...context, opId: 'drop-obsolete' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          inputs: [{ name: 'keep', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual(['keep'])
  })

  it('drops a linked, non-plain runtime slot the document dropped, even with preserveLinkedAutogrow set', () => {
    // `preserveLinkedAutogrow` only permits a linked leftover that ALSO
    // classifies as an autogrow member -- it never blanket-exempts a live
    // slot instance (as opposed to a plain data record) from that
    // classification. `extra_runtime_slot` is inserted directly as a
    // non-plain instance (a real live node's own slot object, not a stored
    // plain record) and is not autogrow-shaped, so it must not survive this
    // reconcile just because a connect elsewhere in the same batch opts the
    // merge into `preserveLinkedAutogrow`.
    class LiveSlotStub {
      readonly boundingRect: [number, number, number, number] = [0, 0, 0, 0]
      constructor(
        readonly name: string,
        readonly type: string,
        readonly link: LinkId
      ) {}
    }

    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [{ name: 'in', type: 'IMAGE', link: null }]
      })
    })

    const state = useNodeDataStore().getNode(scope.rootGraphId, toNodeId(2))
    assert(state)
    state.inputs.push(
      new LiveSlotStub('extra_runtime_slot', 'IMAGE', toLinkId(77))
    )

    expect(
      graph.batch(
        { ...context, opId: 'preserve-linked-non-member' },
        (batch) => {
          // Mutation 0: the document drops 'extra_runtime_slot'. The connect
          // below targets this same node elsewhere in the batch, so this
          // reconcile's merge opts into `preserveLinkedAutogrow`.
          batch.reconcileNode({
            ...node(2),
            inputs: [{ name: 'in', type: 'IMAGE' }]
          })
          // Present only so `queued.some(...)` finds a same-batch connect
          // targeting node 2; it carries no `targetInputs`, so it never
          // itself touches node 2's input list.
          batch.connect({
            id: 10,
            originNodeId: 1,
            originSlot: 0,
            targetNodeId: toNodeId(2),
            targetSlot: 0,
            type: 'IMAGE'
          })
        }
      )
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual(['in'])
  })

  it('retains a widget-promoted input slot no document snapshot ever lists', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [{ name: 'keep', type: 'IMAGE', link: null }]
      })
    })

    const state = useNodeDataStore().getNode(scope.rootGraphId, toNodeId(2))
    assert(state)
    const promoted: (typeof state.inputs)[number] = {
      name: 'ref_image_size',
      type: 'COMBO',
      link: null,
      widget: { name: 'ref_image_size' },
      boundingRect: [0, 0, 0, 0]
    }
    state.inputs.push(promoted)

    expect(
      graph.batch(
        { ...context, opId: 'reconcile-with-widget-slot' },
        (batch) => {
          batch.reconcileNode({
            ...node(2),
            inputs: [{ name: 'keep', type: 'IMAGE' }]
          })
        }
      )
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual([
      'keep',
      'ref_image_size'
    ])
    expect(toRaw(target?.inputs[1])).toBe(promoted)
    expect(target?.inputs[1]?.widget).toEqual({ name: 'ref_image_size' })
    expect(target?.inputs[1]?.type).toBe('COMBO')
    expect(target?.inputs[1]?.link).toBeNull()
  })

  it('drops a removed, unlinked DynamicCombo input instead of mistaking it for a spare autogrow slot', () => {
    // `mode.strength` is COMFY_DYNAMICCOMBO_V3's own dotted shape
    // (`dynamicWidgets.ts`'s `updateWidgets`: `${widget.name}.${key}`), not
    // autogrow's -- its suffix is an ordinary field name, not an ordinal, so
    // it must not be mistaken for an unpropagated autogrow spare.
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [
          { name: 'keep', type: 'IMAGE', link: null },
          { name: 'mode.strength', type: 'FLOAT', link: null }
        ]
      })
    })

    expect(
      graph.batch({ ...context, opId: 'drop-dynamiccombo-input' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          inputs: [{ name: 'keep', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual(['keep'])
  })

  it('retains a DynamicCombo key that happens to end in an all-numeric segment, absent a live node to disprove it (documented heuristic limitation)', () => {
    // A real DynamicCombo can mint a key whose final segment is itself
    // numeric (e.g. nested combos producing `...0.0.0.0`), which passes
    // `nameShapeAutogrowGroupOf`'s trailing-digit test exactly like a
    // genuine autogrow ordinal would. Without a live node to ask, this
    // heuristic-only fallback cannot tell the two apart and wrongly keeps
    // the removed input -- see the false positive documented on
    // `nameShapeAutogrowGroupOf`.
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [
          { name: 'keep', type: 'IMAGE', link: null },
          { name: '0.0.0.0', type: 'FLOAT', link: null }
        ]
      })
    })

    expect(
      graph.batch(
        { ...context, opId: 'drop-numeric-dynamiccombo-heuristic' },
        (batch) => {
          batch.reconcileNode({
            ...node(2),
            inputs: [{ name: 'keep', type: 'IMAGE' }]
          })
        }
      )
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual(['keep', '0.0.0.0'])
  })

  it('drops that same numeric-looking DynamicCombo key when a live node confirms it belongs to no autogrow group', () => {
    const graph = mutations({ autogrowGroupOf: () => ({ kind: 'notMember' }) })
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [
          { name: 'keep', type: 'IMAGE', link: null },
          { name: '0.0.0.0', type: 'FLOAT', link: null }
        ]
      })
    })

    expect(
      graph.batch(
        { ...context, opId: 'drop-numeric-dynamiccombo-live' },
        (batch) => {
          batch.reconcileNode({
            ...node(2),
            inputs: [{ name: 'keep', type: 'IMAGE' }]
          })
        }
      )
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual(['keep'])
  })

  it("drops a numeric-shaped DynamicCombo key remembered as not-a-member, even once the live node answers 'unavailable'", () => {
    // The live node's `notMember` answer above is remembered for this exact
    // node and name; a later resync that finds the same name live-only
    // again must keep trusting that memory over the name-shape heuristic,
    // even once the live node itself stops being reachable.
    let liveReachable = true
    const graph = mutations({
      autogrowGroupOf: () =>
        liveReachable ? { kind: 'notMember' } : { kind: 'unavailable' }
    })
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [
          { name: 'keep', type: 'IMAGE', link: null },
          { name: '0.0.0.0', type: 'FLOAT', link: null }
        ]
      })
    })

    // Live confirms '0.0.0.0' belongs to no autogrow group; it is dropped
    // and that answer is remembered.
    graph.batch({ ...context, opId: 'drop-numeric-live' }, (batch) => {
      batch.reconcileNode({
        ...node(2),
        inputs: [{ name: 'keep', type: 'IMAGE' }]
      })
    })

    // The document re-adds '0.0.0.0' as an ordinary new input -- live has
    // no occurrence of it yet, so this is an unambiguous addition, not the
    // live-only-unaccounted-for case `autogrowGroupOf` is consulted for.
    graph.batch({ ...context, opId: 're-add-numeric' }, (batch) => {
      batch.reconcileNode({
        ...node(2),
        inputs: [
          { name: 'keep', type: 'IMAGE' },
          { name: '0.0.0.0', type: 'FLOAT' }
        ]
      })
    })

    // The document drops it again while the live node is unavailable. The
    // name-shape heuristic alone would wrongly treat the trailing-digit
    // shape as an unpropagated autogrow spare and retain it; the remembered
    // `notMember` answer correctly treats it as an ordinary removed input.
    liveReachable = false
    expect(
      graph.batch({ ...context, opId: 'drop-numeric-unavailable' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          inputs: [{ name: 'keep', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    const numericKeyTarget = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(numericKeyTarget?.inputs.map(({ name }) => name)).toEqual(['keep'])
  })

  // An autogrow group defined with an explicit `names` list (`refs.a`,
  // `refs.b`, ...) rather than the default numeric-ordinal naming: its
  // members don't end in a digit, so `nameShapeAutogrowGroupOf` can't
  // recognize `refs.b` as autogrow-shaped at all.
  function explicitNamesGroupScenario() {
    return (batch: GraphMutationBatch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [
          { name: 'refs.a', type: 'IMAGE', link: null },
          // Unpropagated growth: grown live, not yet named by the document.
          { name: 'refs.b', type: 'IMAGE', link: null },
          { name: 'alpha', type: 'IMAGE', link: null },
          { name: 'beta', type: 'IMAGE', link: null }
        ]
      })
      batch.connect({
        id: 60,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 2,
        targetSlot: 0,
        type: 'IMAGE',
        targetInputs: [
          { name: 'refs.a', type: 'IMAGE', link: toLinkId(60) },
          { name: 'refs.b', type: 'IMAGE', link: null },
          { name: 'alpha', type: 'IMAGE', link: null },
          { name: 'beta', type: 'IMAGE', link: null }
        ]
      })
      batch.connect({
        id: 61,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 2,
        targetSlot: 2,
        type: 'IMAGE',
        targetInputs: [
          { name: 'refs.a', type: 'IMAGE', link: toLinkId(60) },
          { name: 'refs.b', type: 'IMAGE', link: null },
          { name: 'alpha', type: 'IMAGE', link: toLinkId(61) },
          { name: 'beta', type: 'IMAGE', link: null }
        ]
      })
      batch.connect({
        id: 62,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 2,
        targetSlot: 3,
        type: 'IMAGE',
        targetInputs: [
          { name: 'refs.a', type: 'IMAGE', link: toLinkId(60) },
          { name: 'refs.b', type: 'IMAGE', link: null },
          { name: 'alpha', type: 'IMAGE', link: toLinkId(61) },
          { name: 'beta', type: 'IMAGE', link: toLinkId(62) }
        ]
      })
    }
  }

  it("drops an explicit-names autogrow group's unpropagated spare and misattributes a later scalar's link onto the wrong name, absent a live node (documented heuristic limitation)", () => {
    const graph = mutations()
    graph.batch(context, explicitNamesGroupScenario())

    // The document hasn't caught up to `refs.b`'s unpropagated growth yet.
    expect(
      graph.batch(
        { ...context, opId: 'reconcile-explicit-names-heuristic' },
        (batch) => {
          batch.reconcileNode({
            ...node(2),
            inputs: [
              { name: 'refs.a', type: 'IMAGE' },
              { name: 'alpha', type: 'IMAGE' },
              { name: 'beta', type: 'IMAGE' }
            ]
          })
        }
      )
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    // `refs.b` doesn't end in a digit, so the heuristic can't tell it's an
    // autogrow member; it's dropped like a legitimately-removed input, and
    // the positional fallback that follows then reads each later document
    // entry against the wrong live slot: `alpha` loses its link (it reads
    // `refs.b`'s null link at that position) and `beta` inherits the link
    // that actually belonged to `alpha`.
    expect(target?.inputs.map(({ name, link }) => [name, link])).toEqual([
      ['refs.a', toLinkId(60)],
      ['alpha', null],
      ['beta', toLinkId(61)]
    ])
  })

  it("keeps an explicit-names autogrow group's unpropagated spare and every scalar's own link when a live node confirms the group's members", () => {
    const graph = mutations({
      autogrowGroupOf: (_scope, _nodeId, name) =>
        name.startsWith('refs.')
          ? { kind: 'member', group: 'refs' }
          : { kind: 'notMember' }
    })
    graph.batch(context, explicitNamesGroupScenario())

    expect(
      graph.batch(
        { ...context, opId: 'reconcile-explicit-names-live' },
        (batch) => {
          batch.reconcileNode({
            ...node(2),
            inputs: [
              { name: 'refs.a', type: 'IMAGE' },
              { name: 'alpha', type: 'IMAGE' },
              { name: 'beta', type: 'IMAGE' }
            ]
          })
        }
      )
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name, link }) => [name, link])).toEqual([
      ['refs.a', toLinkId(60)],
      ['refs.b', null],
      ['alpha', toLinkId(61)],
      ['beta', toLinkId(62)]
    ])
  })

  it("keeps an explicit-names autogrow group's remembered spare and every scalar's own link once the live node answers 'unavailable'", () => {
    // `refs.b` doesn't end in a digit, so `nameShapeAutogrowGroupOf` can't
    // recognize it as autogrow-shaped at all -- exactly the false negative
    // documented on `nameShapeAutogrowGroupOf` and on the "absent a live
    // node" test above. The first reconcile below establishes the live
    // node's real `member` answer and remembers it; the second finds the
    // live node 'unavailable' (e.g. its tab is now in the background) and
    // must keep trusting that memory instead of falling back to the
    // heuristic, which would drop `refs.b` and misattribute `alpha`'s and
    // `beta`'s links just like the heuristic-only test does.
    let liveReachable = true
    const graph = mutations({
      autogrowGroupOf: (_scope, _nodeId, name) => {
        if (!liveReachable) return { kind: 'unavailable' }
        return name.startsWith('refs.')
          ? { kind: 'member', group: 'refs' }
          : { kind: 'notMember' }
      }
    })
    graph.batch(context, explicitNamesGroupScenario())

    graph.batch(
      { ...context, opId: 'reconcile-explicit-names-live' },
      (batch) => {
        batch.reconcileNode({
          ...node(2),
          inputs: [
            { name: 'refs.a', type: 'IMAGE' },
            { name: 'alpha', type: 'IMAGE' },
            { name: 'beta', type: 'IMAGE' }
          ]
        })
      }
    )

    liveReachable = false
    expect(
      graph.batch(
        { ...context, opId: 'reconcile-explicit-names-unavailable' },
        (batch) => {
          batch.reconcileNode({
            ...node(2),
            inputs: [
              { name: 'refs.a', type: 'IMAGE' },
              { name: 'alpha', type: 'IMAGE' },
              { name: 'beta', type: 'IMAGE' }
            ]
          })
        }
      )
    ).toBe(true)

    const rememberedTarget = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(
      rememberedTarget?.inputs.map(({ name, link }) => [name, link])
    ).toEqual([
      ['refs.a', toLinkId(60)],
      ['refs.b', null],
      ['alpha', toLinkId(61)],
      ['beta', toLinkId(62)]
    ])
  })

  it('leaves a remembered autogrow answer untouched when a later mutation in the same batch is rejected', () => {
    let liveReachable = true
    const graph = mutations({
      autogrowGroupOf: (_scope, _nodeId, name) => {
        if (!liveReachable) return { kind: 'unavailable' }
        return name.startsWith('refs.')
          ? { kind: 'member', group: 'refs' }
          : { kind: 'notMember' }
      }
    })
    graph.batch(context, explicitNamesGroupScenario())
    graph.batch({ ...context, opId: 'reconcile-live' }, (batch) => {
      batch.reconcileNode({
        ...node(2),
        inputs: [
          { name: 'refs.a', type: 'IMAGE' },
          { name: 'alpha', type: 'IMAGE' },
          { name: 'beta', type: 'IMAGE' }
        ]
      })
    })

    liveReachable = false
    // A rejected batch must leave no trace in the autogrow memory, or the
    // retry below classifies slots off an answer the store never accepted.
    expect(
      graph.batch({ ...context, opId: 'rejected-batch' }, (batch) => {
        batch.deleteNode(toNodeId(2))
        batch.addNode(node(1))
      })
    ).toBe(false)

    expect(
      graph.batch(
        { ...context, opId: 'reconcile-after-rejected-batch' },
        (batch) => {
          batch.reconcileNode({
            ...node(2),
            inputs: [
              { name: 'refs.a', type: 'IMAGE' },
              { name: 'alpha', type: 'IMAGE' },
              { name: 'beta', type: 'IMAGE' }
            ]
          })
        }
      )
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual([
      'refs.a',
      'refs.b',
      'alpha',
      'beta'
    ])
  })

  it("classifies an explicit-names autogrow spare and a numeric DynamicCombo child correctly on this GraphMutations instance's very first reconcile of each node, with pre-existing store state and the live port answering 'unavailable' from the start", () => {
    // No prior reconcile ever ran on this `graph` before the ones under
    // test, so its autogrow memory starts (and stays) empty for both nodes
    // -- the "activate/resubscribe" case where this follower has nothing to
    // fall back on yet. Absent `nodeDefAutogrowGroupOf`, both nodes below
    // would fall straight to `nameShapeAutogrowGroupOf` and get the WRONG
    // answer for each: the explicit-names spare dropped (the false negative
    // documented on `nameShapeAutogrowGroupOf`) and the DynamicCombo child
    // kept (the false positive documented there) -- exactly the bug this
    // whole fix chain exists to close.
    useNodeDefStore().updateNodeDefs([
      mockNodeDef({
        name: 'AutogrowRefsNode',
        input: {
          required: {
            refs: [
              'COMFY_AUTOGROW_V3',
              { template: { input: {}, names: ['a', 'b'] } }
            ]
          }
        }
      }),
      // Registered with no autogrow group at all, so its own definition
      // affirmatively rules out '0.0.0.0' as a member -- it is not merely
      // "unknown".
      mockNodeDef({ name: 'DynamicComboNode' })
    ])

    const graph = mutations({
      autogrowGroupOf: () => ({ kind: 'unavailable' })
    })

    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        type: 'AutogrowRefsNode',
        inputs: [
          { name: 'refs.a', type: 'IMAGE', link: null },
          // Unpropagated growth: grown live, not yet named by the document.
          { name: 'refs.b', type: 'IMAGE', link: null }
        ]
      })
      batch.addNode({
        ...node(3),
        type: 'DynamicComboNode',
        inputs: [
          { name: 'keep', type: 'IMAGE', link: null },
          // `dynamicWidgets.ts`'s COMFY_DYNAMICCOMBO_V3 dotted shape,
          // coincidentally all-numeric in its final segment.
          { name: '0.0.0.0', type: 'FLOAT', link: null }
        ]
      })
    })

    expect(
      graph.batch({ ...context, opId: 'first-reconcile-refs' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          type: 'AutogrowRefsNode',
          inputs: [{ name: 'refs.a', type: 'IMAGE' }]
        })
      })
    ).toBe(true)
    expect(
      graph.batch({ ...context, opId: 'first-reconcile-combo' }, (batch) => {
        batch.reconcileNode({
          ...node(3),
          type: 'DynamicComboNode',
          inputs: [{ name: 'keep', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    const nodes = useNodeDataStore().getGraphNodesFor('root', 'root')
    const refsTarget = nodes.find(({ id }) => id === toNodeId(2))
    const comboTarget = nodes.find(({ id }) => id === toNodeId(3))
    // The spare is a real autogrow member per `AutogrowRefsNode`'s own
    // definition -- kept even though `refs.b` doesn't end in a digit.
    expect(refsTarget?.inputs.map(({ name }) => name)).toEqual([
      'refs.a',
      'refs.b'
    ])
    // The DynamicCombo child is definitively not an autogrow member per
    // `DynamicComboNode`'s own definition -- dropped even though its
    // trailing segment is all-digits.
    expect(comboTarget?.inputs.map(({ name }) => name)).toEqual(['keep'])
  })

  it('forgets a remembered autogrow answer when it commits a replacement of the node id it was answered for', () => {
    // `RefsNode` is registered exactly once and never re-registered, so its
    // `ComfyNodeDefImpl` identity stays fixed across the whole test: a stale
    // memory entry recorded against it cannot be invalidated by the
    // definition-identity check, only by an actual `memory.forget()`. The
    // live port deliberately answers 'notMember' for 'refs.a' during the
    // prime step below, contradicting `RefsNode`'s own static definition
    // (which lists 'a' as a real member) -- a lie only the test's mock can
    // tell, so that a surviving stale answer is observable as a WRONG
    // classification, not one that coincidentally agrees with the correct,
    // freshly-computed one from `nodeDefAutogrowGroupOf`.
    useNodeDefStore().updateNodeDefs([
      mockNodeDef({
        name: 'RefsNode',
        input: {
          required: {
            refs: [
              'COMFY_AUTOGROW_V3',
              { template: { input: {}, names: ['a', 'b'] } }
            ]
          }
        }
      }),
      mockNodeDef({
        name: 'PlainNode',
        input: { required: { keep: ['IMAGE', {}], 'refs.b': ['IMAGE', {}] } }
      })
    ])

    let liveReachable = true
    let lieAboutRefsA = false
    const graph = mutations({
      autogrowGroupOf: (_scope, _nodeId, name) => {
        if (!liveReachable) return { kind: 'unavailable' }
        if (lieAboutRefsA && name === 'refs.a') return { kind: 'notMember' }
        return name.startsWith('refs.')
          ? { kind: 'member', group: 'refs' }
          : { kind: 'notMember' }
      }
    })
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        type: 'RefsNode',
        inputs: [
          { name: 'refs.b', type: 'IMAGE', link: null },
          { name: 'refs.a', type: 'IMAGE', link: null }
        ]
      })
    })

    // Prime: 'refs.a' is a live-only leftover the document doesn't name, so
    // it is classified (and, per the lie above, remembered as `notMember`).
    lieAboutRefsA = true
    expect(
      graph.batch({ ...context, opId: 'prime' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          type: 'RefsNode',
          inputs: [{ name: 'refs.b', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    // Replace away from `RefsNode` and back to it, re-growing 'refs.a' live
    // each time -- an identity that must be forgotten twice on this node id,
    // once per type change, or the primed lie above outlives both.
    expect(
      graph.batch({ ...context, opId: 'replace-away' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          type: 'PlainNode',
          inputs: [
            { name: 'keep', type: 'IMAGE' },
            { name: 'refs.b', type: 'IMAGE' }
          ]
        })
      })
    ).toBe(true)
    expect(
      graph.batch({ ...context, opId: 'replace-back' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          type: 'RefsNode',
          inputs: [
            { name: 'refs.b', type: 'IMAGE', link: null },
            { name: 'refs.a', type: 'IMAGE', link: null }
          ]
        })
      })
    ).toBe(true)

    // Back on `RefsNode` (the identical, never-re-registered definition),
    // with the live port unavailable and 'refs.a' live-only again: a correct
    // forget falls through to `nodeDefAutogrowGroupOf`, which says 'refs.a'
    // really is a member, so it is kept. A surviving stale `notMember` from
    // the prime step drops it instead.
    liveReachable = false
    expect(
      graph.batch(
        { ...context, opId: 'unavailable-after-round-trip' },
        (batch) => {
          batch.reconcileNode({
            ...node(2),
            type: 'RefsNode',
            inputs: [{ name: 'refs.b', type: 'IMAGE' }]
          })
        }
      )
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual(['refs.b', 'refs.a'])
  })

  it("keeps an earlier mutation's remembered autogrow answer when a later mutation in the same batch throws", () => {
    // `commit()` is not atomic -- it drives independent stores and an
    // injected layout port across every prepared mutation in order. A
    // memory write is committed to the real store right after ITS OWN
    // mutation's graph effects land, not deferred to a single apply-them-all
    // step at the end of the batch, so a later mutation throwing keeps this
    // one's write instead of discarding it along with everything the throw
    // itself prevented. The live port again lies about 'refs.a' (a real
    // member per `RefsNode`'s own definition) so the memory write is
    // observable: if the throw had discarded it, resolution would fall
    // through to the correct, contradicting answer instead.
    useNodeDefStore().updateNodeDefs([
      mockNodeDef({
        name: 'RefsNode',
        input: {
          required: {
            refs: [
              'COMFY_AUTOGROW_V3',
              { template: { input: {}, names: ['a', 'b'] } }
            ]
          }
        }
      })
    ])

    let liveReachable = true
    const graph = mutations({
      autogrowGroupOf: (_scope, _nodeId, name) => {
        if (!liveReachable) return { kind: 'unavailable' }
        if (name === 'refs.a') return { kind: 'notMember' }
        return name.startsWith('refs.')
          ? { kind: 'member', group: 'refs' }
          : { kind: 'notMember' }
      }
    })
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        type: 'RefsNode',
        inputs: [
          { name: 'refs.b', type: 'IMAGE', link: null },
          { name: 'refs.a', type: 'IMAGE', link: null }
        ]
      })
    })

    createLayout.mockImplementationOnce(() => {
      throw new Error('layout port failed')
    })
    expect(() =>
      graph.batch({ ...context, opId: 'throwing-batch' }, (batch) => {
        // First mutation: commits and remembers the lie for 'refs.a'. Its
        // own reconcile also drops 'refs.a' from the live node (consistent
        // with the lie) -- that drop is a real, unconditional graph effect,
        // not what this test is about.
        batch.reconcileNode({
          ...node(2),
          type: 'RefsNode',
          inputs: [{ name: 'refs.b', type: 'IMAGE' }]
        })
        // Second mutation: its own layout call throws, so the batch never
        // finishes and the store never registers node 3.
        batch.addNode(node(3))
      })
    ).toThrow('layout port failed')

    // The throwing mutation must not leave node 3 half-committed: its own
    // graph effect and its (absent) autogrow-memory journal entry share one
    // outcome, so a store write that ran before the throw would be a bug.
    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .find(({ id }) => id === toNodeId(3))
    ).toBeUndefined()

    // Re-introduce 'refs.a' as a live-only leftover directly through the
    // store (bypassing graphMutations' own replace/forget path, which would
    // itself forget the very memory this test is trying to observe), so a
    // later reconcile has the same classification question to answer again
    // -- this time reading memory instead of the live port, which is now
    // unavailable.
    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    assert(target)
    useNodeDataStore().updateNodeSlots(
      scope,
      target.id,
      {
        inputs: [
          ...target.inputs,
          {
            name: 'refs.a',
            type: 'IMAGE',
            link: null,
            boundingRect: [0, 0, 0, 0]
          }
        ],
        outputs: target.outputs
      },
      context
    )

    liveReachable = false
    expect(
      graph.batch({ ...context, opId: 'after-throw' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          type: 'RefsNode',
          inputs: [{ name: 'refs.b', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    // The mutation that committed before the throw kept its remembered lie
    // ('refs.a' is `notMember`), so this later, live-unavailable reconcile
    // trusts it and drops 'refs.a' again instead of falling through to
    // `nodeDefAutogrowGroupOf`'s correct (and here, contradicting) answer.
    const after = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(after?.inputs.map(({ name }) => name)).toEqual(['refs.b'])
  })

  it('keeps the incumbent node fully intact when a type-changing replace throws creating its layout', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode({
        ...node(2),
        title: 'Incumbent',
        properties: { preserved: true },
        widgets_values: { steps: 20 }
      })
    })
    const before = useNodeDataStore().getNode(scope.rootGraphId, toNodeId(2))
    assert(before)
    const snapshot = structuredClone(toRaw(before))
    const inputs = before.inputs
    const outputs = before.outputs
    const layout = createdLayouts.get('2')

    createLayout.mockImplementationOnce(() => {
      throw new Error('layout port failed')
    })
    expect(() =>
      graph.batch({ ...context, opId: 'type-change-throws' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          type: 'Type2Changed',
          widgets_values: { steps: 99 }
        })
      })
    ).toThrow('layout port failed')

    const incumbent = useNodeDataStore().getNode(scope.rootGraphId, toNodeId(2))
    assert(incumbent)
    expect(incumbent).toBe(before)
    expect(incumbent).toEqual(snapshot)
    expect(incumbent.inputs).toBe(inputs)
    expect(incumbent.outputs).toBe(outputs)
    expect(createdLayouts.get('2')).toBe(layout)
    expect(widgetTuples(2).map(([name, , , value]) => [name, value])).toEqual([
      ['steps', 20]
    ])
  })

  it("lets a mutation see an earlier mutation's still-pending autogrow answer from the same batch", () => {
    let refsBCalls = 0
    const graph = mutations({
      autogrowGroupOf: (_scope, _nodeId, name) => {
        if (name !== 'refs.b') return { kind: 'notMember' }
        refsBCalls++
        return refsBCalls === 1
          ? { kind: 'member', group: 'refs' }
          : { kind: 'unavailable' }
      }
    })

    graph.batch(context, (batch) => {
      batch.addNode({
        ...node(2),
        inputs: [
          { name: 'refs.a', type: 'IMAGE', link: null },
          { name: 'refs.b', type: 'IMAGE', link: null }
        ]
      })
    })

    expect(
      graph.batch(
        { ...context, opId: 'sequential-prepare-visibility' },
        (batch) => {
          batch.reconcileNode({
            ...node(2),
            inputs: [{ name: 'refs.a', type: 'IMAGE' }]
          })
          batch.reconcileNode({
            ...node(2),
            inputs: [{ name: 'refs.a', type: 'IMAGE' }]
          })
        }
      )
    ).toBe(true)

    const after = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(after?.inputs.map(({ name }) => name)).toEqual(['refs.a', 'refs.b'])
  })

  it("journals a connect mutation's commit-time autogrow answer under its own index, not the batch's last-prepared one", () => {
    let refsBCalls = 0
    const graph = mutations({
      autogrowGroupOf: (_scope, _nodeId, name) => {
        if (name !== 'refs.b') return { kind: 'notMember' }
        refsBCalls++
        if (refsBCalls === 1) return { kind: 'unavailable' }
        if (refsBCalls === 2) return { kind: 'member', group: 'refs' }
        return { kind: 'unavailable' }
      }
    })

    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [
          { name: 'refs.a', type: 'IMAGE', link: null },
          { name: 'refs.b', type: 'IMAGE', link: null }
        ]
      })
    })

    createLayout.mockImplementationOnce(() => {
      throw new Error('layout port failed')
    })
    expect(() =>
      graph.batch({ ...context, opId: 'connect-then-throw' }, (batch) => {
        batch.connect({
          id: 90,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 0,
          type: 'IMAGE',
          targetInputs: [{ name: 'refs.a', type: 'IMAGE', link: toLinkId(90) }]
        })
        batch.addNode(node(3))
      })
    ).toThrow('layout port failed')

    expect(
      graph.batch({ ...context, opId: 'reconcile-after-throw' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          inputs: [{ name: 'refs.a', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    const reconciled = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(reconciled?.inputs.map(({ name }) => name)).toEqual([
      'refs.a',
      'refs.b'
    ])
  })

  it("does not publish a connect mutation's staged autogrow answer when its own replaceLink fails to land", () => {
    let live: 'member' | 'unavailable' = 'member'
    const graph = mutations({
      autogrowGroupOf: (_scope, _nodeId, name) => {
        if (name !== 'refs.b') return { kind: 'notMember' }
        return live === 'member'
          ? { kind: 'member', group: 'refs' }
          : { kind: 'unavailable' }
      }
    })

    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [
          { name: 'refs.a', type: 'IMAGE', link: null },
          { name: 'refs.b', type: 'IMAGE', link: null }
        ]
      })
    })

    const replaceLinkSpy = vi
      .spyOn(useLinkStore(), 'replaceLink')
      .mockReturnValueOnce(undefined)
    expect(
      graph.batch(
        { ...context, opId: 'connect-replaceLink-fails' },
        (batch) => {
          batch.connect({
            id: 91,
            originNodeId: 1,
            originSlot: 0,
            targetNodeId: 2,
            targetSlot: 0,
            type: 'IMAGE',
            targetInputs: [
              { name: 'refs.a', type: 'IMAGE', link: toLinkId(91) }
            ]
          })
        }
      )
    ).toBe(true)
    replaceLinkSpy.mockRestore()

    const afterFailedConnect = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(
      afterFailedConnect?.inputs.map(({ name, link }) => [name, link])
    ).toEqual([
      ['refs.a', null],
      ['refs.b', null]
    ])

    live = 'unavailable'
    expect(
      graph.batch({ ...context, opId: 'reconcile-after-failure' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          inputs: [{ name: 'refs.a', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    const reconciled = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(reconciled?.inputs.map(({ name }) => name)).toEqual(['refs.a'])
  })

  it('keeps an incumbent same-id link when its replacement fails', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode(node(2))
      batch.connect({
        id: 91,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 2,
        targetSlot: 0,
        type: 'IMAGE'
      })
    })
    const before = useLinkStore().getTopology(scope.rootGraphId, toLinkId(91))
    assert(before)

    const replaceLinkSpy = vi
      .spyOn(useLinkStore(), 'replaceLink')
      .mockReturnValueOnce(undefined)
    graph.connect(
      {
        id: 91,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 2,
        targetSlot: 0,
        type: 'IMAGE'
      },
      { ...context, opId: 'same-id-replacement-fails' }
    )
    replaceLinkSpy.mockRestore()

    expect(useLinkStore().getTopology(scope.rootGraphId, toLinkId(91))).toEqual(
      before
    )
  })

  it('does not let a failed connect influence a later reconcile prepared in the same batch', () => {
    let refsBCalls = 0
    const graph = mutations({
      autogrowGroupOf: (_scope, _nodeId, name) => {
        if (name !== 'refs.b') return { kind: 'notMember' }
        refsBCalls++
        return refsBCalls === 1
          ? { kind: 'member', group: 'refs' }
          : { kind: 'unavailable' }
      }
    })

    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [
          { name: 'refs.a', type: 'IMAGE', link: null },
          { name: 'refs.b', type: 'IMAGE', link: null }
        ]
      })
    })

    const replaceLinkSpy = vi
      .spyOn(useLinkStore(), 'replaceLink')
      .mockReturnValueOnce(undefined)
    expect(
      graph.batch(
        { ...context, opId: 'same-batch-reconcile-leak' },
        (batch) => {
          batch.connect({
            id: 91,
            originNodeId: 1,
            originSlot: 0,
            targetNodeId: 2,
            targetSlot: 0,
            type: 'IMAGE',
            targetInputs: [
              { name: 'refs.a', type: 'IMAGE', link: toLinkId(91) }
            ]
          })
          batch.reconcileNode({
            ...node(2),
            inputs: [{ name: 'refs.a', type: 'IMAGE' }]
          })
        }
      )
    ).toBe(true)
    replaceLinkSpy.mockRestore()

    const reconciled = useNodeDataStore().getNode(
      scope.rootGraphId,
      toNodeId(2)
    )
    expect(reconciled?.inputs.map(({ name }) => name)).toEqual(['refs.a'])
  })

  it("does not leak a failed connect's staged autogrow answer to a later connect in the same batch", () => {
    let refsBCalls = 0
    const graph = mutations({
      autogrowGroupOf: (_scope, _nodeId, name) => {
        if (name !== 'refs.b') return { kind: 'notMember' }
        refsBCalls++
        if (refsBCalls === 1) return { kind: 'notMember' }
        if (refsBCalls === 2) return { kind: 'member', group: 'refs' }
        return { kind: 'unavailable' }
      }
    })

    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [
          { name: 'refs.a', type: 'IMAGE', link: null },
          { name: 'refs.b', type: 'IMAGE', link: null }
        ]
      })
    })

    const replaceLinkSpy = vi
      .spyOn(useLinkStore(), 'replaceLink')
      .mockReturnValueOnce(undefined)
    expect(
      graph.batch({ ...context, opId: 'same-batch-shadow-leak' }, (batch) => {
        batch.connect({
          id: 91,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 0,
          type: 'IMAGE',
          targetInputs: [{ name: 'refs.a', type: 'IMAGE', link: toLinkId(91) }]
        })
        batch.connect({
          id: 92,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 0,
          type: 'IMAGE',
          targetInputs: [{ name: 'refs.a', type: 'IMAGE', link: toLinkId(92) }]
        })
      })
    ).toBe(true)
    replaceLinkSpy.mockRestore()

    const after = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(after?.inputs.map(({ name }) => name)).toEqual(['refs.a'])
  })

  it("does not let one graph scope read another scope's remembered autogrow answer on the same GraphMutations instance", () => {
    // Production retains one `GraphMutations` per cloud workflow while
    // resolving the current local workflow's scope on every batch, so the
    // same node id, type and input name recurs across unrelated roots.
    let currentScope: GraphScope = scope
    let liveReachable = true
    const graph = createGraphMutations({
      getScope: () => currentScope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts },
      placement,
      liveWidgets: { setValue: setLiveWidgetValue },
      liveNodes: {
        autogrowGroupOf: (_scope, _nodeId, name) => {
          if (!liveReachable) return { kind: 'unavailable' }
          return name.startsWith('refs.')
            ? { kind: 'member', group: 'refs' }
            : { kind: 'notMember' }
        }
      }
    })

    graph.batch(context, explicitNamesGroupScenario())
    graph.batch({ ...context, opId: 'prime-first-root' }, (batch) => {
      batch.reconcileNode({
        ...node(2),
        inputs: [
          { name: 'refs.a', type: 'IMAGE' },
          { name: 'alpha', type: 'IMAGE' },
          { name: 'beta', type: 'IMAGE' }
        ]
      })
    })

    currentScope = otherScope
    graph.batch(
      { ...context, opId: 'seed-second-root' },
      explicitNamesGroupScenario()
    )

    liveReachable = false
    expect(
      graph.batch({ ...context, opId: 'reconcile-second-root' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          inputs: [
            { name: 'refs.a', type: 'IMAGE' },
            { name: 'alpha', type: 'IMAGE' },
            { name: 'beta', type: 'IMAGE' }
          ]
        })
      })
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('other-root', 'other-root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual([
      'refs.a',
      'alpha',
      'beta'
    ])
  })

  it('does not leak the live answer a rejected batch resolved while preparing', () => {
    let liveAnswer: 'member' | 'notMember' = 'member'
    let liveReachable = true
    const graph = mutations({
      autogrowGroupOf: (_scope, _nodeId, name) => {
        if (!liveReachable) return { kind: 'unavailable' }
        if (!name.startsWith('refs.')) return { kind: 'notMember' }
        return liveAnswer === 'member'
          ? { kind: 'member', group: 'refs' }
          : { kind: 'notMember' }
      }
    })
    graph.batch(context, explicitNamesGroupScenario())
    graph.batch({ ...context, opId: 'prime-member' }, (batch) => {
      batch.reconcileNode({
        ...node(2),
        inputs: [
          { name: 'refs.a', type: 'IMAGE' },
          { name: 'alpha', type: 'IMAGE' },
          { name: 'beta', type: 'IMAGE' }
        ]
      })
    })

    // The reconcile resolves (and would record) `notMember` while
    // preparing; the duplicate add behind it rejects the whole batch.
    liveAnswer = 'notMember'
    expect(
      graph.batch({ ...context, opId: 'rejected-notmember' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          inputs: [
            { name: 'refs.a', type: 'IMAGE' },
            { name: 'alpha', type: 'IMAGE' },
            { name: 'beta', type: 'IMAGE' }
          ]
        })
        batch.addNode(node(1))
      })
    ).toBe(false)

    liveReachable = false
    expect(
      graph.batch({ ...context, opId: 'retry-unavailable' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          inputs: [
            { name: 'refs.a', type: 'IMAGE' },
            { name: 'alpha', type: 'IMAGE' },
            { name: 'beta', type: 'IMAGE' }
          ]
        })
      })
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual([
      'refs.a',
      'refs.b',
      'alpha',
      'beta'
    ])
  })

  it('prefers a re-registered node definition over an autogrow answer remembered under the definition it replaced', () => {
    useNodeDefStore().updateNodeDefs([
      mockNodeDef({
        name: 'RefsNode',
        input: {
          required: {
            refs: [
              'COMFY_AUTOGROW_V3',
              { template: { input: {}, names: ['a', 'b'] } }
            ]
          }
        }
      })
    ])

    let liveReachable = true
    const graph = mutations({
      autogrowGroupOf: (_scope, _nodeId, name) => {
        if (!liveReachable) return { kind: 'unavailable' }
        return name.startsWith('refs.')
          ? { kind: 'member', group: 'refs' }
          : { kind: 'notMember' }
      }
    })
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        type: 'RefsNode',
        inputs: [
          { name: 'keep', type: 'IMAGE', link: null },
          { name: 'refs.b', type: 'IMAGE', link: null }
        ]
      })
    })
    expect(
      graph.batch({ ...context, opId: 'prime-member' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          type: 'RefsNode',
          inputs: [{ name: 'keep', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    // Hot reload: the same type name, a new schema object, no autogrow
    // group. The remembered answer describes a definition that no longer
    // exists, so the current one has to win.
    useNodeDefStore().updateNodeDefs([
      mockNodeDef({
        name: 'RefsNode',
        input: { required: { keep: ['IMAGE', {}] } }
      })
    ])

    liveReachable = false
    expect(
      graph.batch({ ...context, opId: 'after-reregistration' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          type: 'RefsNode',
          inputs: [{ name: 'keep', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual(['keep'])
  })

  it('does not apply a remembered autogrow answer to a node id another writer has since given a different type', () => {
    // No node definitions are registered for either type here, so the
    // remembered entry's node type is the only thing separating the two
    // incarnations. The replacement is committed by a second follower, so
    // this instance never sees it and never forgets on its own.
    let liveReachable = true
    const graph = mutations({
      autogrowGroupOf: (_scope, _nodeId, name) => {
        if (!liveReachable) return { kind: 'unavailable' }
        return name.startsWith('refs.')
          ? { kind: 'member', group: 'refs' }
          : { kind: 'notMember' }
      }
    })
    const otherFollower = mutations()

    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        type: 'RefsNode',
        inputs: [
          { name: 'keep', type: 'IMAGE', link: null },
          { name: 'refs.b', type: 'IMAGE', link: null }
        ]
      })
    })
    expect(
      graph.batch({ ...context, opId: 'prime-member' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          type: 'RefsNode',
          inputs: [{ name: 'keep', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    expect(
      otherFollower.batch(
        { ...context, opId: 'replace-elsewhere' },
        (batch) => {
          batch.reconcileNode({
            ...node(2),
            type: 'PlainNode',
            inputs: [
              { name: 'keep', type: 'IMAGE', link: null },
              { name: 'refs.b', type: 'IMAGE', link: null }
            ]
          })
        }
      )
    ).toBe(true)

    liveReachable = false
    expect(
      graph.batch({ ...context, opId: 'reconcile-after-replace' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          type: 'PlainNode',
          inputs: [{ name: 'keep', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ name }) => name)).toEqual(['keep'])
  })

  it("resolves duplicate-named live occurrences by position when the document's own link is omitted", () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode({
        ...node(2),
        inputs: [{ name: 'dup', type: 'IMAGE', link: null }]
      })
      batch.connect({
        id: 83,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 2,
        targetSlot: 1,
        type: 'IMAGE',
        targetInputs: [
          { name: 'dup', type: 'IMAGE', link: null },
          { name: 'dup', type: 'IMAGE', link: toLinkId(83) }
        ]
      })
    })

    // Neither document entry names a link: both fall back to the live
    // occurrence at their own position, not both to the first.
    expect(
      graph.batch({ ...context, opId: 'resync-dup' }, (batch) => {
        batch.reconcileNode({
          ...node(2),
          inputs: [
            { name: 'dup', type: 'IMAGE' },
            { name: 'dup', type: 'IMAGE' }
          ]
        })
      })
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ link }) => link)).toEqual([null, toLinkId(83)])
  })

  it('does not restore a removed link from an omitted reconciled slot field', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode(node(2))
      batch.connect({
        id: 5,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 2,
        targetSlot: 0,
        type: 'IMAGE',
        originOutputs: [{ name: 'out', type: 'IMAGE', links: [toLinkId(5)] }],
        targetInputs: [{ name: 'in', type: 'IMAGE', link: toLinkId(5) }]
      })
    })

    expect(
      graph.batch({ ...context, opId: 'reconcile' }, (batch) => {
        batch.removeMissing([toNodeId(1), toNodeId(2)], [])
        batch.reconcileNode({
          ...node(2),
          inputs: [{ name: 'in', type: 'IMAGE' }]
        })
      })
    ).toBe(true)

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs[0].link).toBeNull()
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(5))
    ).toBeUndefined()
  })

  it('resolves omitted input links against the existing node on reconcile and to null on add', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode({
        ...node(1),
        inputs: [{ name: 'in', type: 'IMAGE' }]
      })
      batch.addNode(node(2))
      batch.connect({
        id: 5,
        originNodeId: 2,
        originSlot: 0,
        targetNodeId: 1,
        targetSlot: 0,
        type: 'IMAGE',
        targetInputs: [{ name: 'in', type: 'IMAGE', link: toLinkId(5) }]
      })
    })
    const find = (id: number) =>
      useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .find((state) => state.id === toNodeId(id))
    expect(find(2)?.inputs[0].link).toBeNull()
    expect(find(1)?.inputs[0].link).toBe(toLinkId(5))

    expect(
      graph.batch({ ...context, opId: 'op-2' }, (batch) => {
        batch.reconcileNode({
          ...node(1),
          title: 'Reconciled',
          inputs: [
            { name: 'in', type: 'IMAGE' },
            { name: 'added', type: 'IMAGE' }
          ]
        })
      })
    ).toBe(true)

    expect(find(1)?.title).toBe('Reconciled')
    expect(find(1)?.inputs.map(({ link }) => link)).toEqual([toLinkId(5), null])
  })

  it('preserves live slots through remote connect, reconnect, and removal', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.id = toNodeId(1)
    source.addOutput('out', 'IMAGE', { label: 'Current output' })
    graph.add(source)
    const target = new LGraphNode('Target')
    target.id = toNodeId(2)
    target.addInput('in', 'IMAGE', { label: 'Current input' })
    graph.add(target)
    const output = source.outputs[0]
    const input = target.inputs[0]
    const remote = createGraphMutations({
      getScope: () => graphScopeOf(graph),
      layout: { createNode: createLayout, deleteNodes: deleteLayouts },
      placement: inertPlacementPort
    })
    const link = {
      id: 9,
      originNodeId: 1,
      originSlot: 0,
      targetNodeId: 2,
      targetSlot: 0,
      type: 'IMAGE',
      originOutputs: [{ name: 'out', type: 'IMAGE', links: [9] }],
      targetInputs: [{ name: 'in', type: 'IMAGE', link: 9 }]
    }
    const store = useNodeDataStore()

    for (let attempt = 0; attempt < 2; attempt++) {
      expect(remote.connect(link, context)).toBe(true)
      expect(store.getNode(graph.id, source.id)?.outputs).toBe(source.outputs)
      expect(store.getNode(graph.id, target.id)?.inputs).toBe(target.inputs)
      expect(source.outputs[0]).toBe(output)
      expect(target.inputs[0]).toBe(input)
      expect(output.label).toBe('Current output')
      expect(input.label).toBe('Current input')
      expect(source.isOutputConnected(0)).toBe(true)
      expect(target.isInputConnected(0)).toBe(true)
    }

    expect(remote.batch(context, (batch) => batch.removeLinks([9]))).toBe(true)
    expect(source.outputs[0]).toBe(output)
    expect(target.inputs[0]).toBe(input)
    expect(source.isOutputConnected(0)).toBe(false)
    expect(target.isInputConnected(0)).toBe(false)
  })

  it('preserves grown live inputs when reconciliation precedes a named connect', () => {
    const graph = mutations()
    graph.addNode(node(1), context)
    graph.addNode(
      {
        ...node(2),
        inputs: [
          { name: 'images.image_1', type: 'IMAGE', link: null },
          { name: 'images.image_0', type: 'IMAGE', link: null },
          { name: 'width', type: 'INT', link: null },
          { name: 'height', type: 'INT', link: null }
        ]
      },
      context
    )
    const target = useNodeDataStore().getNode('root', toNodeId(2))!
    const liveInputs = target.inputs

    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNode({
          ...node(2),
          inputs: [
            { name: 'images.image_0', type: 'IMAGE', link: 9 },
            { name: 'width', type: 'INT', link: null },
            { name: 'height', type: 'INT', link: null }
          ]
        })
        // Document slot 0 is `images.image_0`; growth put it at live index 1, so a
        // correct resolution retargets by name rather than trusting the index.
        batch.connect({
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 0,
          type: 'IMAGE',
          targetInputs: [
            { name: 'images.image_0', type: 'IMAGE', link: 9 },
            { name: 'width', type: 'INT', link: null },
            { name: 'height', type: 'INT', link: null }
          ]
        })
      })
    ).toBe(true)
    expect(target.inputs).toBe(liveInputs)
    expect(target.inputs.map(({ name }) => name)).toEqual([
      'images.image_1',
      'images.image_0',
      'width',
      'height'
    ])
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))?.targetSlot
    ).toBe(1)
  })

  it('rejects a missing document target without changing endpoint slots', () => {
    const graph = mutations()
    graph.addNode(node(1), context)
    graph.addNode(node(2), context)
    const source = useNodeDataStore().getNode('root', toNodeId(1))!
    const target = useNodeDataStore().getNode('root', toNodeId(2))!
    const sourceOutputs = source.outputs.map(({ links }) => [...(links ?? [])])
    const targetInputs = target.inputs.map(({ link }) => link)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(
      graph.batch(context, (batch) => {
        batch.connect({
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 2,
          type: 'IMAGE',
          targetInputs: [{ name: 'in', type: 'IMAGE', link: null }]
        })
      })
    ).toBe(false)
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    ).toBeUndefined()
    expect(source.outputs.map(({ links }) => [...(links ?? [])])).toEqual(
      sourceOutputs
    )
    expect(target.inputs.map(({ link }) => link)).toEqual(targetInputs)
    error.mockRestore()
  })

  it('rejects a document target removed by slot validation without mutating the graph', () => {
    const graph = mutations()
    graph.addNode(node(1), context)
    graph.addNode(node(2), context)
    const target = useNodeDataStore().getNode('root', toNodeId(2))!
    const input = target.inputs[0]
    const targetInputs = [{ name: 'invalid', type: 'IMAGE', link: null }]
    Reflect.set(targetInputs[0], 'type', null)

    expect(
      graph.connect(
        {
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 0,
          type: 'IMAGE',
          targetInputs
        },
        context
      )
    ).toBe(false)
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    ).toBeUndefined()
    expect(target.inputs).toEqual([input])
    expect(target.inputs[0]).toBe(input)
  })

  it('does not mutate endpoint metadata when a later batch mutation fails', () => {
    const graph = mutations()
    graph.addNode(node(1), context)
    graph.addNode(node(2), context)
    const source = useNodeDataStore().getNode('root', toNodeId(1))!
    const target = useNodeDataStore().getNode('root', toNodeId(2))!
    Object.assign(source.outputs[0], { label: 'live output', links: null })
    Object.assign(target.inputs[0], { label: 'live input', link: null })
    const sourceOutput = { ...source.outputs[0] }
    const targetInput = { ...target.inputs[0] }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(
      graph.batch(context, (batch) => {
        batch.connect({
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 0,
          type: 'IMAGE',
          originOutputs: [{ name: 'out', type: 'IMAGE', links: [toLinkId(9)] }],
          targetInputs: [{ name: 'in', type: 'IMAGE', link: toLinkId(9) }]
        })
        batch.setWidget(toNodeId(99), 'missing', 1)
      })
    ).toBe(false)
    expect(source.outputs[0]).toEqual(sourceOutput)
    expect(target.inputs[0]).toEqual(targetInput)
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    ).toBeUndefined()
    error.mockRestore()
  })

  it.for([null, 7])(
    'rejects malformed live input %p during connect preparation',
    (malformed) => {
      const graph = mutations()
      graph.addNode(node(1), context)
      graph.addNode(node(2), context)
      const target = useNodeDataStore().getNode('root', toNodeId(2))!
      Reflect.set(target, 'inputs', [malformed])
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(
        graph.connect(
          {
            id: 9,
            originNodeId: 1,
            originSlot: 0,
            targetNodeId: 2,
            targetSlot: 0,
            type: 'IMAGE',
            targetInputs: [{ name: 'in', type: 'IMAGE', link: 9 }]
          },
          context
        )
      ).toBe(false)
      expect(
        useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
      ).toBeUndefined()
      error.mockRestore()
    }
  )

  it('updates serialized slots whose optional link mirrors were absent', () => {
    const graph = mutations()
    expect(
      graph.batch(context, (batch) => {
        batch.addNode({
          ...node(1),
          outputs: [{ name: 'out', type: 'IMAGE' }]
        })
        batch.addNode({
          ...node(2),
          inputs: [{ name: 'in', type: 'IMAGE' }]
        })
        batch.connect({
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 0,
          type: 'IMAGE',
          originOutputs: [{ name: 'out', type: 'IMAGE', links: [9] }],
          targetInputs: [{ name: 'in', type: 'IMAGE', link: 9 }]
        })
      })
    ).toBe(true)

    const store = useNodeDataStore()
    expect(store.getNode('root', toNodeId(1))?.outputs[0].links).toEqual([9])
    expect(store.getNode('root', toNodeId(2))?.inputs[0].link).toBe(9)
    expect(graph.batch(context, (batch) => batch.removeLinks([9]))).toBe(true)
    expect(store.getNode('root', toNodeId(1))?.outputs[0].links).toEqual([])
    expect(store.getNode('root', toNodeId(2))?.inputs[0].link).toBeNull()
  })

  it('re-adds a normalized node id as a fresh widget incarnation', () => {
    const graph = mutations()
    graph.addNode(node(1, { seed: 1, stale: 'old' }), context)

    expect(
      graph.batch({ ...context, opId: 'op-2' }, (batch) => {
        batch.deleteNode(toNodeId('1'))
        batch.addNode(node(1, { seed: 2 }))
      })
    ).toBe(true)

    const widgets = useWidgetValueStore()
    expect(
      widgets.getWidget(widgetId('root', toNodeId(1), 'seed'))?.value
    ).toBe(2)
    expect(
      widgets.getWidget(widgetId('root', toNodeId(1), 'stale'))
    ).toBeUndefined()
    expect(deleteLayouts).toHaveBeenCalledWith(
      scope,
      [toNodeId(1)],
      expect.objectContaining({ opId: 'op-2' })
    )
  })

  it('clears every semantic owner and batches derived layout cleanup', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1, { seed: 1 }))
      batch.addNode(node(2, { seed: 2 }))
      batch.connect({
        id: 9,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 2,
        targetSlot: 0,
        type: 'IMAGE'
      })
    })
    deleteLayouts.mockClear()

    expect(graph.clearSemanticGraph({ ...context, opId: 'op-clear' })).toBe(
      true
    )

    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
    expect([...useLinkStore().graphTopologies(scope)]).toEqual([])
    expect(useWidgetValueStore().getNodeWidgets('root', toNodeId(1))).toEqual(
      []
    )
    expect(deleteLayouts).toHaveBeenCalledOnce()
    expect(deleteLayouts).toHaveBeenCalledWith(
      scope,
      [toNodeId(1), toNodeId(2)],
      expect.objectContaining({ opId: 'op-clear' })
    )
  })

  it('carries remote provenance through the observable store calls', () => {
    const nodeContexts: unknown[] = []
    const widgetContexts: unknown[] = []
    useNodeDataStore().$onAction(({ name, args }) => {
      if (name === 'registerNode') nodeContexts.push(args[2])
    })
    useWidgetValueStore().$onAction(({ name, args }) => {
      if (name === 'registerWidget') widgetContexts.push(args[3])
    })

    mutations().addNode(node(1, { seed: 1 }), context)

    expect(nodeContexts).toEqual([context])
    expect(widgetContexts).toEqual([context])
  })

  function graphWithStoreOnlyNode() {
    const graph = new LGraph()
    createGraphMutations({
      getScope: () => graphScopeOf(graph),
      layout: { createNode: createLayout, deleteNodes: deleteLayouts },
      placement
    }).addNode(
      {
        id: 1,
        type: 'dummy',
        pos: [0, 0],
        size: [100, 80],
        inputs: [],
        outputs: []
      },
      context
    )
    return graph
  }

  it('registers a doc node under a live graph scope without an LGraphNode', () => {
    const graph = graphWithStoreOnlyNode()

    expect(
      useNodeDataStore().getGraphNodesFor(graph.rootGraph.id, graph.id)
    ).toHaveLength(1)
    expect(graph.nodes).toHaveLength(0)
  })

  it.fails('keeps a store-only node in LGraph.serialize() without reporting a mismatch', () => {
    const graph = graphWithStoreOnlyNode()

    expect(graph.serialize().nodes).toHaveLength(1)
    expect(mockReportError).not.toHaveBeenCalled()
  })
})
