import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { TreeItemToggleEvent } from 'reka-ui'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import Tree from './Tree.vue'
import TreeItem from './TreeItem.vue'

interface Item {
  key: string
  label: string
  children?: Item[]
}

const items: Item[] = [
  {
    key: 'folder',
    label: 'Folder',
    children: [{ key: 'leaf', label: 'Leaf' }]
  },
  { key: 'beta', label: 'Beta' }
]

const Harness = defineComponent({
  components: { Tree, TreeItem },
  props: {
    toggleListener: {
      type: Function,
      default: () => {}
    },
    withInput: Boolean
  },
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
      <template #default="{ flattenItems }">
        <TreeItem
          v-for="item in flattenItems"
          :key="item._id"
          :value="item.value"
          :level="item.level"
          :aria-label="item.value.label"
          @toggle="toggleListener"
        >
          {{ item.value.label }}
          <input v-if="withInput" :aria-label="'Rename ' + item.value.label" />
        </TreeItem>
      </template>
    </Tree>
  `
})

function renderTree(
  props: {
    toggleListener?: (event: TreeItemToggleEvent<Item>) => void
    withInput?: boolean
  } = {}
) {
  return render(Harness, { props })
}

describe('Tree', () => {
  it('toggles a parent from its chevron without selecting it', async () => {
    const user = userEvent.setup()
    renderTree()
    const folder = screen.getByRole('treeitem', { name: 'Folder' })

    await user.click(within(folder).getByRole('button', { hidden: true }))

    expect(folder).toHaveAttribute('aria-expanded', 'true')
    expect(folder).toHaveAttribute('aria-selected', 'false')
    const leaf = screen.getByRole('treeitem', { name: 'Leaf' })
    expect(
      within(leaf).queryByRole('button', { hidden: true })
    ).not.toBeInTheDocument()
  })

  it.for([
    ['a pointer click', (row: HTMLElement) => userEvent.setup().click(row)],
    [
      'a plain mouse click',
      (row: HTMLElement) =>
        fireEvent(row, new MouseEvent('click', { bubbles: true }))
    ]
  ] as const)('selects a row on %s without toggling it', async ([, click]) => {
    renderTree()
    const folder = screen.getByRole('treeitem', { name: 'Folder' })

    await click(folder)

    expect(folder).toHaveAttribute('aria-selected', 'true')
    expect(folder).toHaveAttribute('aria-expanded', 'false')
  })

  it('cancels a click toggle before a consumer toggle listener runs', async () => {
    const user = userEvent.setup()
    const preventedStates: boolean[] = []
    renderTree({
      toggleListener: (event) => preventedStates.push(event.defaultPrevented)
    })

    await user.click(screen.getByRole('treeitem', { name: 'Folder' }))

    expect(preventedStates).toEqual([true])
  })

  it('leaves keys typed into row content to that content', async () => {
    const user = userEvent.setup()
    renderTree({ withInput: true })
    const input = screen.getByRole('textbox', { name: 'Rename Folder' })

    await user.click(input)
    await user.keyboard(
      'Bea{ArrowLeft}{ArrowRight}{Control>}{ArrowRight}{/Control}t'
    )

    expect(input).toHaveFocus()
    expect(input).toHaveValue('Beat')
    expect(screen.getByRole('treeitem', { name: 'Folder' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  it('lets shortcuts typed into row content reach the window', async () => {
    const user = userEvent.setup()
    const windowKeydown = vi.fn()
    window.addEventListener('keydown', windowKeydown)
    onTestFinished(() => window.removeEventListener('keydown', windowKeydown))
    renderTree({ withInput: true })
    const input = screen.getByRole('textbox', { name: 'Rename Folder' })

    await user.click(input)
    await user.keyboard('{Control>}s{/Control}')

    expect(windowKeydown).toHaveBeenCalledWith(
      expect.objectContaining({ ctrlKey: true, key: 's' })
    )
    expect(input).toHaveFocus()
  })

  it('supports arrow-key expansion and navigation', async () => {
    const user = userEvent.setup()
    renderTree()

    const folder = screen.getByRole('treeitem', { name: 'Folder' })
    folder.focus()
    await user.keyboard('{ArrowRight}')

    expect(folder).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('treeitem', { name: 'Leaf' })).toHaveFocus()
  })
})
