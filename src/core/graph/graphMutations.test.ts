import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import { createGraphMutations } from './graphMutations'

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

describe('graphMutations', () => {
  const createLayout = vi.fn()
  const deleteLayouts = vi.fn()

  beforeEach(() => {
    createLayout.mockReset()
    deleteLayouts.mockReset()
  })

  function mutations() {
    return createGraphMutations({
      getScope: () => scope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts }
    })
  }

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

  it('rejects a sibling-owned node collision before committing earlier writes', () => {
    const siblingScope = {
      rootGraphId: scope.rootGraphId,
      owningGraphId: toOwningGraphId('sibling')
    }
    const sibling = createGraphMutations({
      getScope: () => siblingScope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts }
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
      layout: { createNode: createLayout, deleteNodes: deleteLayouts }
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
        ?.value
    ).toBe(42)
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), 'stale'))
    ).toBeUndefined()
    expect(deleteLayouts).not.toHaveBeenCalled()
    expect(createLayout).not.toHaveBeenCalled()
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

  it('rejects reconcileNodeFields for a missing node or an incomplete payload', () => {
    const graph = mutations()
    graph.addNode(node(1, { seed: 1 }), context)

    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNodeFields({ ...node(3), title: 'Ghost' })
      })
    ).toBe(false)
    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNodeFields({ ...node(1), type: '' })
      })
    ).toBe(false)
    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNodeFields({ ...node(1), title: 'Live' })
        batch.reconcileNodeFields({ ...node(3), title: 'Ghost' })
      })
    ).toBe(false)

    const [untouched] = useNodeDataStore().getGraphNodesFor('root', 'root')
    expect(untouched.title).toBe('Node 1')
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
    expect(
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

    const target = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(target?.inputs.map(({ link }) => link)).toEqual([
      toLinkId(5),
      toLinkId(9)
    ])
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
})
