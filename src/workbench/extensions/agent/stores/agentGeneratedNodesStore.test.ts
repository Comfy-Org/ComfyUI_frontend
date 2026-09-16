import { describe, expect, it, vi } from 'vitest'

import { createGraphMutations } from '@/core/graph/graphMutations'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useExtensionStore } from '@/stores/extensionStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import {
  graphScopeOf,
  toOwningGraphId,
  toRootGraphId
} from '@/types/graphScopeId'
import type { GraphScope } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toNodeId } from '@/types/nodeId'
import { createNodeState } from '@/utils/__tests__/litegraphTestUtils'

import { toTurnId } from '../schemas/agentApiSchema'
import { useAgentGeneratedNodesStore } from './agentGeneratedNodesStore'

const rootScope: GraphScope = {
  rootGraphId: toRootGraphId('00000000-0000-0000-0000-000000000001'),
  owningGraphId: toOwningGraphId('00000000-0000-0000-0000-000000000001')
}
const ownerScope: GraphScope = {
  rootGraphId: rootScope.rootGraphId,
  owningGraphId: toOwningGraphId('00000000-0000-0000-0000-000000000002')
}
const otherRootScope: GraphScope = {
  rootGraphId: toRootGraphId('00000000-0000-0000-0000-000000000003'),
  owningGraphId: toOwningGraphId('00000000-0000-0000-0000-000000000003')
}
const agentContext: RemoteMutationContext = {
  source: 'agent-remote',
  actor: 'agent:test',
  opId: 'op-1'
}

function graphMutations(scope: GraphScope = rootScope) {
  return createGraphMutations({
    getScope: () => scope,
    layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
  })
}

function payload(id: number): ComfyWorkflowJSON['nodes'][number] {
  return {
    id,
    type: `Type${id}`,
    pos: [0, 0],
    size: [100, 100],
    flags: {},
    order: 0,
    mode: 0,
    properties: {}
  }
}

function state(id: number, scope: GraphScope = rootScope) {
  return createNodeState({
    id: toNodeId(id),
    graphId: scope.owningGraphId,
    title: `Node ${id}`
  })
}

function workflowGraph(id: number): ReturnType<LGraph['serialize']> {
  const graph = new LGraph()
  const node = new LGraphNode(`Node ${id}`, `Type${id}`)
  node.id = toNodeId(id)
  graph.add(node)
  const serialized = graph.serialize()
  graph.clear()
  return serialized
}

async function activateWorkflow(
  name: string,
  graph: ReturnType<LGraph['serialize']>
) {
  const workflows = useWorkflowStore()
  const workflow = workflows.createTemporary(name, zComfyWorkflow.parse(graph))
  const loaded = await workflow.load()
  workflows.attachWorkflow(loaded)
  workflows.activeWorkflow = loaded
  return loaded
}

function scopeFor(graph: Pick<ComfyWorkflowJSON, 'id'>): GraphScope {
  if (!graph.id) throw new Error('Expected workflow graph id')
  const rootGraphId = toRootGraphId(graph.id)
  return { rootGraphId, owningGraphId: toOwningGraphId(graph.id) }
}

function lifecycleExtension() {
  const extension = useExtensionStore().enabledExtensions.find(
    ({ name }) => name === 'Comfy.AgentGeneratedNodesLifecycle'
  )
  if (!extension)
    throw new Error('Expected generated-nodes lifecycle extension')
  return extension
}

async function switchWorkflow(
  graph: LGraph,
  workflow: Awaited<ReturnType<typeof activateWorkflow>>,
  contents: ReturnType<LGraph['serialize']>
): Promise<void> {
  const lifecycle = lifecycleExtension()
  await lifecycle.beforeLoadGraph?.(app)
  graph.clear()
  await lifecycle.beforeConfigureGraph?.(
    zComfyWorkflow.parse(JSON.parse(JSON.stringify(contents))),
    [],
    app
  )
  graph.configure(structuredClone(contents))
  useWorkflowStore().activeWorkflow = workflow
  await lifecycle.afterLoadGraph?.(app)
}

describe('agentGeneratedNodesStore', () => {
  it('recreates its lifecycle registration after disposal', () => {
    useAgentGeneratedNodesStore().$dispose()
    expect(
      useExtensionStore().isExtensionInstalled(
        'Comfy.AgentGeneratedNodesLifecycle'
      )
    ).toBe(false)

    const recreated = useAgentGeneratedNodesStore()
    expect(
      useExtensionStore().isExtensionInstalled(
        'Comfy.AgentGeneratedNodesLifecycle'
      )
    ).toBe(true)
    graphMutations().addNode(payload(1), agentContext)
    expect(recreated.generatedAtFor(rootScope, toNodeId(1))).toBeTypeOf(
      'number'
    )
  })

  it.for([
    {
      name: 'live agent',
      actor: 'agent:test',
      hydration: false,
      turn: false,
      marked: true
    },
    {
      name: 'replay without op ids',
      actor: 'agent-replay',
      hydration: false,
      turn: false,
      marked: true
    },
    {
      name: 'human',
      actor: 'human:someone:tab-1',
      hydration: false,
      turn: false,
      marked: false
    },
    {
      name: 'historical hydration',
      actor: 'agent:test',
      hydration: true,
      turn: false,
      marked: false
    },
    {
      name: 'active-turn hydration',
      actor: 'agent:test',
      hydration: true,
      turn: true,
      marked: true
    }
  ])('classifies $name registration', ({ actor, hydration, turn, marked }) => {
    const provenance = useAgentGeneratedNodesStore()
    if (turn) provenance.beginTurn(toTurnId('turn-1'), 'test')
    const context = { ...agentContext, actor, ...(hydration && { hydration }) }

    expect(graphMutations().addNode(payload(1), context)).toBe(true)

    expect(
      provenance.generatedAtFor(rootScope, toNodeId(1)) !== undefined
    ).toBe(marked)
  })

  it('spaces a hydration cascade by 90ms and caps it 900ms ahead', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1_000)
    const provenance = useAgentGeneratedNodesStore()
    provenance.beginTurn(toTurnId('turn-1'), 'test')
    const graph = graphMutations()

    for (let id = 1; id <= 12; id++)
      graph.addNode(payload(id), { ...agentContext, hydration: true })

    const stamps = Array.from({ length: 12 }, (_, index) =>
      provenance.generatedAtFor(rootScope, toNodeId(index + 1))
    )
    expect(stamps[0]).toBe(1_000)
    expect(stamps[1]).toBe(1_090)
    expect(stamps[10]).toBe(1_900)
    expect(stamps[11]).toBe(1_900)
    expect(provenance.latestMarkAt(rootScope)).toBe(1_900)
  })

  it('keeps the cascade deadline when a live node arrives and recomputes it after deletion', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1_000)
    const provenance = useAgentGeneratedNodesStore()
    const graph = graphMutations()
    provenance.beginTurn(toTurnId('turn-1'), 'test')
    for (let id = 1; id <= 11; id++)
      graph.addNode(payload(id), { ...agentContext, hydration: true })

    now.mockReturnValue(1_050)
    graph.addNode(payload(12), agentContext)
    expect(provenance.latestMarkAt(rootScope)).toBe(1_900)

    const newest = useNodeDataStore().getNode(
      rootScope.rootGraphId,
      toNodeId(11)
    )
    if (!newest) throw new Error('Expected newest cascaded node')
    useNodeDataStore().deleteNode(rootScope, newest)
    expect(provenance.latestMarkAt(rootScope)).toBe(1_810)
  })

  it('reports generated nodes by root until the turn completion delay', () => {
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockReturnValue(1_000)
    const provenance = useAgentGeneratedNodesStore()
    const turnId = toTurnId('turn-1')
    provenance.beginTurn(turnId, 'test')

    graphMutations().addNode(payload(1), agentContext)

    expect(provenance.activities.get(rootScope.rootGraphId)).toEqual({
      phase: 'working',
      turnId,
      nodes: ['1'],
      shownAt: 1_000
    })

    provenance.finishTurn(turnId)
    vi.advanceTimersByTime(1_200)
    expect(provenance.activities.get(rootScope.rootGraphId)?.phase).toBe(
      'complete'
    )
  })

  it('keeps the completion floor for nodes arriving after finish', () => {
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockReturnValue(1_000)
    const provenance = useAgentGeneratedNodesStore()
    const turnId = toTurnId('turn-1')
    provenance.beginTurn(turnId, 'test')
    graphMutations().addNode(payload(1), agentContext)
    provenance.finishTurn(turnId)

    vi.advanceTimersByTime(600)
    graphMutations().addNode(payload(2), agentContext)
    expect(provenance.activities.get(rootScope.rootGraphId)?.phase).toBe(
      'working'
    )

    vi.advanceTimersByTime(599)
    expect(provenance.activities.get(rootScope.rootGraphId)?.phase).toBe(
      'working'
    )
    vi.advanceTimersByTime(1)
    expect(provenance.activities.get(rootScope.rootGraphId)?.phase).toBe(
      'complete'
    )
  })

  it('ignores an obsolete completion timer and counts only nodes from the next turn', () => {
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockReturnValue(1_000)
    const provenance = useAgentGeneratedNodesStore()
    const first = toTurnId('turn-1')
    provenance.beginTurn(first, 'test')
    graphMutations().addNode(payload(1), agentContext)
    provenance.finishTurn(first)
    vi.advanceTimersByTime(600)
    provenance.beginTurn(toTurnId('turn-2'), 'test')
    graphMutations().addNode(payload(2), agentContext)
    vi.runOnlyPendingTimers()

    expect(provenance.activities.get(rootScope.rootGraphId)).toMatchObject({
      phase: 'working',
      nodes: ['2']
    })
  })

  it('preserves marks and a completed report through a real A-B-A switch', async () => {
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockReturnValue(1_000)
    const firstGraph = workflowGraph(1)
    const secondGraph = workflowGraph(2)
    const first = await activateWorkflow('first.json', firstGraph)
    const second = await activateWorkflow('second.json', secondGraph)
    const provenance = useAgentGeneratedNodesStore()
    const scope = scopeFor(firstGraph)
    const canvasGraph = new LGraph()
    canvasGraph.configure(structuredClone(firstGraph))
    useWorkflowStore().activeWorkflow = first
    provenance.beginTurn(toTurnId('turn-1'), 'test')
    const node = canvasGraph.getNodeById(toNodeId(1))
    if (!node) throw new Error('Expected loaded node')
    useNodeDataStore().deleteNode(scope, node._state)
    useNodeDataStore().registerNode(scope, node._state, agentContext)
    provenance.finishTurn(toTurnId('turn-1'))
    vi.advanceTimersByTime(1_200)

    expect(provenance.generatedAtFor(scope, toNodeId(1))).toBeTypeOf('number')
    await switchWorkflow(canvasGraph, second, secondGraph)
    expect(canvasGraph.getNodeById(toNodeId(1))).toBeNull()
    expect(canvasGraph.getNodeById(toNodeId(2))).not.toBeNull()
    expect(provenance.generatedAtFor(scope, toNodeId(1))).toBeUndefined()
    await switchWorkflow(canvasGraph, first, firstGraph)

    expect(canvasGraph.getNodeById(toNodeId(1))).not.toBeNull()
    expect(canvasGraph.getNodeById(toNodeId(2))).toBeNull()
    expect(provenance.generatedAtFor(scope, toNodeId(1))).toBeTypeOf('number')
    expect(provenance.activities.get(scope.rootGraphId)).toMatchObject({
      phase: 'complete',
      nodes: ['1']
    })
  })

  it.for([
    { name: 'changed contents on the same instance', replacement: false },
    { name: 'a new instance with identical contents', replacement: true }
  ])('does not restore marks for $name', async ({ replacement }) => {
    const originalGraph = workflowGraph(1)
    const original = await activateWorkflow('shared.json', originalGraph)
    const scope = scopeFor(originalGraph)
    const provenance = useAgentGeneratedNodesStore()
    const canvasGraph = new LGraph()
    canvasGraph.configure(structuredClone(originalGraph))
    const node = canvasGraph.getNodeById(toNodeId(1))
    if (!node) throw new Error('Expected loaded node')
    useNodeDataStore().deleteNode(scope, node._state)
    useNodeDataStore().registerNode(scope, node._state, agentContext)

    const incoming = replacement
      ? originalGraph
      : { ...structuredClone(originalGraph), nodes: workflowGraph(2).nodes }
    const target = replacement
      ? await activateWorkflow(
          'replacement.json',
          structuredClone(originalGraph)
        )
      : original
    if (replacement) target.path = original.path
    useWorkflowStore().activeWorkflow = original
    await switchWorkflow(canvasGraph, target, incoming)

    expect(provenance.generatedAtFor(scope, toNodeId(1))).toBeUndefined()
  })

  it('LGraph.remove immediately erases provenance and human id reuse stays unmarked', () => {
    const graph = new LGraph()
    const scope = graphScopeOf(graph)
    const provenance = useAgentGeneratedNodesStore()
    const node = new LGraphNode('Generated', 'Generated')
    node.id = toNodeId(1)
    graph.add(node)
    useNodeDataStore().deleteNode(scope, node._state)
    useNodeDataStore().registerNode(scope, node._state, agentContext)
    expect(provenance.generatedAtFor(scope, node.id)).toBeTypeOf('number')

    graph.remove(node)
    expect(graph.getNodeById(node.id)).toBeNull()
    expect(provenance.generatedAtFor(scope, node.id)).toBeUndefined()

    const reused = new LGraphNode('Human', 'Human')
    reused.id = toNodeId(1)
    graph.add(reused)
    expect(graph.getNodeById(reused.id)).toBe(reused)
    expect(provenance.generatedAtFor(scope, reused.id)).toBeUndefined()
  })

  it('isolates the same node id by root and owning graph', () => {
    const provenance = useAgentGeneratedNodesStore()
    const nodes = useNodeDataStore()

    nodes.registerNode(rootScope, state(1), agentContext)
    nodes.registerNode(ownerScope, state(2, ownerScope), agentContext)
    nodes.registerNode(otherRootScope, state(1, otherRootScope), agentContext)

    expect(provenance.generatedAtFor(rootScope, toNodeId(1))).toBeTypeOf(
      'number'
    )
    expect(provenance.generatedAtFor(ownerScope, toNodeId(2))).toBeTypeOf(
      'number'
    )
    expect(provenance.generatedAtFor(otherRootScope, toNodeId(1))).toBeTypeOf(
      'number'
    )
    expect(provenance.generatedAtFor(ownerScope, toNodeId(1))).toBeUndefined()
  })

  it('immediately forgets deleted provenance and leaves reused ids clean', () => {
    const provenance = useAgentGeneratedNodesStore()
    const nodes = useNodeDataStore()
    const generated = state(1)
    nodes.registerNode(rootScope, generated, agentContext)

    expect(nodes.deleteNode(rootScope, generated)).toBe(true)
    expect(provenance.generatedAtFor(rootScope, generated.id)).toBeUndefined()

    nodes.registerNode(rootScope, state(1), {
      ...agentContext,
      actor: 'human:someone'
    })
    expect(provenance.generatedAtFor(rootScope, generated.id)).toBeUndefined()
  })

  it('does not transfer provenance through reset and historical reuse', () => {
    const provenance = useAgentGeneratedNodesStore()
    const graph = graphMutations()
    expect(graph.addNode(payload(23), agentContext)).toBe(true)
    expect(provenance.generatedAtFor(rootScope, toNodeId(23))).toBeTypeOf(
      'number'
    )

    expect(graph.clearSemanticGraph(agentContext)).toBe(true)
    expect(
      graph.addNode(payload(23), { ...agentContext, hydration: true })
    ).toBe(true)

    expect(provenance.generatedAtFor(rootScope, toNodeId(23))).toBeUndefined()
  })

  it('clears only the requested owner, then the complete root', () => {
    const provenance = useAgentGeneratedNodesStore()
    const nodes = useNodeDataStore()
    nodes.registerNode(rootScope, state(1), agentContext)
    nodes.registerNode(ownerScope, state(2, ownerScope), agentContext)
    nodes.registerNode(otherRootScope, state(1, otherRootScope), agentContext)

    nodes.clearOwner(ownerScope)
    expect(provenance.generatedAtFor(ownerScope, toNodeId(2))).toBeUndefined()
    expect(provenance.generatedAtFor(rootScope, toNodeId(1))).toBeTypeOf(
      'number'
    )

    nodes.clearGraph(rootScope.rootGraphId)
    expect(provenance.generatedAtFor(rootScope, toNodeId(1))).toBeUndefined()
    expect(provenance.generatedAtFor(otherRootScope, toNodeId(1))).toBeTypeOf(
      'number'
    )
  })

  it('does not mark a registration rejected by an occupied id', () => {
    const provenance = useAgentGeneratedNodesStore()
    const nodes = useNodeDataStore()
    nodes.registerNode(rootScope, state(1))

    expect(
      nodes.registerNode(ownerScope, state(1, ownerScope), agentContext)
    ).toBeUndefined()
    expect(provenance.generatedAtFor(ownerScope, toNodeId(1))).toBeUndefined()
    expect(provenance.generatedAtFor(rootScope, toNodeId(1))).toBeUndefined()
  })
})
