import { fromPartial } from '@total-typescript/shoehorn'
import { createEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { i18n } from '@/i18n'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { showTextEditor } from '@/renderer/extensions/textEditor/textEditorDialog'

const captureCanvasState = vi.fn()
const markModified = vi.fn()
const updateModified = vi.fn()

function renderDialogHost() {
  return render(GlobalDialog, { global: { plugins: [i18n] } })
}

function openEditor(
  overrides: Partial<Parameters<typeof showTextEditor>[0]> = {}
) {
  const onEdit = vi.fn()
  const close = showTextEditor({
    readText: () => 'a portrait',
    widgetLabel: 'text',
    nodeTitle: 'CLIP Text Encode',
    readOnly: () => false,
    onEdit,
    ...overrides
  })
  return { onEdit, close }
}

beforeEach(() => {
  useWorkflowStore().activeWorkflow = fromPartial({
    changeTracker: { captureCanvasState, markModified, updateModified }
  })
})

describe('showTextEditor', () => {
  it.for([
    { nodeTitle: 'CLIP Text Encode', title: 'text · CLIP Text Encode' },
    { nodeTitle: undefined, title: 'text' }
  ])('titles the dialog "$title"', async ({ nodeTitle, title }) => {
    renderDialogHost()
    openEditor({ nodeTitle })

    expect(await screen.findByRole('dialog', { name: title })).toBeVisible()
  })

  it('focuses the editor with the caret at the start of the text', async () => {
    renderDialogHost()
    openEditor()

    const editor = await screen.findByRole<HTMLTextAreaElement>('textbox')
    await waitFor(() => expect(editor).toHaveFocus())
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([0, 0])
  })

  it('passes every keystroke to onEdit exactly as typed', async () => {
    const user = userEvent.setup()
    renderDialogHost()
    const { onEdit } = openEditor({ readText: () => '' })

    await user.type(await screen.findByRole('textbox'), ' {{red|blue} ')

    expect(onEdit).toHaveBeenCalledTimes(' {red|blue} '.length)
    expect(onEdit).toHaveBeenLastCalledWith(' {red|blue} ')
  })

  it('opens read-only with the text still selectable', async () => {
    const user = userEvent.setup()
    renderDialogHost()
    const { onEdit } = openEditor({ readOnly: () => true })

    const editor = await screen.findByRole<HTMLTextAreaElement>('textbox')
    await user.type(editor, 'more')
    editor.select()

    expect(editor).toHaveAttribute('readonly')
    expect(editor).toHaveValue('a portrait')
    expect(editor.selectionEnd - editor.selectionStart).toBe(
      'a portrait'.length
    )
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('records one undo step when closed after typing', async () => {
    const user = userEvent.setup()
    renderDialogHost()
    openEditor()

    await user.type(await screen.findByRole('textbox'), 'xxx')
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(captureCanvasState).toHaveBeenCalledOnce()
    expect(updateModified).toHaveBeenCalledOnce()
  })

  it('marks the workflow modified while typing without recording undo history', async () => {
    const user = userEvent.setup()
    renderDialogHost()
    openEditor()

    await user.type(await screen.findByRole('textbox'), 'xxx')

    expect(markModified).toHaveBeenCalledTimes(3)
    expect(captureCanvasState).not.toHaveBeenCalled()
  })

  it('records no undo step when closed without typing', async () => {
    const user = userEvent.setup()
    renderDialogHost()
    openEditor()

    await screen.findByRole('textbox')
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(captureCanvasState).not.toHaveBeenCalled()
  })

  it('locks the editor when the widget becomes read-only while it is open', async () => {
    const readOnly = ref(false)
    renderDialogHost()
    openEditor({ readOnly: () => readOnly.value })
    const editor = await screen.findByRole('textbox')

    readOnly.value = true

    await waitFor(() => expect(editor).toHaveAttribute('readonly'))
  })

  it('keeps the selection and its direction when the text changes elsewhere', async () => {
    const source = ref('a portrait at dusk')
    renderDialogHost()
    openEditor({ readText: () => source.value })
    const editor = await screen.findByRole<HTMLTextAreaElement>('textbox')
    editor.setSelectionRange(2, 10, 'backward')

    source.value = 'a portrait at dawn'

    await waitFor(() => expect(editor).toHaveValue('a portrait at dawn'))
    expect([
      editor.selectionStart,
      editor.selectionEnd,
      editor.selectionDirection
    ]).toEqual([2, 10, 'backward'])
  })

  it('collapses the selection when the text before its end changes elsewhere', async () => {
    const source = ref('a portrait at dusk')
    renderDialogHost()
    openEditor({ readText: () => source.value })
    const editor = await screen.findByRole<HTMLTextAreaElement>('textbox')
    editor.setSelectionRange(2, 10)

    source.value = 'a landscape at dusk'

    await waitFor(() => expect(editor).toHaveValue('a landscape at dusk'))
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 2])
  })

  it.for([
    { browser: 'Chromium and Firefox', event: { isComposing: true } },
    { browser: 'Safari', event: { keyCode: 229 } }
  ])(
    'stays open when Escape cancels an IME composition in $browser',
    async ({ event }) => {
      renderDialogHost()
      openEditor()
      const editor = await screen.findByRole('textbox')

      editor.dispatchEvent(
        createEvent.keyDown(editor, { key: 'Escape', ...event })
      )
      await nextTick()

      expect(screen.getByRole('dialog')).toBeVisible()
    }
  )

  it('keeps the text and caret of an IME composition when the text changes elsewhere', async () => {
    const source = ref('a portrait')
    renderDialogHost()
    const { onEdit } = openEditor({ readText: () => source.value })
    const editor = await screen.findByRole<HTMLTextAreaElement>('textbox')
    const composed = 'a portrait仮'

    editor.dispatchEvent(createEvent.compositionStart(editor))
    editor.value = composed
    source.value = 'a cat'
    await nextTick()
    await nextTick()
    const caret = editor.selectionStart
    editor.dispatchEvent(createEvent.compositionEnd(editor))

    expect(caret).toBe(composed.length)
    expect(onEdit).toHaveBeenLastCalledWith(composed)
  })

  it('keeps the textarea attributes in step with the widget while it is open', async () => {
    const maxlength = ref(12)
    renderDialogHost()
    openEditor({
      textareaAttributes: () => ({
        maxlength: maxlength.value,
        placeholder: 'Describe the scene'
      })
    })
    const editor = await screen.findByRole('textbox')
    expect(editor).toHaveAttribute('placeholder', 'Describe the scene')

    maxlength.value = 4

    await waitFor(() => expect(editor).toHaveAttribute('maxlength', '4'))
  })

  it('closes the dialog it opened, and not one opened after it', async () => {
    renderDialogHost()
    const first = openEditor({ widgetLabel: 'first', nodeTitle: undefined })
    first.close()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    openEditor({ widgetLabel: 'second', nodeTitle: undefined })
    first.close()

    expect(await screen.findByRole('dialog', { name: 'second' })).toBeVisible()
  })
})
