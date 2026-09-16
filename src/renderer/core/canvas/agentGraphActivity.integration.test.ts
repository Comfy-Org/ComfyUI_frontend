import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { getActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createGraphMutations } from '@/core/graph/graphMutations'
import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraphData } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { defaultGraph } from '@/scripts/defaultGraph'
import { useCanvasOverlayStore } from '@/stores/canvasOverlayStore'
import { useMinimapLayerStore } from '@/stores/minimapLayerStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { useAgentGeneratedNodesStore } from '@/workbench/extensions/agent/stores/agentGeneratedNodesStore'

async function renderBar() {
  useAgentGeneratedNodesStore()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/:pathMatch(.*)*',
        component: { template: '<div />' }
      }
    ]
  })
  const result = render(useCanvasOverlayStore().components[0], {
    global: {
      plugins: [
        getActivePinia()!,
        router,
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  })
  await vi.dynamicImportSettled()
  await nextTick()
  return result
}

async function activate(root: LGraph, name = `${root.id}.json`) {
  Reflect.set(app, 'rootGraphInternal', root)
  const graph = { ...structuredClone(defaultGraph), id: root.id }
  const workflow = useWorkflowStore().createTemporary(name, graph)
  const loaded = await workflow.load()
  useWorkflowStore().attachWorkflow(loaded)
  useWorkflowStore().activeWorkflow = loaded
  return loaded
}

function addReportedNode(root: LGraph, id: number): LGraphNode {
  const node = new LGraphNode(`Node ${id}`, `Type${id}`)
  node.id = toNodeId(id)
  const mutations = createGraphMutations({
    getScope: () => graphScopeOf(root),
    layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
  })
  mutations.addNode(
    { id, type: node.type, pos: [...node.pos], size: [...node.size] },
    { source: 'agent-remote', actor: 'agent:test', opId: `op-${id}` }
  )
  return node
}

describe('AgentGraphActivityBar', () => {
  let root: LGraph

  beforeEach(async () => {
    root = new LGraph()
    await activate(root)
  })

  it('includes an arrival in the same task as turn start', async () => {
    await renderBar()
    useAgentGeneratedNodesStore().beginTurn(toTurnId('turn-1'), 'test')
    addReportedNode(root, 1)
    await nextTick()

    expect(screen.getByTestId('agent-graph-activity-bar')).toBeInTheDocument()
    expect(screen.getByTestId('agent-graph-view-working')).toHaveTextContent(
      'View node'
    )
  })

  it('retains activity across a presentation remount', async () => {
    const first = await renderBar()
    useAgentGeneratedNodesStore().beginTurn(toTurnId('turn-1'), 'test')
    addReportedNode(root, 1)
    addReportedNode(root, 2)
    await nextTick()
    expect(useMinimapLayerStore().layers).toHaveLength(1)
    first.unmount()
    expect(useMinimapLayerStore().layers).toHaveLength(1)

    await renderBar()

    expect(screen.getByTestId('agent-graph-view-working')).toHaveTextContent(
      'View nodes'
    )
  })

  it('renders a replaced activity map and dismisses its completed report', async () => {
    await renderBar()
    const generatedNodes = useAgentGeneratedNodesStore()
    const rootId = graphScopeOf(root).rootGraphId
    generatedNodes.activities = new Map([
      [
        rootId,
        {
          phase: 'complete',
          turnId: toTurnId('turn-1'),
          shownAt: 0,
          nodes: [createNodeLocatorId(null, toNodeId(1))]
        }
      ]
    ])

    expect(
      await screen.findByTestId('agent-graph-added-toast')
    ).toHaveTextContent('1 node added')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(generatedNodes.activities.has(rootId)).toBe(false)
    expect(screen.queryByTestId('agent-graph-added-toast')).toBeNull()
  })

  it('keeps activity with its root when the tab switches before flush', async () => {
    const recipient = useWorkflowStore().activeWorkflow
    await renderBar()
    useAgentGeneratedNodesStore().beginTurn(toTurnId('turn-1'), 'test')
    addReportedNode(root, 1)
    const other = new LGraph()
    await activate(other)
    await nextTick()

    expect(screen.queryByTestId('agent-graph-activity-bar')).toBeNull()

    useWorkflowStore().activeWorkflow = recipient
    await nextTick()
    expect(screen.getByTestId('agent-graph-activity-bar')).toBeInTheDocument()
  })

  it('frames same-owner nodes from real root and subgraph locators', async () => {
    const rootNode = new LGraphNode('Root', 'Root')
    rootNode.id = toNodeId(1)
    root.add(rootNode)
    rootNode.pos = [10, 20]
    rootNode.size = [30, 40]
    const subgraph = root.createSubgraph(createTestSubgraphData())
    const first = new LGraphNode('First', 'First')
    first.id = toNodeId(2)
    first.pos = [100, 200]
    first.size = [50, 60]
    subgraph.add(first)
    const latest = new LGraphNode('Latest', 'Latest')
    latest.id = toNodeId(3)
    latest.pos = [400, 500]
    latest.size = [70, 80]
    subgraph.add(latest)

    const canvasElement = document.createElement('canvas')
    canvasElement.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    const canvas = new LGraphCanvas(canvasElement, root, { skip_render: true })
    const animate = vi
      .spyOn(canvas, 'animateToBounds')
      .mockImplementation(vi.fn())
    app.canvas = canvas
    useCanvasStore().canvas = canvas
    const activity = useAgentGeneratedNodesStore()
    activity.activities.set(graphScopeOf(root).rootGraphId, {
      phase: 'working',
      turnId: toTurnId('turn-1'),
      shownAt: 0,
      nodes: [
        createNodeLocatorId(null, rootNode.id),
        createNodeLocatorId(subgraph.id, first.id),
        createNodeLocatorId(subgraph.id, latest.id)
      ]
    })
    await renderBar()
    await userEvent.click(screen.getByTestId('agent-graph-view-working'))

    expect(canvas.graph).toBe(subgraph)
    expect(animate).toHaveBeenCalledWith([60, 160, 450, 460], {
      viewport: expect.any(Array)
    })
  })

  it('returns from a subgraph and updates the live union as root nodes arrive', async () => {
    const first = new LGraphNode('First', 'First')
    first.id = toNodeId(1)
    first.pos = [10, 20]
    first.size = [30, 40]
    root.add(first)
    const second = new LGraphNode('Second', 'Second')
    second.id = toNodeId(2)
    second.pos = [100, 120]
    second.size = [50, 60]
    root.add(second)
    const subgraph = root.createSubgraph(createTestSubgraphData())
    const canvasElement = document.createElement('canvas')
    canvasElement.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    const canvas = new LGraphCanvas(canvasElement, root, { skip_render: true })
    canvas.setGraph(subgraph)
    const animate = vi
      .spyOn(canvas, 'animateToBounds')
      .mockImplementation(vi.fn())
    app.canvas = canvas
    useCanvasStore().canvas = canvas
    const activities = useAgentGeneratedNodesStore().activities
    const rootId = graphScopeOf(root).rootGraphId
    const report = {
      phase: 'working' as const,
      turnId: toTurnId('turn-1'),
      shownAt: 0,
      nodes: [createNodeLocatorId(null, first.id)]
    }
    activities.set(rootId, report)
    await renderBar()

    await userEvent.click(screen.getByRole('button', { name: /^View node$/ }))

    expect(canvas.graph).toBe(root)
    expect(animate).toHaveBeenLastCalledWith([-30, -20, 110, 120], {
      viewport: expect.any(Array)
    })
    activities.set(rootId, {
      ...report,
      nodes: [...report.nodes, createNodeLocatorId(null, second.id)]
    })
    await nextTick()
    await userEvent.click(screen.getByRole('button', { name: 'View nodes' }))

    expect(canvas.graph).toBe(root)
    expect(animate).toHaveBeenLastCalledWith([-30, -20, 220, 240], {
      viewport: expect.any(Array)
    })
  })
})
