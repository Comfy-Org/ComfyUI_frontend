import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import PromptPanel from '@/components/rightSidePanel/promptPanel/PromptPanel.vue'
import { i18n } from '@/i18n'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { usePromptPanelStore } from '@/stores/workspace/promptPanelStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'

const telemetry = vi.hoisted(() => ({
  trackPromptEditorOpened: vi.fn(),
  trackPromptEditorClosed: vi.fn()
}))

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => telemetry
}))

function addNode(
  graph: ReturnType<typeof createTestRootGraph>,
  title: string,
  prompt?: string
) {
  const node = new LGraphNode(title)
  node.title = title
  graph.add(node)
  const widget =
    prompt === undefined
      ? undefined
      : node.addWidget('textarea', 'text', prompt, () => {})
  return { node, widget }
}

function renderOpenPanel() {
  const graph = createTestRootGraph()
  const { node, widget } = addNode(graph, 'Positive', 'a portrait')
  if (!widget) throw new Error('The positive node has no prompt widget')
  const promptPanelStore = usePromptPanelStore()
  promptPanelStore.open({ node, widget })
  setCanvasSelection([node])
  render(PromptPanel, { global: { plugins: [i18n] } })
  return { graph, node, promptPanelStore }
}

beforeEach(() => {
  useWorkflowStore().activeWorkflow = fromPartial({
    changeTracker: { captureCanvasState: vi.fn() }
  })
})

describe('PromptPanel', () => {
  it('edits the prompt it opened on', () => {
    renderOpenPanel()

    expect(screen.getByText('text · Positive')).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'text' })).toHaveValue(
      'a portrait'
    )
  })

  it("follows the selection to another node's prompt", async () => {
    const { graph, promptPanelStore } = renderOpenPanel()
    const negative = addNode(graph, 'Negative', 'blurry')

    setCanvasSelection([negative.node])

    expect(await screen.findByText('text · Negative')).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'text' })).toHaveValue('blurry')
    expect(promptPanelStore.target?.node).toBe(negative.node)
  })

  it('keeps its prompt while the workspace hides the panel', async () => {
    const { graph, node, promptPanelStore } = renderOpenPanel()
    const negative = addNode(graph, 'Negative', 'blurry')
    promptPanelStore.isPanelHidden = true

    setCanvasSelection([negative.node])
    await nextTick()

    expect(promptPanelStore.target?.node).toBe(node)
  })

  it('follows a selection made while hidden once the panel shows again', async () => {
    const { graph, promptPanelStore } = renderOpenPanel()
    const negative = addNode(graph, 'Negative', 'blurry')
    promptPanelStore.isPanelHidden = true
    setCanvasSelection([negative.node])
    await nextTick()

    promptPanelStore.isPanelHidden = false

    expect(await screen.findByText('text · Negative')).toBeVisible()
    expect(promptPanelStore.target?.node).toBe(negative.node)
  })

  it('skips a prompt whose input is linked to another node', async () => {
    const { graph, promptPanelStore } = renderOpenPanel()
    const linked = addNode(graph, 'Linked', 'from upstream')
    linked.node.addInput('text', 'STRING', { widget: { name: 'text' } })
    const source = addNode(graph, 'Source')
    source.node.addOutput('STRING', 'STRING')
    source.node.connect(0, linked.node, 0)

    setCanvasSelection([linked.node])

    expect(await screen.findByText('Linked has no prompt.')).toBeVisible()
    expect(promptPanelStore.target?.node).not.toBe(linked.node)
  })

  it('returns to its prompt when the selection is cleared', async () => {
    const { graph } = renderOpenPanel()
    setCanvasSelection([addNode(graph, 'KSampler').node])
    await screen.findByText('KSampler has no prompt.')

    setCanvasSelection([])

    expect(await screen.findByText('text · Positive')).toBeVisible()
  })

  it('shows an empty state for a selected node without a prompt', async () => {
    const { graph, node, promptPanelStore } = renderOpenPanel()
    const sampler = addNode(graph, 'KSampler')

    setCanvasSelection([sampler.node])

    expect(await screen.findByText('KSampler has no prompt.')).toBeVisible()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(promptPanelStore.target?.node).toBe(node)
  })

  it('returns to the node settings from its header', async () => {
    const { promptPanelStore } = renderOpenPanel()
    useRightSidePanelStore().activeTab = 'errors'

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Node settings' })[0]
    )

    expect(promptPanelStore.isPromptViewShown).toBe(false)
    expect(promptPanelStore.isActive).toBe(true)
    expect(useRightSidePanelStore().activeTab).toBe('parameters')
  })

  it('opens the prompt in the full-screen focus view', async () => {
    render(GlobalDialog, { global: { plugins: [i18n] } })
    renderOpenPanel()

    await userEvent.click(
      screen.getByRole('button', { name: 'Expand to focus view' })
    )

    expect(
      await screen.findByRole('button', { name: 'Restore dialog' })
    ).toBeVisible()
    expect(telemetry.trackPromptEditorOpened).toHaveBeenLastCalledWith({
      surface: 'dialog',
      trigger: 'focus_view'
    })
  })

  it('closes the focus view when the panel moves to another prompt', async () => {
    render(GlobalDialog, { global: { plugins: [i18n] } })
    const { graph, promptPanelStore } = renderOpenPanel()
    await userEvent.click(
      screen.getByRole('button', { name: 'Expand to focus view' })
    )
    await screen.findByRole('button', { name: 'Restore dialog' })
    const negative = addNode(graph, 'Negative', 'blurry')
    if (!negative.widget) throw new Error('The negative node has no prompt')

    promptPanelStore.follow({ node: negative.node, widget: negative.widget })

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Restore dialog' })
      ).not.toBeInTheDocument()
    )
  })

  it('ends the session instead of writing from the focus view to a widget its node dropped', async () => {
    render(GlobalDialog, { global: { plugins: [i18n] } })
    const { node, promptPanelStore } = renderOpenPanel()
    const [widget] = node.widgets ?? []
    await userEvent.click(
      screen.getByRole('button', { name: 'Expand to focus view' })
    )
    const dialog = await screen.findByRole('dialog')
    node.widgets?.splice(0, 1)

    await userEvent.type(within(dialog).getByRole('textbox'), 'x')

    expect(widget.value).toBe('a portrait')
    expect(promptPanelStore.isActive).toBe(false)
  })

  it('opens a disabled prompt read-only in the focus view', async () => {
    render(GlobalDialog, { global: { plugins: [i18n] } })
    const { promptPanelStore } = renderOpenPanel()
    const target = promptPanelStore.target
    if (!target) throw new Error('The panel has no prompt')
    target.widget.disabled = true

    await userEvent.click(
      screen.getByRole('button', { name: 'Expand to focus view' })
    )

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('textbox')).toHaveAttribute('readonly')
  })

  it('ends the session when the panel is closed from its toggle', async () => {
    const { promptPanelStore } = renderOpenPanel()

    await userEvent.click(
      screen.getByRole('button', { name: 'Toggle properties panel' })
    )

    expect(useRightSidePanelStore().isOpen).toBe(false)
    await waitFor(() => expect(promptPanelStore.isActive).toBe(false))
  })
})
