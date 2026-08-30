import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
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

const Harness = defineComponent({
  components: { TreeExplorer },
  setup() {
    return { expandedKeys: ref<Record<string, boolean>>({}), root }
  },
  template: `
    <TreeExplorer
      v-model:expanded-keys="expandedKeys"
      :root="root"
      aria-label="Files"
    />
  `
})

const handleFolderClick = vi.fn()
const rootWithClickHandler: TreeExplorerNode = {
  ...root,
  children: root.children?.map((node) => ({
    ...node,
    handleClick: handleFolderClick
  }))
}

const HarnessWithClickHandler = defineComponent({
  components: { TreeExplorer },
  setup() {
    return {
      expandedKeys: ref<Record<string, boolean>>({}),
      root: rootWithClickHandler
    }
  },
  template: `
    <TreeExplorer
      v-model:expanded-keys="expandedKeys"
      :root="root"
      aria-label="Files"
    />
  `
})

const renderHarness = (component: typeof Harness) =>
  render(component, {
    global: {
      plugins: [
        createTestingPinia(),
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
    renderHarness(Harness)

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
  })

  it('lets a folder click handler own expansion', async () => {
    const user = userEvent.setup()
    renderHarness(HarnessWithClickHandler)

    await user.click(screen.getByRole('treeitem', { name: /Folder/ }))

    expect(handleFolderClick).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('treeitem', { name: 'Leaf' })
    ).not.toBeInTheDocument()
  })
})
