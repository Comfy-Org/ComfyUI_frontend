import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
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
    oneWayExpandedKeys = false,
    selectionKeys = ref<Record<string, boolean>>()
  } = {}
) {
  const explorer = ref<{ addFolderCommand: (targetNodeKey: string) => void }>()
  const expandedKeysBinding = oneWayExpandedKeys
    ? ':expanded-keys'
    : 'v-model:expanded-keys'
  render(
    defineComponent({
      components: { TreeExplorer },
      setup: () => ({ root: treeRoot, explorer, expandedKeys, selectionKeys }),
      template: `
        <TreeExplorer
          ref="explorer"
          ${expandedKeysBinding}="expandedKeys"
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
            missingWarn: false,
            messages: { en: {} }
          })
        ]
      }
    }
  )
  return { explorer }
}

describe('TreeExplorer', () => {
  it('toggles a folder from its chevron', async () => {
    const user = userEvent.setup()
    renderHarness(root)
    const folder = screen.getByRole('treeitem', { name: 'Folder' })
    const chevron = within(folder).getByRole('button', { hidden: true })

    await user.click(chevron)

    expect(folder).toHaveAttribute('aria-expanded', 'true')
    expect(folder).toHaveAttribute('data-tree-node-type', 'folder')
    const leaf = screen.getByRole('treeitem', { name: 'Leaf' })
    expect(leaf).toHaveAttribute('data-tree-node-type', 'node')
    expect(leaf).toHaveAttribute('data-parent-label', 'Folder')

    await user.click(chevron)

    expect(folder).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('treeitem', { name: 'Leaf' })
    ).not.toBeInTheDocument()
  })

  it('names a row by its label without its badge', () => {
    renderHarness(root)

    const folder = screen.getByRole('treeitem', { name: 'Folder' })

    expect(within(folder).getByText('1')).toBeInTheDocument()
  })

  it('draws an icon image over the node icon', () => {
    renderHarness({
      key: 'root',
      label: 'Root',
      children: [
        {
          key: 'model',
          label: 'Model',
          leaf: true,
          icon: 'pi pi-file',
          getIconImage: () => '/preview.webp'
        }
      ]
    })

    const row = screen.getByRole('treeitem', { name: 'Model' })

    expect(within(row).getByTestId('tree-node-icon-image')).toHaveStyle({
      backgroundImage: 'url(/preview.webp)'
    })
  })

  it('selects a clicked row when the selection is bound', async () => {
    const user = userEvent.setup()
    const selectionKeys = ref<Record<string, boolean>>({})
    renderHarness(root, { selectionKeys })
    const folder = screen.getByRole('treeitem', { name: 'Folder' })

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
    const folder = screen.getByRole('treeitem', { name: 'Folder' })

    await user.click(folder)

    expect(handleFolderClick).toHaveBeenCalledOnce()
    expect(folder).toHaveAttribute('aria-selected', 'false')
    expect(
      screen.queryByRole('treeitem', { name: 'Leaf' })
    ).not.toBeInTheDocument()
  })

  it('expands the target of a new folder after a chevron toggle when expansion is bound one way', async () => {
    const user = userEvent.setup()
    const { explorer } = renderHarness(
      {
        ...root,
        children: [
          {
            key: 'alpha',
            label: 'Alpha',
            leaf: false,
            handleAddFolder: vi.fn(),
            children: [{ key: 'alpha/x', label: 'Xleaf', leaf: true }]
          },
          {
            key: 'bravo',
            label: 'Bravo',
            leaf: false,
            children: [{ key: 'bravo/y', label: 'Yleaf', leaf: true }]
          }
        ]
      },
      { oneWayExpandedKeys: true }
    )
    const bravo = screen.getByRole('treeitem', { name: 'Bravo' })
    await user.click(within(bravo).getByRole('button', { hidden: true }))
    expect(bravo).toHaveAttribute('aria-expanded', 'true')

    explorer.value?.addFolderCommand('alpha')
    await nextTick()

    expect(screen.getByRole('treeitem', { name: 'Alpha' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByRole('treeitem', { name: 'Xleaf' })).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('keeps a folder without loaded children expandable from the keyboard', async () => {
    const user = userEvent.setup()
    renderHarness({
      ...root,
      children: [{ key: 'unloaded', label: 'Unloaded', leaf: false }]
    })
    const folder = screen.getByRole('treeitem', { name: 'Unloaded' })

    expect(folder).toHaveAttribute('aria-expanded', 'false')
    folder.focus()
    await user.keyboard('{ArrowRight}')

    expect(folder).toHaveAttribute('aria-expanded', 'true')
  })
})
