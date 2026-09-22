import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import {
  graphScopeOf,
  toOwningGraphId,
  toRootGraphId
} from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import type { WidgetStateInit } from '@/types/widgetState'

import type { SemanticPlacementPort } from './graphMutations'
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
    createdLayouts.clear()
    createLayout.mockReset()
    createLayout.mockImplementation((_scope, nodeId, layout) => {
      createdLayouts.set(String(nodeId), layout)
    })
    deleteLayouts.mockReset()
    setLiveWidgetValue.mockReset()
    mockReportError.mockReset()
    LiteGraph.registerNodeType('ContractSampler', ContractSampler)
  })

  function mutations() {
    return createGraphMutations({
      getScope: () => scope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts },
      placement,
      liveWidgets: { setValue: setLiveWidgetValue }
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
    const distanceFromExistingNode = Math.hypot(
      layout.position.x - 0,
      layout.position.y - 0
    )
    expect(distanceFromExistingNode).toBeLessThan(2000)
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
    const presentation = useLinkPresentationStore()
    presentation.patch(scope, toLinkId(9), { hidden: true, label: 'Replaced' })
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
    expect(presentation.getPresentation(scope, toLinkId(9))).toBeUndefined()
    expect(presentation.getPresentation(scope, toLinkId(10))).toBeUndefined()
  })

  it('preserves presentation when a remote batch reconnects the same link id', () => {
    const graph = mutations()
    const link = {
      id: 9,
      originNodeId: 1,
      originSlot: 0,
      targetNodeId: 2,
      targetSlot: 0,
      type: 'IMAGE'
    }
    expect(
      graph.batch(context, (batch) => {
        batch.addNode(node(1))
        batch.addNode(node(2))
        batch.connect(link)
      })
    ).toBe(true)
    const presentation = useLinkPresentationStore()
    presentation.patch(scope, toLinkId(9), { hidden: true, label: 'Retained' })

    expect(graph.batch(context, (batch) => batch.connect(link))).toBe(true)

    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    ).toMatchObject({
      originNodeId: '1',
      targetNodeId: '2'
    })
    expect(presentation.getPresentation(scope, toLinkId(9))).toEqual({
      hidden: true,
      label: 'Retained'
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

  // Unit-level regression guard for the color/label preservation fix above (this file had no
  // unit coverage of it before this commit, only the Playwright spec added
  // alongside it): a reconcile must not wholesale-replace a live node's
  // presentation-only `color` or an autogrow input's client-computed
  // `localized_name` when the CRDT payload omits them, since the document
  // never carries either field.
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
    expect(deleteLayouts).toHaveBeenCalledOnce()
    expect(createLayout).toHaveBeenCalledOnce()
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
          { name: 'image_1', type: 'IMAGE', link: null },
          { name: 'image_0', type: 'IMAGE', link: null },
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
            { name: 'image_0', type: 'IMAGE', link: 9 },
            { name: 'width', type: 'INT', link: null },
            { name: 'height', type: 'INT', link: null }
          ]
        })
        // Document slot 0 is `image_0`; growth put it at live index 1, so a
        // correct resolution retargets by name rather than trusting the index.
        batch.connect({
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 0,
          type: 'IMAGE',
          targetInputs: [
            { name: 'image_0', type: 'IMAGE', link: 9 },
            { name: 'width', type: 'INT', link: null },
            { name: 'height', type: 'INT', link: null }
          ]
        })
      })
    ).toBe(true)
    expect(target.inputs).toBe(liveInputs)
    expect(target.inputs.map(({ name }) => name)).toEqual([
      'image_1',
      'image_0',
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

  it('drops link presentation when a remote batch removes the link', () => {
    const graph = mutations()
    graph.batch(context, (batch) => {
      batch.addNode(node(1))
      batch.addNode(node(2))
      batch.connect({
        id: 9,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 2,
        targetSlot: 0,
        type: 'IMAGE'
      })
    })
    const presentation = useLinkPresentationStore()
    presentation.patch(scope, toLinkId(9), { hidden: true, label: 'Hidden' })

    expect(
      graph.batch(context, (batch) => {
        batch.removeLinks([9])
      })
    ).toBe(true)

    expect(presentation.getPresentation(scope, toLinkId(9))).toBeUndefined()
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
    useLinkPresentationStore().patch(scope, toLinkId(9), { hidden: true })
    deleteLayouts.mockClear()

    expect(graph.clearSemanticGraph({ ...context, opId: 'op-clear' })).toBe(
      true
    )

    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
    expect([...useLinkStore().graphTopologies(scope)]).toEqual([])
    expect(
      useLinkPresentationStore().getPresentation(scope, toLinkId(9))
    ).toBeUndefined()
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
      if (name === 'registerWidget') widgetContexts.push(args[4])
    })

    mutations().addNode(node(1, { seed: 1 }), context)

    expect(nodeContexts).toEqual([context])
    expect(widgetContexts).toEqual([context])
  })

  it('notifies once after a valid batch commits', () => {
    const onCommitted = vi.fn()
    const tracked = createGraphMutations({
      getScope: () => scope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts },
      placement,
      onCommitted
    })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(tracked.addNode(node(1), context)).toBe(true)
    expect(onCommitted).toHaveBeenCalledOnce()

    expect(
      tracked.batch(context, (batch) => {
        batch.addNode(node(2))
        batch.connect({
          id: 2,
          originNodeId: 2,
          originSlot: 0,
          targetNodeId: 99,
          targetSlot: 0,
          type: 'IMAGE'
        })
      })
    ).toBe(false)
    expect(onCommitted).toHaveBeenCalledOnce()
    error.mockRestore()
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
