import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import PromptEditor from '@/components/rightSidePanel/promptPanel/PromptEditor.vue'
import { i18n } from '@/i18n'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { usePromptPanelStore } from '@/stores/workspace/promptPanelStore'

const captureCanvasState = vi.fn()

function createTarget(options: Record<string, unknown> = {}) {
  const graph = createTestRootGraph()
  const node = new LGraphNode('CLIP Text Encode')
  node.title = 'CLIP Text Encode'
  graph.add(node)
  const widget = node.addWidget(
    'textarea',
    'text',
    'a portrait',
    () => {},
    options
  )
  return { node, widget }
}

function renderEditor(options: Record<string, unknown> = {}) {
  const target = createTarget(options)
  render(PromptEditor, {
    props: { target },
    global: { plugins: [i18n] }
  })
  return target
}

async function mountEditorAfterRender(options: Record<string, unknown> = {}) {
  const target = createTarget(options)
  const isShown = ref(false)
  render(
    defineComponent(
      () => () => (isShown.value ? h(PromptEditor, { target }) : null)
    ),
    { global: { plugins: [i18n] } }
  )
  isShown.value = true
  await nextTick()
  return isShown
}

beforeEach(() => {
  useWorkflowStore().activeWorkflow = fromPartial({
    changeTracker: { captureCanvasState }
  })
})

describe('PromptEditor', () => {
  it('names the widget and its node', () => {
    renderEditor()

    expect(screen.getByText('text · CLIP Text Encode')).toBeVisible()
  })

  it('focuses the editor at the start when it opens from Expand', async () => {
    usePromptPanelStore().autofocus = true
    await mountEditorAfterRender()

    const editor = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'text'
    })
    await waitFor(() => expect(editor).toHaveFocus())
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([0, 0])
  })

  it('does not take focus again when it remounts later in the session', async () => {
    usePromptPanelStore().autofocus = true
    const isShown = await mountEditorAfterRender()
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'text' })).toHaveFocus()
    )

    isShown.value = false
    await nextTick()
    isShown.value = true
    await nextTick()

    expect(screen.getByRole('textbox', { name: 'text' })).not.toHaveFocus()
  })

  it('takes focus when Expand reopens the prompt it already shows', async () => {
    const promptPanelStore = usePromptPanelStore()
    promptPanelStore.autofocus = false
    await mountEditorAfterRender()
    const editor = screen.getByRole('textbox', { name: 'text' })

    promptPanelStore.autofocus = true

    await waitFor(() => expect(editor).toHaveFocus())
    expect(promptPanelStore.autofocus).toBe(false)
  })

  it('leaves focus on the canvas when it follows the selection', async () => {
    usePromptPanelStore().autofocus = false
    await mountEditorAfterRender()

    expect(screen.getByRole('textbox', { name: 'text' })).not.toHaveFocus()
  })

  it('ends the session instead of writing to a widget its node dropped', async () => {
    const promptPanelStore = usePromptPanelStore()
    const { node, widget } = renderEditor()
    promptPanelStore.open({ node, widget })
    node.widgets?.splice(node.widgets.indexOf(widget), 1)

    await userEvent.type(screen.getByRole('textbox', { name: 'text' }), 'x')

    expect(widget.value).toBe('a portrait')
    expect(promptPanelStore.isActive).toBe(false)
  })

  it('leaves focus on the canvas when Expand opens a read-only prompt', async () => {
    const promptPanelStore = usePromptPanelStore()
    promptPanelStore.autofocus = true
    await mountEditorAfterRender({ read_only: true })

    expect(screen.getByRole('textbox', { name: 'text' })).not.toHaveFocus()
    expect(promptPanelStore.autofocus).toBe(false)
  })

  it('writes each keystroke to the widget and counts it', async () => {
    const promptPanelStore = usePromptPanelStore()
    const recordInput = vi.spyOn(promptPanelStore, 'recordInput')
    const { widget } = renderEditor()

    await userEvent.type(
      screen.getByRole('textbox', { name: 'text' }),
      ' at dusk',
      {
        initialSelectionStart: 'a portrait'.length
      }
    )

    expect(widget.value).toBe('a portrait at dusk')
    expect(recordInput).toHaveBeenCalledTimes(' at dusk'.length)
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

  it.for(['disabled', 'computedDisabled'] as const)(
    'opens a widget with %s set read-only',
    (flag) => {
      const target = createTarget()
      target.widget[flag] = true
      render(PromptEditor, { props: { target }, global: { plugins: [i18n] } })

      expect(screen.getByRole('textbox', { name: 'text' })).toHaveAttribute(
        'readonly'
      )
    }
  )

  it.for([
    { typed: 'x', captures: 1 },
    { typed: '', captures: 0 }
  ])(
    'records $captures undo steps when focus leaves after typing "$typed"',
    async ({ typed, captures }) => {
      const user = userEvent.setup()
      renderEditor()
      const promptPanelStore = usePromptPanelStore()

      await user.click(screen.getByRole('textbox', { name: 'text' }))
      if (typed) await user.keyboard(typed)
      expect(promptPanelStore.isEditorFocused).toBe(true)
      await user.click(document.body)

      expect(promptPanelStore.isEditorFocused).toBe(false)
      expect(captureCanvasState).toHaveBeenCalledTimes(captures)
    }
  )
})
