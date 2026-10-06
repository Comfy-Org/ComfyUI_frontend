import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import TreeExplorer from '@/components/common/TreeExplorer.vue'
import type { TreeExplorerNode } from '@/types/treeExplorerTypes'

const root: TreeExplorerNode = {
  key: 'root',
  label: 'Root',
  leaf: false,
  children: [
    {
      key: 'folder',
      label: 'Folder',
      leaf: false,
      children: [{ key: 'leaf', label: 'Leaf', leaf: true }]
    }
  ]
}

function renderHarness(
  treeRoot: TreeExplorerNode,
  {
    expandedKeys = ref<Record<string, boolean>>({}),
    selectionKeys = ref<Record<string, boolean>>()
  } = {}
) {
  return render(
    defineComponent({
      components: { TreeExplorer },
      setup: () => ({ root: treeRoot, expandedKeys, selectionKeys }),
      template: `
        <TreeExplorer
          v-model:expanded-keys="expandedKeys"
          v-model:selection-keys="selectionKeys"
          :root="root"
          aria-label="Files"
        />
      `
    }),
    {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: { g: { collapse: 'Collapse', expand: 'Expand' } } }
          })
        ]
      }
    }
  )
}

describe('TreeExplorer', () => {
  it('toggles a folder from its chevron', async () => {
    const user = userEvent.setup()
    renderHarness(root)
    const folder = screen.getByRole('treeitem', { name: /^Folder/ })

    await user.click(within(folder).getByLabelText('Expand'))

    expect(folder).toHaveAttribute('data-tree-node-type', 'folder')
    expect(folder).not.toHaveAttribute('data-selected')
    const leaf = screen.getByRole('treeitem', { name: 'Leaf' })
    expect(leaf).toHaveAttribute('data-tree-node-type', 'node')
    expect(leaf).toHaveAttribute('data-parent-label', 'Folder')

    await user.click(within(folder).getByLabelText('Collapse'))

    expect(
      screen.queryByRole('treeitem', { name: 'Leaf' })
    ).not.toBeInTheDocument()
  })

  it('selects a clicked row when the selection is bound', async () => {
    const user = userEvent.setup()
    const selectionKeys = ref<Record<string, boolean>>({})
    renderHarness(root, { selectionKeys })
    const folder = screen.getByRole('treeitem', { name: /^Folder/ })

    await user.click(folder)

    expect(folder).toHaveAttribute('aria-selected', 'true')
    expect(selectionKeys.value).toEqual({ folder: true })
  })

  it('lets a folder click handler own expansion', async () => {
    const user = userEvent.setup()
    const handleFolderClick = vi.fn()
    renderHarness({
      ...root,
      children: root.children?.map((node) => ({
        ...node,
        handleClick: handleFolderClick
      }))
    })

    await user.click(screen.getByRole('treeitem', { name: /^Folder/ }))

    expect(handleFolderClick).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('treeitem', { name: 'Leaf' })
    ).not.toBeInTheDocument()
  })

  it('expands a folder once when a plain mouse click reaches its click handler', async () => {
    const expandedKeys = ref<Record<string, boolean>>({})
    renderHarness(
      {
        ...root,
        children: root.children?.map((node) => ({
          ...node,
          handleClick() {
            expandedKeys.value = {
              ...expandedKeys.value,
              [node.key]: !expandedKeys.value[node.key]
            }
          }
        }))
      },
      { expandedKeys }
    )
    const folder = screen.getByRole('treeitem', { name: /^Folder/ })

    await fireEvent(
      folder,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    )

    expect(folder).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('treeitem', { name: 'Leaf' })).toBeInTheDocument()
  })

  it('keeps a folder without loaded children expandable from the keyboard', async () => {
    const user = userEvent.setup()
    renderHarness({
      ...root,
      children: [{ key: 'unloaded', label: 'Unloaded', leaf: false }]
    })
    const folder = screen.getByRole('treeitem', { name: /^Unloaded/ })

    expect(folder).toHaveAttribute('aria-expanded', 'false')
    folder.focus()
    await user.keyboard('{ArrowRight}')

    expect(folder).toHaveAttribute('aria-expanded', 'true')
  })
})
