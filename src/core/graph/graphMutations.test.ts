import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentGeneratedNodesStore } from '@/stores/agentGeneratedNodesStore'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'
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

  it('records agent-authored nodes so the minimap can mark them as new', () => {
    mutations().addNode(node(7), context)

    expect(
      useAgentGeneratedNodesStore().generatedAtFor(
        createNodeLocatorId(null, toNodeId(7))
      )
    ).toBeTypeOf('number')
  })

  it('leaves human edits and catch-up frames unmarked', () => {
    mutations().addNode(node(8), { ...context, actor: 'human:someone:tab-1' })
    mutations().addNode(node(9), { ...context, hydration: true })

    const agentNodes = useAgentGeneratedNodesStore()
    expect(
      agentNodes.generatedAtFor(createNodeLocatorId(null, toNodeId(8)))
    ).toBeUndefined()
    expect(
      agentNodes.generatedAtFor(createNodeLocatorId(null, toNodeId(9)))
    ).toBeUndefined()
  })

  it('marks a catch-up that lands while a turn is running', () => {
    useWorkflowTabActivityStore().setAgentRunning(true)

    mutations().addNode(node(11), { ...context, hydration: true })

    expect(
      useAgentGeneratedNodesStore().generatedAtFor(
        createNodeLocatorId(null, toNodeId(11))
      )
    ).toBeTypeOf('number')
  })

  it('forgets the mark when the node is deleted', () => {
    const agentNodes = useAgentGeneratedNodesStore()
    mutations().addNode(node(20), context)

    mutations().deleteNode(toNodeId(20), [], context)

    expect(
      agentNodes.generatedAtFor(createNodeLocatorId(null, toNodeId(20)))
    ).toBeUndefined()
  })

  it('does not transfer provenance through graph reset and historical hydration', () => {
    const graph = mutations()
    const locator = createNodeLocatorId(null, toNodeId(23))
    const agentNodes = useAgentGeneratedNodesStore()
    expect(graph.addNode(node(23), context)).toBe(true)
    expect(agentNodes.generatedAtFor(locator)).toBeTypeOf('number')

    expect(graph.clearSemanticGraph(context)).toBe(true)
    expect(
      graph.addNode(node(23, { seed: 987 }), { ...context, hydration: true })
    ).toBe(true)

    expect(agentNodes.generatedAtFor(locator)).toBeUndefined()
  })

  it('drops a stale mark when a human takes the id', () => {
    const agentNodes = useAgentGeneratedNodesStore()
    const locatorId = createNodeLocatorId(null, toNodeId(21))
    agentNodes.markGenerated(locatorId)

    mutations().addNode(node(21), {
      ...context,
      actor: 'human:someone:tab-1'
    })

    expect(agentNodes.generatedAtFor(locatorId)).toBeUndefined()
  })

  it('marks a node whose frame carried no op ids', () => {
    mutations().addNode(node(10), { ...context, opId: 'replay' })

    expect(
      useAgentGeneratedNodesStore().generatedAtFor(
        createNodeLocatorId(null, toNodeId(10))
      )
    ).toBeTypeOf('number')
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
