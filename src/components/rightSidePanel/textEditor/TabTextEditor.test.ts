import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import TabTextEditor from '@/components/rightSidePanel/textEditor/TabTextEditor.vue'
import { i18n } from '@/i18n'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'

const captureCanvasState = vi.fn()
const focusNodeInstance = vi.hoisted(() => vi.fn())

vi.mock(import('@/composables/canvas/useFocusNode'), () => ({
  useFocusNode: () => ({ focusNode: vi.fn(), focusNodeInstance })
}))

function createTarget(options: Record<string, unknown> = {}) {
  const graph = createTestRootGraph()
  const node = new LGraphNode('CLIP Text Encode')
  node.title = 'CLIP Text Encode'
  graph.add(node)
  const widget = node.addWidget('text', 'text', 'a portrait', () => {}, options)
  return { node, widget }
}

function renderEditor(options: Record<string, unknown> = {}) {
  const target = createTarget(options)
  render(TabTextEditor, {
    props: { target },
    global: { plugins: [i18n] }
  })
  return target
}

async function openTabAfterRender() {
  const target = createTarget()
  const isTabActive = ref(false)
  render(
    defineComponent(
      () => () => (isTabActive.value ? h(TabTextEditor, { target }) : null)
    ),
    { global: { plugins: [i18n] } }
  )
  isTabActive.value = true
  await nextTick()
  return target
}

beforeEach(() => {
  useWorkflowStore().activeWorkflow = fromPartial({
    changeTracker: { captureCanvasState }
  })
})

describe('TabTextEditor', () => {
  it('names the widget and its node and focuses the editor at the start', async () => {
    await openTabAfterRender()

    const editor = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'text'
    })
    expect(screen.getByText('· CLIP Text Encode')).toBeVisible()
    await waitFor(() => expect(editor).toHaveFocus())
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([0, 0])
  })

  it('writes each keystroke to the widget, exactly as typed', async () => {
    const { widget } = renderEditor()

    const editor = screen.getByRole('textbox', { name: 'text' })
    await userEvent.type(editor, ' {{red|blue} ', {
      initialSelectionStart: 'a portrait'.length
    })

    expect(widget.value).toBe('a portrait {red|blue} ')
  })

  it('shows edits made to the widget elsewhere', async () => {
    const { widget } = renderEditor()

    widget.value = 'a landscape'

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'text' })).toHaveValue(
        'a landscape'
      )
    )
  })

  it('opens a read-only widget without writing to it', async () => {
    const { widget } = renderEditor({ read_only: true })

    const editor = screen.getByRole('textbox', { name: 'text' })
    await userEvent.type(editor, 'more')

    expect(editor).toHaveAttribute('readonly')
    expect(widget.value).toBe('a portrait')
  })

  it.for([
    { typed: 'x', captures: 1 },
    { typed: '', captures: 0 }
  ])(
    'records $captures undo steps when focus leaves after typing "$typed"',
    async ({ typed, captures }) => {
      const user = userEvent.setup()
      renderEditor()

      const editor = screen.getByRole('textbox', { name: 'text' })
      await user.click(editor)
      if (typed) await user.keyboard(typed)
      expect(useRightSidePanelStore().isTextEditorFocused).toBe(true)
      await user.click(document.body)

      expect(useRightSidePanelStore().isTextEditorFocused).toBe(false)
      expect(captureCanvasState).toHaveBeenCalledTimes(captures)
    }
  )

  it.for([
    { selected: true, shown: false },
    { selected: false, shown: true }
  ])(
    'offers "Show node" when its node is selected: $selected',
    async ({ selected, shown }) => {
      const graph = createTestRootGraph()
      const other = new LGraphNode('KSampler')
      graph.add(other)
      const { node } = renderEditor()
      setCanvasSelection([selected ? node : other])

      await waitFor(() =>
        expect(
          Boolean(screen.queryByRole('button', { name: 'Show node' }))
        ).toBe(shown)
      )
    }
  )

  it('pans to its node from "Show node"', async () => {
    const { node } = renderEditor()
    setCanvasSelection([])

    await userEvent.click(
      await screen.findByRole('button', { name: 'Show node' })
    )

    expect(focusNodeInstance).toHaveBeenCalledWith(node)
  })

  it('closes the Text tab from its close button', async () => {
    const { node, widget } = renderEditor()
    const rightSidePanelStore = useRightSidePanelStore()
    rightSidePanelStore.openTextEditor({ node, widget })

    await userEvent.click(screen.getByRole('button', { name: 'Close editor' }))

    expect(rightSidePanelStore.textEditorTarget).toBeNull()
  })
})
