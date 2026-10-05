import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import Tree from './Tree.vue'
import TreeItem from './TreeItem.vue'

interface Item extends Record<string, unknown> {
  key: string
  label: string
  children?: Item[]
}

const items: Item[] = [
  {
    key: 'folder',
    label: 'Folder',
    children: [{ key: 'leaf', label: 'Leaf' }]
  }
]

const Harness = defineComponent({
  components: { Tree, TreeItem },
  setup() {
    return { expanded: ref<string[]>([]), items, selected: ref<Item>() }
  },
  template: `
    <Tree
      v-model:expanded="expanded"
      v-model:selected="selected"
      :items="items"
      :get-key="(item) => item.key"
      :get-children="(item) => item.children"
      aria-label="Files"
    >
      <template #default="{ items: flattenedItems }">
        <TreeItem
          v-for="item in flattenedItems"
          :key="item._id"
          :value="item.value"
          :level="item.level"
          :has-children="item.hasChildren"
        >
          {{ item.value.label }}
        </TreeItem>
      </template>
    </Tree>
  `
})

function renderTree() {
  return render(Harness, {
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
}

describe('Tree', () => {
  it('toggles a parent from its chevron without selecting it', async () => {
    const user = userEvent.setup()
    renderTree()
    const folder = screen.getByRole('treeitem', { name: /Folder/ })

    await user.click(within(folder).getByRole('button', { name: 'Expand' }))

    expect(folder).toHaveAttribute('aria-expanded', 'true')
    expect(folder).toHaveAttribute('aria-selected', 'false')
    expect(within(folder).getByRole('button', { name: 'Collapse' })).toBe(
      within(folder).getByRole('button')
    )
    const leaf = screen.getByRole('treeitem', { name: 'Leaf' })
    expect(within(leaf).queryByRole('button')).not.toBeInTheDocument()
  })

  it('selects a row on click without toggling it', async () => {
    const user = userEvent.setup()
    renderTree()
    const folder = screen.getByRole('treeitem', { name: /Folder/ })

    await user.click(folder)

    expect(folder).toHaveAttribute('aria-selected', 'true')
    expect(folder).toHaveAttribute('aria-expanded', 'false')
  })

  it('supports arrow-key expansion and navigation', async () => {
    const user = userEvent.setup()
    renderTree()

    const folder = screen.getByRole('treeitem', { name: /Folder/ })
    folder.focus()
    await user.keyboard('{ArrowRight}')

    expect(folder).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('treeitem', { name: 'Leaf' })).toHaveFocus()
  })
})
