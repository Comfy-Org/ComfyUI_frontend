import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import type { PropType } from 'vue'
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

const Harness = defineComponent({
  components: { TreeExplorer },
  props: {
    root: { type: Object as PropType<TreeExplorerNode>, required: true }
  },
  setup() {
    return { expandedKeys: ref<Record<string, boolean>>({}) }
  },
  template: `
    <TreeExplorer
      v-model:expanded-keys="expandedKeys"
      :root="root"
      aria-label="Files"
    />
  `
})

const renderHarness = (treeRoot: TreeExplorerNode) =>
  render(Harness, {
    props: { root: treeRoot },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: { g: { collapse: 'Collapse', expand: 'Expand' } } }
        })
      ]
    }
  })

describe('TreeExplorer', () => {
  it('toggles a folder by clicking its row', async () => {
    const user = userEvent.setup()
    renderHarness(root)

    expect(
      screen.queryByRole('treeitem', { name: 'Leaf' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('treeitem', { name: /Folder/ }))

    expect(screen.getByRole('treeitem', { name: /Folder/ })).toHaveAttribute(
      'data-tree-node-type',
      'folder'
    )
    expect(screen.getByRole('treeitem', { name: 'Leaf' })).toHaveAttribute(
      'data-parent-label',
      'Folder'
    )
    expect(
      screen.getByRole('treeitem', { name: /Folder/ })
    ).not.toHaveAttribute('data-selected')
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

    await user.click(screen.getByRole('treeitem', { name: /Folder/ }))

    expect(handleFolderClick).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('treeitem', { name: 'Leaf' })
    ).not.toBeInTheDocument()
  })

  it('keeps a folder without loaded children expandable from the keyboard', async () => {
    const user = userEvent.setup()
    renderHarness({
      ...root,
      children: [{ key: 'unloaded', label: 'Unloaded', leaf: false }]
    })
    const folder = screen.getByRole('treeitem', { name: /Unloaded/ })

    expect(folder).toHaveAttribute('aria-expanded', 'false')
    folder.focus()
    await user.keyboard('{ArrowRight}')

    expect(folder).toHaveAttribute('aria-expanded', 'true')
  })
})
