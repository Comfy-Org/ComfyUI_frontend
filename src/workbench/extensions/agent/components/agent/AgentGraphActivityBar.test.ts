import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { getActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createGraphMutations } from '@/core/graph/graphMutations'
import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraphData } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import { toTurnId } from '../../schemas/agentApiSchema'
import { useAgentGeneratedNodesStore } from '../../stores/agentGeneratedNodesStore'
import AgentGraphActivityBar from './AgentGraphActivityBar.vue'

function renderBar() {
  return render(AgentGraphActivityBar, {
    global: {
      plugins: [
        getActivePinia()!,
        createRouter({ history: createMemoryHistory(), routes: [] }),
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  })
}

function activate(root: LGraph): void {
  Reflect.set(app, 'rootGraphInternal', root)
  useWorkflowStore().activeWorkflow = fromPartial<LoadedComfyWorkflow>({
    activeState: { id: root.id }
  })
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

  beforeEach(() => {
    root = new LGraph()
    activate(root)
  })

  it('includes an arrival in the same task as turn start', async () => {
    renderBar()
    useAgentGeneratedNodesStore().beginTurn(toTurnId('turn-1'))
    addReportedNode(root, 1)
    await nextTick()

    expect(screen.getByTestId('agent-graph-activity-bar')).toBeInTheDocument()
    expect(screen.getByTestId('agent-graph-view-working')).toHaveTextContent(
      'View node'
    )
  })

  it('retains activity across a presentation remount', async () => {
    const first = renderBar()
    useAgentGeneratedNodesStore().beginTurn(toTurnId('turn-1'))
    addReportedNode(root, 1)
    addReportedNode(root, 2)
    await nextTick()
    first.unmount()

    renderBar()

    expect(screen.getByTestId('agent-graph-view-working')).toHaveTextContent(
      'View nodes'
    )
  })

  it('keeps activity with its root when the tab switches before flush', async () => {
    const recipient = useWorkflowStore().activeWorkflow
    renderBar()
    useAgentGeneratedNodesStore().beginTurn(toTurnId('turn-1'))
    addReportedNode(root, 1)
    const other = new LGraph()
    useWorkflowStore().activeWorkflow = fromPartial<LoadedComfyWorkflow>({
      path: recipient?.path,
      activeState: { id: other.id }
    })
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
    renderBar()
    vi.mocked(useSubgraphNavigationStore().navigateToGraph).mockResolvedValue(
      true
    )

    await userEvent.click(screen.getByTestId('agent-graph-view-working'))

    expect(useSubgraphNavigationStore().navigateToGraph).toHaveBeenCalledWith(
      subgraph
    )
    expect(animate).toHaveBeenCalledWith([60, 160, 450, 460], {
      viewport: expect.any(Array)
    })
  })
})
