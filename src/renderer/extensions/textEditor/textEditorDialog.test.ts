import { fromPartial } from '@total-typescript/shoehorn'
import { createEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { nextTick, ref } from 'vue'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { i18n } from '@/i18n'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { showTextEditor } from '@/renderer/extensions/textEditor/textEditorDialog'
import { usePromptTagCatalogStore } from '@/renderer/extensions/textEditor/promptTagCatalogStore'
import type { ComfyExtension } from '@/types/comfy'

const widgetAugmentations = {
  name: 'test.WidgetAugmentations',
  widgetAugmentations: [
    {
      id: 'studio-tags',
      kind: 'text-completion',
      target: {
        nodeType: 'DevToolsNodeWithAugmentedTextarea',
        widgetName: 'prompt'
      },
      suggest: (query: string) =>
        ['studio lighting', 'studio portrait'].filter((tag) =>
          tag.includes(query)
        )
    }
  ]
} satisfies ComfyExtension

const captureCanvasState = vi.fn()
const markModified = vi.fn()
const updateModified = vi.fn()

vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

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

  it('imports a catalog and navigates suggestions without moving focus before dismissing them', async () => {
    const user = userEvent.setup()
    const source = ref('')
    renderDialogHost()
    openEditor({
      readText: () => source.value,
      onEdit: (value) => (source.value = value)
    })
    const editor = await screen.findByRole('textbox')

    expect(screen.queryByRole('listbox')).toBeNull()
    await user.upload(
      screen.getByLabelText('Import prompt tags'),
      new File(['cinematic_lighting,20\nsoft_lighting,10'], 'tags.csv', {
        type: 'text/csv'
      })
    )
    expect(
      await screen.findByText('2 tags loaded for this session')
    ).toBeVisible()
    await user.type(editor, 'a portrait, light')

    expect(
      await screen.findByRole('listbox', { name: 'Prompt suggestions' })
    ).toBeVisible()
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
      'cinematic lighting'
    )
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
      'soft lighting'
    )
    expect(editor).toHaveFocus()
    expect(editor).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { selected: true }).id
    )

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(editor).toHaveValue('a portrait, light')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it.for([
    {
      nodeType: 'DevToolsNodeWithAugmentedTextarea',
      widgetName: 'prompt',
      expected: ['studio lighting', 'studio portrait']
    },
    {
      nodeType: 'DevToolsNodeWithAugmentedTextarea',
      widgetName: 'notes',
      expected: []
    },
    { nodeType: 'OtherNode', widgetName: 'prompt', expected: [] }
  ])(
    'scopes extension completion to $nodeType.$widgetName',
    async ({ nodeType, widgetName, expected }) => {
      const user = userEvent.setup()
      const source = ref('')
      useExtensionStore().registerExtension(widgetAugmentations)
      renderDialogHost()
      openEditor({
        readText: () => source.value,
        onEdit: (value) => (source.value = value),
        augmentationTarget: { nodeType, widgetName }
      })
      const editor = await screen.findByRole('textbox')
      await user.type(editor, 'studio')

      expect(
        screen.queryAllByRole('option').map((item) => item.textContent.trim())
      ).toEqual(expected)
      expect(editor).toHaveValue('studio')
      expect(editor).toHaveFocus()
    }
  )

  it('removes extension suggestions when the extension unregisters without disabling the imported catalog', async () => {
    const user = userEvent.setup()
    const source = ref('')
    const extensions = useExtensionStore()
    extensions.registerExtension(widgetAugmentations)
    usePromptTagCatalogStore().importCatalog('studio_backdrop')
    renderDialogHost()
    openEditor({
      readText: () => source.value,
      onEdit: (value) => (source.value = value),
      augmentationTarget: {
        nodeType: 'DevToolsNodeWithAugmentedTextarea',
        widgetName: 'prompt'
      }
    })
    const editor = await screen.findByRole('textbox')
    await user.type(editor, 'studio')
    expect(
      await screen.findByRole('option', { name: 'studio lighting' })
    ).toBeVisible()
    expect(
      screen.getByRole('option', { name: 'studio backdrop' })
    ).toBeVisible()

    extensions.unregisterExtension(widgetAugmentations.name)
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    await user.type(editor, ' ')

    expect(
      await screen.findByRole('option', { name: 'studio backdrop' })
    ).toBeVisible()
    expect(screen.queryByRole('option', { name: 'studio lighting' })).toBeNull()
  })

  it('isolates a failed extension provider while retaining catalog suggestions', async () => {
    const user = userEvent.setup()
    const source = ref('')
    const failure = new Error('Provider unavailable')
    useExtensionStore().registerExtension({
      name: 'test.failingCompletion',
      widgetAugmentations: [
        {
          id: 'failing-tags',
          kind: 'text-completion',
          target: { nodeType: 'TestNode', widgetName: 'prompt' },
          suggest() {
            throw failure
          }
        }
      ]
    })
    usePromptTagCatalogStore().importCatalog('studio_backdrop')
    renderDialogHost()
    openEditor({
      readText: () => source.value,
      onEdit: (value) => (source.value = value),
      augmentationTarget: { nodeType: 'TestNode', widgetName: 'prompt' }
    })
    const editor = await screen.findByRole('textbox')
    await user.type(editor, 'studio')

    expect(
      await screen.findByRole('option', { name: 'studio backdrop' })
    ).toBeVisible()
    expect(editor).toHaveValue('studio')
    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
      errorType: 'error_evaluating_widget_augmentation',
      surface: 'platform',
      context: {
        extension: 'test.failingCompletion',
        augmentation: 'failing-tags'
      }
    })
  })

  it('updates a widget hint from live text and removes it when its extension is disabled', async () => {
    const user = userEvent.setup()
    const source = ref('blue')
    const extensions = useExtensionStore()
    extensions.captureCoreExtensions()
    extensions.registerExtension({
      name: 'test.hint',
      widgetAugmentations: [
        {
          id: 'length',
          kind: 'hint',
          target: { nodeType: 'TestNode', widgetName: 'prompt' },
          text: (value) => `Length: ${value.length}`
        }
      ]
    })
    renderDialogHost()
    openEditor({
      readText: () => source.value,
      onEdit: (value) => (source.value = value),
      augmentationTarget: { nodeType: 'TestNode', widgetName: 'prompt' }
    })
    const editor = await screen.findByRole('textbox')
    expect(await screen.findByText('Length: 4')).toBeVisible()
    await user.clear(editor)
    await user.type(editor, 'blue sky')
    expect(await screen.findByText('Length: 8')).toBeVisible()

    extensions.loadDisabledExtensionNames(['test.hint'])

    await waitFor(() => expect(screen.queryByText('Length: 8')).toBeNull())
    expect(editor).toHaveValue('blue sky')
  })

  it('applies a text action through live editing and locks it when read-only', async () => {
    const insertText: Document['execCommand'] = (_command, _showUI, text) => {
      editor.setRangeText(text ?? '')
      editor.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: insertText
    })
    onTestFinished(() => {
      Reflect.deleteProperty(document, 'execCommand')
    })
    const user = userEvent.setup()
    const source = ref('blue_eyes, soft_focus')
    const readOnly = ref(false)
    useExtensionStore().registerExtension({
      name: 'test.action',
      widgetAugmentations: [
        {
          id: 'normalize',
          kind: 'text-action',
          target: { nodeType: 'TestNode', widgetName: 'prompt' },
          label: 'Normalize tags',
          transform: (value) => value.replaceAll('_', ' ')
        }
      ]
    })
    renderDialogHost()
    openEditor({
      readText: () => source.value,
      readOnly: () => readOnly.value,
      onEdit: (value) => (source.value = value),
      augmentationTarget: { nodeType: 'TestNode', widgetName: 'prompt' }
    })
    const editor = await screen.findByRole<HTMLTextAreaElement>('textbox')
    await user.click(screen.getByRole('button', { name: 'Normalize tags' }))

    expect(source.value).toBe('blue eyes, soft focus')
    expect(editor).toHaveValue('blue eyes, soft focus')
    expect(editor).toHaveFocus()
    expect(markModified).toHaveBeenCalledOnce()
    readOnly.value = true
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Normalize tags' })
      ).toBeDisabled()
    )
  })

  it.for([
    {
      maxlength: 5,
      message:
        'This action exceeds the text limit. Shorten the text and try again.'
    },
    {
      maxlength: 100,
      message:
        'This action could not edit the text. Your text is unchanged. Edit it manually instead.'
    }
  ])(
    'explains a refused text action with maxlength $maxlength',
    async ({ maxlength, message }) => {
      const user = userEvent.setup()
      useExtensionStore().registerExtension({
        name: 'test.expandingAction',
        widgetAugmentations: [
          {
            id: 'expand',
            kind: 'text-action',
            target: { nodeType: 'TestNode', widgetName: 'prompt' },
            label: 'Expand tag',
            transform: () => 'blue eyes'
          }
        ]
      })
      renderDialogHost()
      const { onEdit } = openEditor({
        readText: () => 'blue',
        textareaAttributes: () => ({ maxlength }),
        augmentationTarget: { nodeType: 'TestNode', widgetName: 'prompt' }
      })
      const editor = await screen.findByRole('textbox')

      await user.click(screen.getByRole('button', { name: 'Expand tag' }))

      expect(editor).toHaveValue('blue')
      expect(onEdit).not.toHaveBeenCalled()
      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({
          kind: 'warning',
          title: message
        })
      )
    }
  )

  it('discards an unfinished catalog import when another editor opens', async () => {
    const user = userEvent.setup()
    let finish: ((text: string) => void) | undefined
    const pending = new Promise<string>((resolve) => (finish = resolve))
    const file = new File(['blue_eyes'], 'old.txt', { type: 'text/plain' })
    vi.spyOn(file, 'text').mockReturnValue(pending)
    renderDialogHost()
    const { close } = openEditor()
    await screen.findByRole('textbox')
    await user.upload(screen.getByLabelText('Import prompt tags'), file)
    close()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    openEditor()
    const editor = await screen.findByRole('textbox')
    await user.upload(
      screen.getByLabelText('Import prompt tags'),
      new File(['red_hair'], 'new.txt', { type: 'text/plain' })
    )
    expect(
      await screen.findByText('1 tag loaded for this session')
    ).toBeVisible()

    assert.exists(finish)
    finish('blue_eyes')
    await pending
    await nextTick()

    expect(usePromptTagCatalogStore().tags).toEqual(['red hair'])
    expect(editor).toHaveFocus()
  })

  it('reports an invalid import without losing the loaded catalog', async () => {
    const user = userEvent.setup()
    usePromptTagCatalogStore().importCatalog('blue_eyes')
    renderDialogHost()
    openEditor()
    await screen.findByRole('textbox')

    await user.upload(
      screen.getByLabelText('Import prompt tags'),
      new File(['blue_hair,not-a-count'], 'invalid.csv', { type: 'text/csv' })
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your previous catalog is unchanged.'
    )
    expect(screen.getByText('1 tag loaded for this session')).toBeVisible()
  })

  it('removes suggestions when the editor becomes read-only', async () => {
    const user = userEvent.setup()
    const source = ref('')
    const readOnly = ref(false)
    usePromptTagCatalogStore().importCatalog('cinematic_lighting')
    renderDialogHost()
    openEditor({
      readText: () => source.value,
      onEdit: (value) => (source.value = value),
      readOnly: () => readOnly.value
    })
    const editor = await screen.findByRole('textbox')
    await user.type(editor, 'cin')
    expect(await screen.findByRole('listbox')).toBeVisible()

    readOnly.value = true

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(editor).toHaveValue('cin')
  })

  it('suspends suggestions during composition and resumes after committed input', async () => {
    const user = userEvent.setup()
    const source = ref('')
    usePromptTagCatalogStore().importCatalog('cinematic_lighting')
    renderDialogHost()
    openEditor({
      readText: () => source.value,
      onEdit: (value) => (source.value = value)
    })
    const editor = await screen.findByRole('textbox')
    await user.type(editor, 'cin')
    expect(await screen.findByRole('listbox')).toBeVisible()

    editor.dispatchEvent(createEvent.compositionStart(editor))
    await nextTick()
    expect(screen.queryByRole('listbox')).toBeNull()
    editor.dispatchEvent(
      createEvent.keyDown(editor, { key: 'Enter', isComposing: true })
    )
    expect(editor).toHaveValue('cin')
    editor.dispatchEvent(createEvent.compositionEnd(editor))

    expect(
      await screen.findByRole('option', { name: 'cinematic lighting' })
    ).toBeVisible()
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
