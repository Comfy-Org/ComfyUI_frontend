import { markRaw, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'

import { i18n } from '@/i18n'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyApp } from '@/scripts/app'
import { toRootGraphId } from '@comfyorg/graph-model/graphScopeId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

import AgentGraphActivityBar from './AgentGraphActivityBar.vue'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { useAgentGraphActivityStore } from '@/workbench/extensions/agent/stores/agent/agentGraphActivityStore'

const TARGET = { workflowId: 'wf-1', rootGraphId: toRootGraphId('graph-1') }
const BATCH_SETTLED_MS = 200

const CANVAS_RECT = new DOMRect(0, 0, 1200, 800)
const UNCOVERED_PANEL_RECT = new DOMRect(0, 0, 800, 800)

function makeNode(id: number, pos: [number, number]): LGraphNode {
  const node = fromPartial<LGraphNode>({})
  Object.assign(node, { id: toNodeId(id), pos, size: [100, 80] })
  return node
}

const node = makeNode(1, [10, 20])
const secondNode = makeNode(2, [7400, 6500])
const graph = fromPartial<LGraph>({ id: 'graph-1', nodes: [node, secondNode] })
const canvas = markRaw(
  fromPartial<LGraphCanvas>({
    graph,
    canvas: { getBoundingClientRect: () => CANVAS_RECT },
    ds: fromPartial<LGraphCanvas['ds']>({
      scale: 1,
      offset: [0, 0],
      convertCanvasToOffset: (pos) => [pos[0], pos[1]]
    }),
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
function mount() {
  return render(AgentGraphActivityBar, {
    props: { canvas },
    global: { plugins: [i18n] }
  })
}

let graphCanvasPanel: HTMLElement

function mountGraphCanvasPanel() {
  document.body.innerHTML = ''
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
    vi.mocked(canvas.animateToBounds).mockClear()
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

  it('frames the combined batch when its nodes arrive in separate materializations', async () => {
    node.pos = [7000, 6500]
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(TARGET, [toNodeId(1)])
    await nextTick()
    activity.recordMaterialized(TARGET, [toNodeId(2)])
    await settle()

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

  it('leaves the camera alone when the batch is already on screen', async () => {
    secondNode.pos = [120, 20]
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(TARGET, [toNodeId(1), toNodeId(2)])
    await settle()

    expect(canvas.animateToBounds).not.toHaveBeenCalled()
    view.unmount()
  })

  it('frames a batch that landed only under the docked agent panel', async () => {
    node.pos = [900, 100]
    secondNode.pos = [1000, 100]
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(TARGET, [toNodeId(1), toNodeId(2)])
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
