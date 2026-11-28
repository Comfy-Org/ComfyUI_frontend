import { markRaw, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'

import { i18n } from '@/i18n'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { ComfyApp } from '@/scripts/app'
import { toRootGraphId } from '@comfyorg/graph-model/graphScopeId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

import AgentGraphActivityBar from './AgentGraphActivityBar.vue'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { useAgentGraphActivityStore } from '@/workbench/extensions/agent/stores/agent/agentGraphActivityStore'

const TARGET = { workflowId: 'wf-1', rootGraphId: toRootGraphId('graph-1') }
const BATCH_SETTLED_MS = 150

const CANVAS_RECT = new DOMRect(0, 0, 1200, 800)
const UNCOVERED_PANEL_RECT = new DOMRect(0, 0, 800, 800)

const node = createMockLGraphNode({
  id: toNodeId(1),
  pos: [10, 20],
  size: [100, 80]
})
const secondNode = createMockLGraphNode({
  id: toNodeId(2),
  pos: [7400, 6500],
  size: [100, 80]
})
for (const graphNode of [node, secondNode]) {
  Object.defineProperties(graphNode, {
    boundingRect: {
      get: () => [
        graphNode.pos[0],
        graphNode.pos[1],
        graphNode.size[0],
        graphNode.size[1]
      ]
    },
    boundingOffset: { value: [0, 0] }
  })
}
const graph = markRaw(
  fromPartial<LGraph>({ id: 'graph-1', nodes: [node, secondNode] })
)
const canvasElement = document.createElement('canvas')
canvasElement.getBoundingClientRect = () => CANVAS_RECT
const dragAndScale = fromPartial<LGraphCanvas['ds']>({
  element: canvasElement,
  scale: 1,
  offset: [0, 0],
  getViewportSize: () => [CANVAS_RECT.width, CANVAS_RECT.height],
  convertCanvasToOffset: (pos) => [
    pos[0] / dragAndScale.scale - dragAndScale.offset[0],
    pos[1] / dragAndScale.scale - dragAndScale.offset[1]
  ]
})
const canvas = markRaw(
  fromPartial<LGraphCanvas>({
    graph,
    canvas: canvasElement,
    ds: dragAndScale,
    animateToBounds: vi.fn()
  })
)
node.graph = canvas.graph
secondNode.graph = canvas.graph

vi.mock(import('@/scripts/app'), () => ({
  app: fromPartial<ComfyApp>({
    rootGraph: fromPartial<LGraph>({ id: 'graph-1' })
  })
}))
vi.mock(import('@/utils/graphTraversalUtil'))
function mount(displayedGraph: LGraph = graph) {
  return render(AgentGraphActivityBar, {
    props: { canvas, graph: displayedGraph },
    global: { plugins: [i18n] }
  })
}

let graphCanvasPanel: HTMLElement

function mountGraphCanvasPanel() {
  graphCanvasPanel = document.createElement('div')
  graphCanvasPanel.className = 'graph-canvas-panel'
  document.body.appendChild(graphCanvasPanel)
}

function setPanelRect(rect: DOMRect) {
  graphCanvasPanel.getBoundingClientRect = () => rect
}

async function settle() {
  await nextTick()
  await vi.advanceTimersByTimeAsync(BATCH_SETTLED_MS)
}

describe('AgentGraphActivityBar', () => {
  beforeEach(() => {
    vi.mocked(getNodeByLocatorId).mockImplementation(
      (_root, locator) =>
        [node, secondNode].find((n) => String(n.id) === locator) ?? null
    )
    mountGraphCanvasPanel()
    setPanelRect(UNCOVERED_PANEL_RECT)
    vi.useFakeTimers()
    canvas.graph = graph
    graph.nodes.splice(0, graph.nodes.length, node, secondNode)
    dragAndScale.scale = 1
    dragAndScale.offset = [0, 0]
    node.pos = [10, 20]
    secondNode.pos = [7400, 6500]
  })

  it('preserves a user pan across component remounts in the same turn', async () => {
    node.pos = [7000, 6500]
    const firstView = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(TARGET, [toNodeId(1), toNodeId(2)])
    await settle()

    expect(canvas.animateToBounds).toHaveBeenCalledTimes(1)

    firstView.unmount()
    const remountedView = mount()
    activity.recordMaterialized(TARGET, [toNodeId(1), toNodeId(2)])
    await settle()
    expect(
      canvas.animateToBounds,
      'a later materialization in the same turn must not drag the camera again'
    ).toHaveBeenCalledTimes(1)
    remountedView.unmount()
  })

  it('frames an unframed materialized batch after the activity bar remounts', async () => {
    node.pos = [7000, 6500]
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(TARGET, [toNodeId(1), toNodeId(2)])

    const view = mount()
    await settle()

    expect(canvas.animateToBounds).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('frames the combined batch when its nodes arrive in separate materializations', async () => {
    node.pos = [7000, 6500]
    graph.nodes.splice(0, graph.nodes.length, node)
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(TARGET, [toNodeId(1)])
    await nextTick()
    await vi.advanceTimersByTimeAsync(BATCH_SETTLED_MS - 50)
    expect(canvas.animateToBounds).not.toHaveBeenCalled()

    graph.nodes.push(secondNode)
    activity.recordMaterialized(TARGET, [toNodeId(2)])
    await nextTick()
    await vi.advanceTimersByTimeAsync(BATCH_SETTLED_MS - 1)
    expect(canvas.animateToBounds).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(canvas.animateToBounds).toHaveBeenCalledTimes(1)
    expect(
      Array.from(vi.mocked(canvas.animateToBounds).mock.calls[0][0]),
      'the camera must fit every node of the batch, not only the first to arrive'
    ).toEqual([6960, 6460, 580, 160])
    view.unmount()
  })

  it('frames a later turn on the same target after the first one framed', async () => {
    node.pos = [7000, 6500]
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn(toTurnId('turn-1'))
    activity.recordMaterialized(
      TARGET,
      [toNodeId(1), toNodeId(2)],
      toTurnId('turn-1')
    )
    await settle()
    expect(canvas.animateToBounds).toHaveBeenCalledTimes(1)

    activity.finishTurn()
    activity.startTurn(toTurnId('turn-2'))
    activity.recordMaterialized(
      TARGET,
      [toNodeId(1), toNodeId(2)],
      toTurnId('turn-2')
    )
    await settle()
    expect(canvas.animateToBounds).toHaveBeenCalledTimes(2)
    view.unmount()
  })

  it('does not reframe an initially visible batch when the turn completes', async () => {
    secondNode.pos = [120, 20]
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(TARGET, [toNodeId(1), toNodeId(2)])
    await settle()
    expect(canvas.animateToBounds).not.toHaveBeenCalled()
    expect(activity.currentTurnFramed).toBe(false)

    activity.finishTurn()
    dragAndScale.offset = [-2000, -2000]
    await vi.advanceTimersByTimeAsync(1_000 + BATCH_SETTLED_MS)

    expect(canvas.animateToBounds).not.toHaveBeenCalled()
    view.unmount()
  })

  it('frames a batch that landed only under the docked agent panel', async () => {
    dragAndScale.scale = 2
    dragAndScale.offset = [100, 50]
    node.pos = [300, 100]
    secondNode.pos = [350, 100]
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(TARGET, [toNodeId(1), toNodeId(2)])
    await settle()

    expect(canvas.animateToBounds).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('frames a batch hidden under the responsive agent overlay', async () => {
    node.pos = [600, 100]
    secondNode.pos = [700, 100]
    const overlay = document.createElement('div')
    overlay.dataset.testid = 'docked-agent-panel'
    overlay.getBoundingClientRect = () => new DOMRect(500, 0, 300, 800)
    document.body.appendChild(overlay)
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(TARGET, [toNodeId(1), toNodeId(2)])
    await settle()

    expect(canvas.animateToBounds).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('does not spend framing when the responsive agent overlay covers the canvas', async () => {
    node.pos = [600, 100]
    secondNode.pos = [700, 100]
    const overlay = document.createElement('div')
    overlay.dataset.testid = 'docked-agent-panel'
    overlay.getBoundingClientRect = () => new DOMRect(0, 0, 1200, 800)
    document.body.appendChild(overlay)
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(TARGET, [toNodeId(1), toNodeId(2)])
    await settle()

    expect(canvas.animateToBounds).not.toHaveBeenCalled()
    expect(activity.currentTurnFramed).toBe(false)
    view.unmount()
  })

  it('retries the root batch after returning from another displayed graph', async () => {
    node.pos = [7000, 6500]
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(TARGET, [toNodeId(1), toNodeId(2)])
    await nextTick()

    const overlappingNode = createMockLGraphNode({ id: toNodeId(1) })
    const subgraph = markRaw(
      fromPartial<LGraph>({
        id: 'subgraph-1',
        nodes: [overlappingNode]
      })
    )
    overlappingNode.graph = subgraph
    canvas.graph = subgraph
    await view.rerender({ canvas, graph: subgraph })
    await vi.advanceTimersByTimeAsync(BATCH_SETTLED_MS)
    expect(canvas.animateToBounds).not.toHaveBeenCalled()

    canvas.graph = graph
    await view.rerender({ canvas, graph })
    await settle()
    expect(canvas.animateToBounds).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('retries framing on a later materialization when the canvas panel had no measured area', async () => {
    node.pos = [7000, 6500]
    setPanelRect(new DOMRect(0, 0, 0, 0))
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(TARGET, [toNodeId(1), toNodeId(2)])
    await settle()
    expect(canvas.animateToBounds).not.toHaveBeenCalled()

    setPanelRect(UNCOVERED_PANEL_RECT)
    activity.recordMaterialized(TARGET, [toNodeId(1), toNodeId(2)])
    await settle()
    expect(canvas.animateToBounds).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('does not move the camera after unmounting with a pending batch', async () => {
    node.pos = [7000, 6500]
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(TARGET, [toNodeId(1), toNodeId(2)])
    await nextTick()
    view.unmount()
    await vi.advanceTimersByTimeAsync(BATCH_SETTLED_MS)

    expect(canvas.animateToBounds).not.toHaveBeenCalled()
  })

  it('hides the report when it belongs to another graph', async () => {
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: toRootGraphId('another-graph') },
      [toNodeId(1)]
    )
    await settle()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    view.unmount()
  })
})
