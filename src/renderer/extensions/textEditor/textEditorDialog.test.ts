import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { i18n } from '@/i18n'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { showTextEditor } from '@/renderer/extensions/textEditor/textEditorDialog'

const captureCanvasState = vi.fn()

function renderDialogHost() {
  return render(GlobalDialog, { global: { plugins: [i18n] } })
}

function openEditor(
  overrides: Partial<Parameters<typeof showTextEditor>[0]> = {}
) {
  const onEdit = vi.fn()
  const close = showTextEditor({
    text: 'a portrait',
    widgetLabel: 'text',
    nodeTitle: 'CLIP Text Encode',
    readOnly: false,
    onEdit,
    ...overrides
  })
  return { onEdit, close }
}

beforeEach(() => {
  useWorkflowStore().activeWorkflow = fromPartial({
    changeTracker: { captureCanvasState }
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
    const { onEdit } = openEditor({ text: '' })

    await user.type(await screen.findByRole('textbox'), ' {{red|blue} ')

    expect(onEdit).toHaveBeenCalledTimes(' {red|blue} '.length)
    expect(onEdit).toHaveBeenLastCalledWith(' {red|blue} ')
  })

  it('opens read-only with the text still selectable', async () => {
    const user = userEvent.setup()
    renderDialogHost()
    const { onEdit } = openEditor({ readOnly: true })

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

  it.for([
    { typed: 'x', captures: 1 },
    { typed: '', captures: 0 }
  ])(
    'records $captures undo steps when closed after typing "$typed"',
    async ({ typed, captures }) => {
      const user = userEvent.setup()
      renderDialogHost()
      openEditor()

      const editor = await screen.findByRole('textbox')
      if (typed) await user.type(editor, typed.repeat(3))
      await user.keyboard('{Escape}')

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(captureCanvasState).toHaveBeenCalledTimes(captures)
    }
  )

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
