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

describe('TreeExplorerTreeNode', () => {
  const mockNode = {
    key: '1',
    label: 'Test Node',
    leaf: false,
    totalLeaves: 3,
    icon: 'pi pi-folder',
    type: 'folder',
    handleRename: () => {}
  } as RenderedTreeExplorerNode

  const mockHandleEditLabel = vi.fn()

  it('renders correctly', () => {
    render(TreeExplorerTreeNode, {
      props: { node: mockNode },
      global: {
        components: { EditableText, Badge },
        plugins: [getActivePinia()!, i18n],
        provide: {
          [InjectKeyHandleEditLabelFunction]: mockHandleEditLabel
        }
      }
    })

    expect(screen.getByTestId('tree-node-1')).toBeInTheDocument()
    expect(screen.getByText('Test Node')).toBeInTheDocument()
    expect(screen.getByTestId('tree-leaf-count')).toHaveTextContent('3')
  })

  it('shows no leaf count on a leaf', () => {
    render(TreeExplorerTreeNode, {
      props: { node: { ...mockNode, leaf: true, type: 'node' } },
      global: {
        components: { EditableText, Badge },
        plugins: [getActivePinia()!, i18n],
        provide: {
          [InjectKeyHandleEditLabelFunction]: mockHandleEditLabel
        }
      }
    })

    expect(screen.getByText('Test Node')).toBeInTheDocument()
    expect(screen.queryByTestId('tree-leaf-count')).not.toBeInTheDocument()
  })

  it('makes node label editable when isEditingLabel is true', () => {
    render(TreeExplorerTreeNode, {
      props: {
        node: {
          ...mockNode,
          isEditingLabel: true
        }
      },
      global: {
        components: { EditableText, Badge },
        plugins: [getActivePinia()!, i18n],
        provide: {
          [InjectKeyHandleEditLabelFunction]: mockHandleEditLabel
        }
      }
    })

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('triggers handleEditLabel callback when editing is finished', async () => {
    const handleEditLabelMock = vi.fn()

    render(TreeExplorerTreeNode, {
      props: {
        node: {
          ...mockNode,
          isEditingLabel: true
        }
      },
      global: {
        components: { EditableText, Badge },
        provide: { [InjectKeyHandleEditLabelFunction]: handleEditLabelMock },
        plugins: [getActivePinia()!, i18n]
      }
    })

    // Trigger blur on the input to finish editing (fires the 'edit' event)
    await fireEvent.blur(screen.getByRole('textbox'))

    expect(handleEditLabelMock).toHaveBeenCalledOnce()
  })
})
