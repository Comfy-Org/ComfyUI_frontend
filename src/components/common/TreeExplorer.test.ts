import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import TreeExplorer from '@/components/common/TreeExplorer.vue'
import type { TreeExplorerNode } from '@/types/treeExplorerTypes'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        delete: 'Delete',
        newFolder: 'New Folder',
        rename: 'Rename'
      }
    }
  }
})

describe('TreeExplorer', () => {
  it('keeps the label editor open when renaming fails', async () => {
    const user = userEvent.setup()
    const handleError = vi.fn()
    const handleRename = vi.fn().mockRejectedValue(new Error('rename failed'))
    const root: TreeExplorerNode = {
      key: 'root',
      label: 'Root',
      children: [
        {
          key: 'child',
          label: 'Original name',
          leaf: true,
          handleError,
          handleRename
        }
      ]
    }

    render(TreeExplorer, {
      props: { expandedKeys: {}, root },
      global: { plugins: [PrimeVue, i18n] }
    })

    await fireEvent.contextMenu(screen.getByTestId('tree-node-child'))
    await user.click(await screen.findByText('Rename'))
    await fireEvent.blur(await screen.findByRole('textbox'))

    await waitFor(() => expect(handleError).toHaveBeenCalledOnce())
    await nextTick()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
