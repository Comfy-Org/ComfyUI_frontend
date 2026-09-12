// @vitest-environment jsdom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { i18n } from '@/i18n'
import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import Composer from './Composer.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()

function renderComposer() {
  const store = useAgentComposerStore()
  const target = ref('target-A')
  const Host = defineComponent({
    setup: () => () =>
      h(Composer, {
        hasWorkflowTarget: true,
        editableWorkflowId: target.value
      })
  })
  render(Host, {
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  return { store, target, editor: screen.getByRole('textbox') }
}

describe('workflow reference clipboard', () => {
  beforeEach(() => vi.useRealTimers())

  it.for(['copy', 'cut'] as const)(
    'preserves newlines and indentation around workflow chips on %s and paste',
    async (operation) => {
      const user = userEvent.setup()
      const { store, editor } = renderComposer()
      const before = '\t Before\n  '
      const after = '\n\n after  '
      const reference = {
        id: 'workflow-B',
        name: 'Reference B',
        textOffset: before.length
      }
      store.replaceDraft({
        text: before + after,
        workflowReferences: [reference],
        attachments: []
      })
      await screen.findByTestId('workflow-reference-chip')
      await user.click(editor)
      await user.keyboard('{Control>}a{/Control}')
      const clipboard = await user[operation]()
      expect(clipboard?.getData('text/plain')).toBe(
        `${before}@[Workflow: Reference B]${after}`
      )
      if (operation === 'copy') await user.keyboard('{Backspace}')
      await user.paste(clipboard)
      expect(store.draft).toBe(before + after)
      expect(store.workflowReferences).toEqual([reference])
      expect(editor.textContent).toBe(`${before}Reference B${after}`)
    }
  )

  it('cuts and pastes workflow chips at the caret with their text, metadata and Undo history', async () => {
    const user = userEvent.setup()
    const { store, editor } = renderComposer()
    store.replaceDraft({
      text: 'Before  between  after',
      workflowReferences: [
        { id: 'workflow-B', name: '参考 🐈', textOffset: 7 },
        { id: 'workflow-C', name: 'Missing', textOffset: 16, unavailable: true }
      ],
      attachments: []
    })
    await waitFor(() =>
      expect(editor).toHaveTextContent('Before 参考 🐈 between Missing after')
    )
    await user.click(editor)
    await user.keyboard('{Control>}a{/Control}')
    const clipboard = await user.cut()
    expect(clipboard?.getData('text/plain')).toBe(
      'Before @[Workflow: 参考 🐈] between @[Workflow: Missing] after'
    )
    expect(editor.textContent).toBe('')
    expect(store.workflowReferences).toEqual([])

    await user.type(editor, 'New: ')
    await user.paste(clipboard)
    expect(editor.textContent).toBe('New: Before 参考 🐈 between Missing after')
    expect(store.workflowReferences).toEqual([
      { id: 'workflow-B', name: '参考 🐈', textOffset: 12 },
      { id: 'workflow-C', name: 'Missing', textOffset: 21, unavailable: true }
    ])
    await user.keyboard('{Control>}z{/Control}')
    expect(editor.textContent).toBe('New: ')
    expect(store.workflowReferences).toEqual([])
    await user.keyboard('{Control>}y{/Control}')
    expect(store.workflowReferences).toHaveLength(2)
    expect(editor.textContent).toBe('New: Before 参考 🐈 between Missing after')
  })

  it('does not infer workflow identity from plain text', async () => {
    const user = userEvent.setup()
    const { store, editor } = renderComposer()
    await user.click(editor)
    await user.paste('Use @[Workflow: Reference B]')
    expect(editor.textContent).toBe('Use @[Workflow: Reference B]')
    expect(store.workflowReferences).toEqual([])
  })

  it('honors paste as plain text when the clipboard contains a workflow chip', async () => {
    const user = userEvent.setup()
    const { store, editor } = renderComposer()
    store.replaceDraft({
      text: 'Use ',
      workflowReferences: [
        { id: 'workflow-B', name: 'Reference B', textOffset: 4 }
      ],
      attachments: []
    })
    await screen.findByTestId('workflow-reference-chip')
    await user.click(editor)
    await user.keyboard('{Control>}a{/Control}')
    const clipboard = await user.cut()
    await user.keyboard('{Shift>}')
    await user.paste(clipboard)
    await user.keyboard('{/Shift}')
    expect(editor.textContent).toBe('Use @[Workflow: Reference B]')
    expect(store.workflowReferences).toEqual([])
  })

  it('cuts only a selected workflow chip and restores it between untouched text', async () => {
    const user = userEvent.setup()
    const { store, editor } = renderComposer()
    store.replaceDraft({
      text: 'Left  right',
      workflowReferences: [
        { id: 'workflow-B', name: 'Reference B', textOffset: 5 }
      ],
      attachments: []
    })
    const chip = await screen.findByTestId('workflow-reference-chip')
    await user.click(editor)
    const selection = document.createRange()
    selection.selectNode(chip)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(selection)
    document.dispatchEvent(new Event('selectionchange'))
    const clipboard = await user.cut()
    expect(editor.textContent).toBe('Left  right')
    expect(store.workflowReferences).toEqual([])
    await user.paste(clipboard)
    expect(editor.textContent).toBe('Left Reference B right')
    expect(store.workflowReferences).toEqual([
      { id: 'workflow-B', name: 'Reference B', textOffset: 5 }
    ])
  })

  it('pastes a reference to the new target as readable text without changing that target', async () => {
    const user = userEvent.setup()
    const { store, target, editor } = renderComposer()
    store.replaceDraft({
      text: 'Use ',
      workflowReferences: [
        { id: 'workflow-B', name: 'Reference B', textOffset: 4 }
      ],
      attachments: []
    })
    await screen.findByTestId('workflow-reference-chip')
    await user.click(editor)
    await user.keyboard('{Control>}a{/Control}')
    const clipboard = await user.copy()
    clipboard?.setData(
      'text/html',
      clipboard
        .getData('text/html')
        .replace(
          'data-workflow-id="workflow-B"',
          'data-workflow-id=" workflow-B "'
        )
    )
    target.value = 'workflow-B'
    store.replaceDraft({ text: '', workflowReferences: [], attachments: [] })
    await waitFor(() => expect(editor.textContent).toBe(''))
    await user.click(editor)
    await user.paste(clipboard)
    expect(editor.textContent).toBe('Use @[Workflow: Reference B]')
    expect(store.workflowReferences).toEqual([])
    expect(target.value).toBe('workflow-B')
  })

  it('keeps existing references unique while preserving the pasted label', async () => {
    const user = userEvent.setup()
    const { store, editor } = renderComposer()
    store.replaceDraft({
      text: 'Use ',
      workflowReferences: [
        { id: 'workflow-B', name: 'Reference B', textOffset: 4 }
      ],
      attachments: []
    })
    await screen.findByTestId('workflow-reference-chip')
    await user.click(editor)
    await user.keyboard('{Control>}a{/Control}')
    const clipboard = await user.copy()
    clipboard?.setData(
      'text/html',
      clipboard
        .getData('text/html')
        .replace(
          'data-workflow-id="workflow-B"',
          'data-workflow-id=" workflow-B "'
        )
    )
    const caret = document.createRange()
    caret.selectNodeContents(editor)
    caret.collapse(false)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(caret)
    document.dispatchEvent(new Event('selectionchange'))
    await user.paste(clipboard)
    expect(editor.textContent).toBe(
      'Use Reference BUse @[Workflow: Reference B]'
    )
    expect(store.workflowReferences).toEqual([
      { id: 'workflow-B', name: 'Reference B', textOffset: 4 }
    ])
    await user.keyboard('{Control>}a{/Control}')
    await user.paste(clipboard)
    expect(editor.textContent).toBe('Use Reference B')
    expect(store.workflowReferences).toEqual([
      { id: 'workflow-B', name: 'Reference B', textOffset: 4 }
    ])
  })

  it.for([
    '<span data-workflow-id="workflow-B">Reference B</span>',
    '<span data-comfy-workflow="2" data-workflow-id="workflow-B">Reference B</span>',
    '<span data-comfy-workflow="1" data-workflow-id="">Reference B</span>'
  ])(
    'uses plain text for unrecognized or malformed clipboard HTML: %s',
    async (html) => {
      const user = userEvent.setup()
      const { store, editor } = renderComposer()
      await user.type(editor, 'Readable fallback')
      await user.keyboard('{Control>}a{/Control}')
      const clipboard = await user.copy()
      clipboard?.setData('text/html', html)
      await user.paste(clipboard)
      expect(editor.textContent).toBe('Readable fallback')
      expect(store.workflowReferences).toEqual([])
    }
  )
})
