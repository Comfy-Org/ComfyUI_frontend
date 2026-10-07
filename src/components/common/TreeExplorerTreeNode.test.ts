import { getActivePinia } from 'pinia'
import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import EditableText from '@/components/common/EditableText.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { InjectKeyHandleEditLabelFunction } from '@/types/treeExplorerTypes'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {}
})

const mockNode = {
  key: '1',
  label: 'Test Node',
  leaf: false,
  totalLeaves: 3,
  icon: 'pi pi-folder',
  type: 'folder',
  handleRename: () => {}
} as RenderedTreeExplorerNode

function renderNode(
  overrides: Partial<RenderedTreeExplorerNode> = {},
  handleEditLabel = vi.fn()
) {
  render(TreeExplorerTreeNode, {
    props: { node: { ...mockNode, ...overrides } },
    global: {
      components: { EditableText, Badge },
      plugins: [getActivePinia()!, i18n],
      provide: { [InjectKeyHandleEditLabelFunction]: handleEditLabel }
    }
  })
}

describe('TreeExplorerTreeNode', () => {
  it.for([
    { kind: 'a folder', overrides: {}, leafCount: '3' },
    {
      kind: 'a leaf',
      overrides: { leaf: true, type: 'node' as const },
      leafCount: undefined
    }
  ])('renders $kind with its leaf count', ({ overrides, leafCount }) => {
    renderNode(overrides)

    expect(screen.getByText('Test Node')).toBeInTheDocument()
    expect(screen.queryByTestId('tree-leaf-count')?.textContent.trim()).toBe(
      leafCount
    )
  })

  it('makes node label editable when isEditingLabel is true', () => {
    renderNode({ isEditingLabel: true })

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('triggers handleEditLabel callback when editing is finished', async () => {
    const handleEditLabel = vi.fn()
    renderNode({ isEditingLabel: true }, handleEditLabel)

    await fireEvent.blur(screen.getByRole('textbox'))

    expect(handleEditLabel).toHaveBeenCalledOnce()
  })
})
