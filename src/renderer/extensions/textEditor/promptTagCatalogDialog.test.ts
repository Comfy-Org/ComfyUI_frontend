import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { assert, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { i18n } from '@/i18n'
import type { WidgetAugmentationTarget } from '@/platform/extensions/widgetAugmentation'
import { usePromptTagCatalogStore } from '@/renderer/extensions/textEditor/promptTagCatalogStore'
import { showTextEditor } from '@/renderer/extensions/textEditor/textEditorDialog'

function openEditor(
  augmentationTarget: WidgetAugmentationTarget | undefined = {
    nodeType: 'CLIPTextEncode',
    widgetName: 'text'
  }
) {
  const source = ref('')
  return showTextEditor({
    readText: () => source.value,
    widgetLabel: 'text',
    readOnly: () => false,
    onEdit: (value) => (source.value = value),
    augmentationTarget
  })
}

describe('prompt tag catalog editor', () => {
  it.for([
    {
      target: { nodeType: 'CLIPTextEncode', widgetName: 'text' },
      expected: ['blue eyes']
    },
    {
      target: { nodeType: 'CLIPTextEncode', widgetName: 'notes' },
      expected: []
    },
    {
      target: {
        nodeType: 'DevToolsNodeWithAugmentedTextarea',
        widgetName: 'prompt'
      },
      expected: []
    }
  ])(
    'limits catalog controls and suggestions to $target',
    async ({ target, expected }) => {
      const user = userEvent.setup()
      usePromptTagCatalogStore().importCatalog('blue_eyes')
      render(GlobalDialog, { global: { plugins: [i18n] } })
      openEditor(target)
      const editor = await screen.findByRole('textbox')

      await user.type(editor, 'blue')

      expect(
        screen.queryAllByRole('button', { name: 'Import prompt tags' })
      ).toHaveLength(expected.length)
      expect(
        screen
          .queryAllByRole('option')
          .map((option) => option.textContent.trim())
      ).toEqual(expected)
      expect(editor).toHaveFocus()
    }
  )

  it('discards an unfinished catalog import when another editor opens', async () => {
    const user = userEvent.setup()
    let finish: ((text: string) => void) | undefined
    const pending = new Promise<string>((resolve) => (finish = resolve))
    const file = new File(['blue_eyes'], 'old.txt', { type: 'text/plain' })
    vi.spyOn(file, 'text').mockReturnValue(pending)
    render(GlobalDialog, { global: { plugins: [i18n] } })
    const close = openEditor()
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
    render(GlobalDialog, { global: { plugins: [i18n] } })
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
})
