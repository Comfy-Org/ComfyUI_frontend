import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { getActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useSettingStore } from '@/platform/settings/settingStore'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useAgentGeneratedNodesStore } from '@/stores/agentGeneratedNodesStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { toNodeId } from '@/types/nodeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

import AgentGraphActivityBar from './AgentGraphActivityBar.vue'

vi.mock(import('@/utils/graphTraversalUtil'), () => ({
  getNodeByLocatorId: vi.fn()
}))

vi.mock(import('@/renderer/core/canvas/useCanvasInteractions'), () => ({
  useCanvasInteractions: () =>
    fromPartial<ReturnType<typeof useCanvasInteractions>>({
      forwardEventToCanvas: vi.fn()
    })
}))

function renderBar(props: { panelEl?: HTMLElement } = {}) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const result = render(AgentGraphActivityBar, {
    props: { panelEl: undefined, ...props },
    global: {
      plugins: [
        getActivePinia()!,
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  })
  return { user, ...result }
}

const [VIEW_NODE, VIEW_NODES] = enMessages.agent.viewAddedNodes.split(' | ')

/** The bar is what marks the graph as being written to. */
const writingBar = () => screen.queryByTestId('agent-graph-activity-bar')
/** Its label follows the count, so the button is found by test id. */
const viewButton = () => screen.getByTestId('agent-graph-view-working')
const report = () => screen.queryByTestId('agent-graph-added-toast')

/** A DOMRect derives its far edges, so a stub of one has to as well. */
function rectOf(rect: Partial<DOMRect>) {
  const edges = {
    right: (rect.left ?? 0) + (rect.width ?? 0),
    bottom: (rect.top ?? 0) + (rect.height ?? 0)
  }
  return () => fromPartial<DOMRect>({ ...edges, ...rect })
}

/** The canvas spans the window; the panel is the visible graph within it. */
function stubLayout(
  layout: {
    panel: Partial<DOMRect>
    sidebar?: Partial<DOMRect>
    agentPanel?: Partial<DOMRect>
  } = {
    panel: { left: 0, top: 0, width: 1000, height: 540 }
  }
) {
  const panelEl = document.createElement('div')
  panelEl.getBoundingClientRect = rectOf(layout.panel)
  const canvasEl = document.createElement('canvas')
  canvasEl.getBoundingClientRect = rectOf({
    left: 0,
    top: 0,
    width: 1000,
    height: 540
  })
  if (layout.sidebar) {
    const sidebar = document.createElement('div')
    sidebar.className = 'side-tool-bar-container'
    sidebar.getBoundingClientRect = rectOf(layout.sidebar)
    document.body.append(sidebar)
  }
  if (layout.agentPanel) {
    const agentPanel = document.createElement('div')
    agentPanel.className = 'docked-agent-panel'
    agentPanel.getBoundingClientRect = rectOf(layout.agentPanel)
    document.body.append(agentPanel)
  }
  const animateToBounds = vi.fn()
  const canvas = fromPartial<LGraphCanvas>({
    animateToBounds,
    graph: null,
    canvas: canvasEl
  })
  return { panelEl, animateToBounds, canvas }
}

let nextNodeId = 0

async function agentAddsNodes(count = 1) {
  const store = useAgentGeneratedNodesStore()
  for (let i = 0; i < count; i++) {
    const locatorId = createNodeLocatorId(null, toNodeId(++nextNodeId))
    if (locatorId) store.markGenerated(locatorId)
  }
  await nextTick()
}

/** Past the turn-settle grace and the bar's floor together. */
async function barsSettle() {
  vi.advanceTimersByTime(2000)
  await nextTick()
}

async function turnRuns(running: boolean) {
  useWorkflowTabActivityStore().setAgentRunning(running)
  await nextTick()
  // Idle has to hold before the turn counts as over.
  if (!running) await barsSettle()
}

/** A turn that starts, adds `count` nodes, and finishes. */
async function turnAdds(count: number) {
  await turnRuns(true)
  await agentAddsNodes(count)
  await turnRuns(false)
}

describe('AgentGraphActivityBar', () => {
  it('stays away while the agent runs but has not touched the graph', async () => {
    renderBar()
    await turnRuns(true)

    expect(writingBar()).not.toBeInTheDocument()
  })

  it('appears once the agent adds a node to the graph', async () => {
    renderBar()
    await turnRuns(true)
    await agentAddsNodes()

    expect(writingBar()).toBeInTheDocument()
  })

  it('includes nodes delivered in the same task as turn start', async () => {
    renderBar()

    useWorkflowTabActivityStore().setAgentRunning(true)
    await agentAddsNodes()

    expect(writingBar()).toBeInTheDocument()
    expect(viewButton()).toHaveTextContent(VIEW_NODE)
  })

  it('retains live additions when the activity view remounts', async () => {
    const first = renderBar()
    await turnRuns(true)
    await agentAddsNodes(2)
    expect(writingBar()).toBeInTheDocument()

    first.unmount()
    renderBar()
    await nextTick()

    expect(writingBar()).toBeInTheDocument()
    expect(viewButton()).toHaveTextContent(VIEW_NODES)
  })

  it('keeps pending activity on the recipient when tabs switch before flush', async () => {
    const workflowStore = useWorkflowStore()
    const recipient = fromPartial<LoadedComfyWorkflow>({ path: 'agent.json' })
    workflowStore.activeWorkflow = recipient
    renderBar()
    await turnRuns(true)

    useAgentGeneratedNodesStore().markGenerated(
      createNodeLocatorId(null, toNodeId(++nextNodeId))
    )
    workflowStore.activeWorkflow = fromPartial<LoadedComfyWorkflow>({
      path: 'other.json'
    })
    await nextTick()

    expect(writingBar()).not.toBeInTheDocument()

    workflowStore.activeWorkflow = recipient
    await nextTick()

    expect(writingBar()).toBeInTheDocument()
  })

  it('tells the user the graph is still theirs to edit', async () => {
    renderBar()
    await turnRuns(true)
    await agentAddsNodes()

    expect(writingBar()).toHaveTextContent(enMessages.agent.editWhileWorking)
  })

  it('says what the agent is doing while it writes', async () => {
    renderBar()
    await turnRuns(true)
    await agentAddsNodes()

    expect(writingBar()).toHaveTextContent(enMessages.agent.updatingGraph)
  })

  it('frames what the turn has added without waiting for it to end', async () => {
    vi.mocked(getNodeByLocatorId).mockReturnValue(
      createMockLGraphNode({ pos: [0, 0], size: [10, 10], graph: null })
    )
    const { panelEl, animateToBounds, canvas } = stubLayout()
    const { user } = renderBar({ panelEl })
    useCanvasStore().canvas = canvas
    await turnRuns(true)
    await agentAddsNodes(2)

    await user.click(viewButton())

    expect(animateToBounds).toHaveBeenCalledOnce()
  })

  it('stays away for nodes that land while no turn is running', async () => {
    renderBar()
    await agentAddsNodes()

    expect(writingBar()).not.toBeInTheDocument()
  })

  it('reports what the finished turn added and stays put', async () => {
    renderBar()
    await turnAdds(3)

    expect(
      await screen.findByTestId('agent-graph-added-toast')
    ).toHaveTextContent('3 nodes added to the graph by agent')
    await waitFor(() => expect(writingBar()).not.toBeInTheDocument())

    vi.advanceTimersByTime(60_000)
    await nextTick()

    expect(report()).toBeInTheDocument()
  })

  it("rides out the idle between the turn's own messages", async () => {
    const tabActivity = useWorkflowTabActivityStore()
    renderBar()
    await turnRuns(true)
    await agentAddsNodes()

    tabActivity.setAgentRunning(false)
    await nextTick()
    vi.advanceTimersByTime(200)
    tabActivity.setAgentRunning(true)
    await nextTick()

    expect(writingBar()).toBeInTheDocument()
    expect(report()).not.toBeInTheDocument()
  })

  it('holds the bar when a whole workflow lands in one frame', async () => {
    renderBar()
    await turnRuns(true)
    await agentAddsNodes(5)
    useWorkflowTabActivityStore().setAgentRunning(false)
    await nextTick()

    expect(writingBar()).toBeInTheDocument()
    expect(report()).not.toBeInTheDocument()

    await barsSettle()

    await waitFor(() => expect(report()).toBeInTheDocument())
  })

  it('does not carry a finished turn into the next one', async () => {
    const settingStore = useSettingStore()
    renderBar()
    await turnAdds(2)
    await screen.findByTestId('agent-graph-added-toast')
    settingStore.settingValues['Comfy.Minimap.Visible'] = false

    await turnRuns(true)

    expect(writingBar()).not.toBeInTheDocument()
    expect(settingStore.get('Comfy.Minimap.Visible')).toBe(false)
  })

  it('still reports a turn after earlier nodes were deleted', async () => {
    const store = useAgentGeneratedNodesStore()
    renderBar()
    await turnAdds(3)
    await screen.findByTestId('agent-graph-added-toast')
    for (const locatorId of [...store.markedNodes]) store.forget(locatorId)
    await nextTick()

    await turnAdds(1)

    await waitFor(() =>
      expect(report()).toHaveTextContent('1 node added to the graph by agent')
    )
  })

  it('clears the report when the next turn begins', async () => {
    renderBar()
    await turnAdds(2)
    await screen.findByTestId('agent-graph-added-toast')

    await turnRuns(true)

    await waitFor(() => expect(report()).not.toBeInTheDocument())
  })

  it('counts only the nodes of the turn that just ended', async () => {
    renderBar()
    await turnAdds(2)
    await screen.findByTestId('agent-graph-added-toast')
    await turnAdds(1)

    await waitFor(() =>
      expect(report()).toHaveTextContent('1 node added to the graph by agent')
    )
    expect(
      screen.getByRole('button', { name: 'View node' })
    ).toBeInTheDocument()
  })

  it('reports nothing for a turn that never reached the graph', async () => {
    renderBar()
    await turnRuns(true)
    await turnRuns(false)
    await nextTick()

    expect(report()).not.toBeInTheDocument()
  })

  it('lets the report be dismissed', async () => {
    const { user } = renderBar()
    await turnAdds(1)
    await screen.findByTestId('agent-graph-added-toast')

    await user.click(
      screen.getByRole('button', { name: enMessages.agent.close })
    )

    await waitFor(() => expect(report()).not.toBeInTheDocument())
  })

  it('frames every node the turn added', async () => {
    const queue = [
      createMockLGraphNode({ pos: [100, 100], size: [50, 40], graph: null }),
      createMockLGraphNode({ pos: [400, 300], size: [50, 40], graph: null })
    ]
    vi.mocked(getNodeByLocatorId).mockImplementation(
      () => queue.shift() ?? null
    )
    const { panelEl, animateToBounds, canvas } = stubLayout()
    const { user } = renderBar({ panelEl })
    useCanvasStore().canvas = canvas
    await turnAdds(2)
    await screen.findByTestId('agent-graph-added-toast')

    await user.click(screen.getByRole('button', { name: VIEW_NODES }))

    // 40 graph units of padding around the union of (100,100) and (400,300).
    expect(animateToBounds).toHaveBeenCalledWith(
      [60, 60, 430, 320],
      expect.anything()
    )
  })

  it('centres the framing on the visible graph, not the whole canvas', async () => {
    vi.mocked(getNodeByLocatorId).mockReturnValue(
      createMockLGraphNode({ pos: [0, 0], size: [10, 10], graph: null })
    )
    // A 300px sidebar and a 40px topbar cover a canvas spanning the window.
    const { panelEl, animateToBounds, canvas } = stubLayout({
      panel: { left: 300, top: 40, width: 700, height: 500 }
    })
    const { user } = renderBar({ panelEl })
    useCanvasStore().canvas = canvas
    await turnAdds(1)
    await screen.findByTestId('agent-graph-added-toast')

    await user.click(screen.getByRole('button', { name: VIEW_NODE }))

    expect(animateToBounds).toHaveBeenCalledWith(expect.anything(), {
      viewport: [300, 40, 700, 500]
    })
  })

  it('keeps the framing clear of a side toolbar that overlays the panel', async () => {
    vi.mocked(getNodeByLocatorId).mockReturnValue(
      createMockLGraphNode({ pos: [0, 0], size: [10, 10], graph: null })
    )
    const { panelEl, animateToBounds, canvas } = stubLayout({
      panel: { left: 0, top: 0, width: 1000, height: 540 },
      sidebar: { left: 0, right: 64, width: 64 }
    })
    const { user } = renderBar({ panelEl })
    useCanvasStore().canvas = canvas
    await turnAdds(1)
    await screen.findByTestId('agent-graph-added-toast')

    await user.click(screen.getByRole('button', { name: VIEW_NODE }))

    expect(animateToBounds).toHaveBeenCalledWith(expect.anything(), {
      viewport: [64, 0, 936, 540]
    })
  })

  it('keeps the framing clear of the agent panel over the far edge', async () => {
    vi.mocked(getNodeByLocatorId).mockReturnValue(
      createMockLGraphNode({ pos: [0, 0], size: [10, 10], graph: null })
    )
    const { panelEl, animateToBounds, canvas } = stubLayout({
      panel: { left: 0, top: 0, width: 1000, height: 540 },
      sidebar: { left: 0, right: 64, width: 64 },
      agentPanel: { left: 700, right: 1000, width: 300 }
    })
    const { user } = renderBar({ panelEl })
    useCanvasStore().canvas = canvas
    await turnAdds(1)
    await screen.findByTestId('agent-graph-added-toast')

    await user.click(screen.getByRole('button', { name: VIEW_NODE }))

    expect(animateToBounds).toHaveBeenCalledWith(expect.anything(), {
      viewport: [64, 0, 636, 540]
    })
  })

  it('opens the minimap while nodes arrive and leaves it open', async () => {
    const settingStore = useSettingStore()
    settingStore.settingValues['Comfy.Minimap.Visible'] = false
    renderBar()

    await turnRuns(true)
    await agentAddsNodes()
    expect(settingStore.get('Comfy.Minimap.Visible')).toBe(true)

    await turnRuns(false)

    expect(settingStore.get('Comfy.Minimap.Visible')).toBe(true)
  })

  it('stays on the tab the nodes landed in', async () => {
    const workflowStore = useWorkflowStore()
    const tab = (path: string) => fromPartial<LoadedComfyWorkflow>({ path })
    workflowStore.activeWorkflow = tab('agent.json')
    renderBar()
    await turnAdds(2)
    await screen.findByTestId('agent-graph-added-toast')

    workflowStore.activeWorkflow = tab('other.json')

    await waitFor(() => expect(report()).not.toBeInTheDocument())

    workflowStore.activeWorkflow = tab('agent.json')

    await waitFor(() => expect(report()).toBeInTheDocument())
  })
})
