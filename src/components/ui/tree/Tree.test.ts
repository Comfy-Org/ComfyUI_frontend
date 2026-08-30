import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

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
          v-slot="{ handleToggle }"
          :value="item.value"
          :level="item.level"
        >
          <button @click="handleToggle()">
            {{ item.value.label }}
          </button>
        </TreeItem>
      </template>
    </Tree>
  `
})

describe('Tree', () => {
  it('expands, selects, and exposes tree ARIA state', async () => {
    const user = userEvent.setup()
    render(Harness)

    const folder = screen.getByRole('treeitem', { name: 'Folder' })
    expect(folder).toHaveAttribute('aria-expanded', 'false')

    await user.click(folder)

    expect(folder).toHaveAttribute('aria-expanded', 'true')
    expect(folder).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('treeitem', { name: 'Leaf' })).toBeInTheDocument()
  })

  it('supports arrow-key expansion and navigation', async () => {
    const user = userEvent.setup()
    render(Harness)

    const folder = screen.getByRole('treeitem', { name: 'Folder' })
    folder.focus()
    await user.keyboard('{ArrowRight}')

    expect(folder).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('treeitem', { name: 'Leaf' })).toHaveFocus()
  })
})
