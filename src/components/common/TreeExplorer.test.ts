import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
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

async function submitRename(
  handleRename: NonNullable<TreeExplorerNode['handleRename']>,
  handleError = vi.fn()
) {
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
    global: { plugins: [i18n] }
  })

  const user = userEvent.setup()
  await fireEvent.contextMenu(screen.getByTestId('tree-node-child'))
  await user.click(await screen.findByText('Rename'))
  const textbox = await screen.findByRole('textbox')
  await user.clear(textbox)
  await user.type(textbox, 'Renamed name')
  await fireEvent.blur(textbox)
}

describe('TreeExplorer', () => {
  it('closes the label editor after renaming succeeds', async () => {
    let finishRename: () => void = () => {}
    const handleRename = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRename = resolve
        })
    )
    await submitRename(handleRename)

    expect(handleRename).toHaveBeenCalledWith('Renamed name')
    expect(screen.getByRole('textbox')).toBeInTheDocument()

    finishRename()
    await waitFor(() =>
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    )
  })

  it('closes the label editor when renaming fails', async () => {
    const handleError = vi.fn()
    const handleRename = vi.fn().mockRejectedValue(new Error('rename failed'))
    await submitRename(handleRename, handleError)

    expect(handleRename).toHaveBeenCalledWith('Renamed name')
    await waitFor(() => expect(handleError).toHaveBeenCalledOnce())
    await nextTick()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
