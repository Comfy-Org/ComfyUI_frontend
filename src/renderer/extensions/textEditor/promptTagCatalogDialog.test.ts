import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { i18n } from '@/i18n'
import { usePromptTagCatalogStore } from '@/platform/settings/promptTagCatalogStore'
import { showTextEditor } from '@/renderer/extensions/textEditor/textEditorDialog'

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
    'uses catalog suggestions for $target.nodeType $target.widgetName without import controls',
    async ({ target, expected }) => {
      const user = userEvent.setup()
      const source = ref('')
      usePromptTagCatalogStore().importCatalog('blue_eyes')
      render(GlobalDialog, { global: { plugins: [i18n] } })
      showTextEditor({
        readText: () => source.value,
        widgetLabel: 'text',
        readOnly: () => false,
        onEdit: (value) => (source.value = value),
        augmentationTarget: target
      })
      const editor = await screen.findByRole('textbox')

      await user.type(editor, 'blue')

      expect(screen.queryByLabelText('Import prompt tags')).toBeNull()
      expect(
        screen.queryByRole('button', { name: 'Import prompt tags' })
      ).toBeNull()
      expect(
        screen
          .queryAllByRole('option')
          .map((option) => option.textContent.trim())
      ).toEqual(expected)
      expect(editor).toHaveFocus()
    }
  )
})
