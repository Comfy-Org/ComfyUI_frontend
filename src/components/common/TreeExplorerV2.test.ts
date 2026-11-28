import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { injectTreeRootContext } from 'reka-ui'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

import TreeExplorerV2 from './TreeExplorerV2.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { delete: 'Delete', edit: 'Edit' },
      icon: { bookmark: 'Bookmark' },
      sideToolbar: {
        nodeLibraryTab: {
          sections: {
            favoriteNode: 'Add to favorites',
            unfavoriteNode: 'Remove from favorites'
          }
        }
      }
    }
  }
})

const nodeDef = new ComfyNodeDefImpl({
  name: 'TestNode',
  display_name: 'Test Node',
  category: 'test',
  input: {},
  output: [],
  output_name: [],
  output_is_list: [],
  output_node: false,
  python_module: 'nodes',
  description: ''
})

const node: RenderedTreeExplorerNode<ComfyNodeDefImpl> = {
  key: 'test-node',
  label: 'Test Node',
  type: 'node',
  icon: 'icon-[comfy--node]',
  totalLeaves: 1,
  data: nodeDef
}

const root: RenderedTreeExplorerNode<ComfyNodeDefImpl> = {
  key: 'root',
  label: 'Root',
  type: 'folder',
  icon: 'icon-[lucide--folder]',
  totalLeaves: 1,
  children: [node]
}

const TreeVirtualizerStub = defineComponent({
  inheritAttrs: false,
  props: {
    estimateSize: { type: Number, required: true },
    textContent: { type: Function, required: true }
  },
  setup(_, { slots }) {
    const tree = injectTreeRootContext()
    return () => slots.default?.({ item: tree.expandedItems.value[0] })
  }
})

async function renderTree() {
  render(TreeExplorerV2, {
    global: {
      plugins: [i18n],
      stubs: { TreeVirtualizer: TreeVirtualizerStub }
    },
    props: { root, showContextMenu: true }
  })
  await nextTick()
  const treeItem = screen.getByRole('treeitem', { name: /Test Node/ })
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  const user = userEvent.setup({
    advanceTimers: vi.advanceTimersByTime,
    delay: 1
  })
  await user.pointer({
    keys: '[TouchA>]',
    target: treeItem,
    coords: { x: 20, y: 20 }
  })
  return { treeItem, user }
}

describe('TreeExplorerV2 touch context menu', () => {
  it('opens after a stationary long press', async () => {
    await renderTree()
    await vi.advanceTimersByTimeAsync(700)

    expect(
      screen.getByRole('menuitem', { name: 'Add to favorites' })
    ).toBeInTheDocument()
  })

  it('stays closed after a short touch', async () => {
    const { treeItem, user } = await renderTree()

    await vi.advanceTimersByTimeAsync(350)
    await user.pointer({ keys: '[/TouchA]', target: treeItem })
    await vi.advanceTimersByTimeAsync(700)

    expect(
      screen.queryByRole('menuitem', { name: 'Add to favorites' })
    ).not.toBeInTheDocument()
  })

  it('stays closed when the touch moves before the delay', async () => {
    const { treeItem, user } = await renderTree()

    await user.pointer({
      pointerName: 'TouchA',
      target: treeItem,
      coords: { x: 40, y: 40 }
    })
    await vi.advanceTimersByTimeAsync(700)

    expect(
      screen.queryByRole('menuitem', { name: 'Add to favorites' })
    ).not.toBeInTheDocument()
  })
})

function makeNode(
  name: string,
  label: string
): RenderedTreeExplorerNode<ComfyNodeDefImpl> {
  return {
    key: name,
    label,
    type: 'node',
    icon: 'icon-[comfy--node]',
    totalLeaves: 1,
    data: new ComfyNodeDefImpl({
      name,
      display_name: label,
      category: 'test',
      input: {},
      output: [],
      output_name: [],
      output_is_list: [],
      output_node: false,
      python_module: 'nodes',
      description: ''
    })
  }
}

function stubMissingJsdomLayoutSoVirtualizerRendersRows() {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300)
  onTestFinished(() => {
    vi.restoreAllMocks()
  })
}

describe('TreeExplorerV2 typeahead', () => {
  it('moves focus to the item whose label starts with the typed key', async () => {
    stubMissingJsdomLayoutSoVirtualizerRendersRows()
    const errors: unknown[] = []
    const typeaheadRoot: RenderedTreeExplorerNode<ComfyNodeDefImpl> = {
      key: 'root',
      label: 'Root',
      type: 'folder',
      icon: 'icon-[lucide--folder]',
      totalLeaves: 2,
      children: [makeNode('Alpha', 'Alpha Node'), makeNode('Beta', 'Beta Node')]
    }
    render(TreeExplorerV2, {
      global: {
        plugins: [i18n],
        config: { errorHandler: (err) => errors.push(err) }
      },
      props: { root: typeaheadRoot }
    })
    const user = userEvent.setup()

    const alpha = await screen.findByRole('treeitem', { name: /Alpha Node/ })
    alpha.focus()
    await user.keyboard('b')

    expect(errors).toEqual([])

    await vi.waitFor(() => {
      expect(screen.getByRole('treeitem', { name: /Beta Node/ })).toHaveFocus()
    })
    expect(errors).toEqual([])
  })
})
