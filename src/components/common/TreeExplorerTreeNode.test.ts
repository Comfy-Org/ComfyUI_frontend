import { createTestingPinia } from '@pinia/testing'
import { fireEvent, render, screen } from '@testing-library/vue'
import Badge from 'primevue/badge'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'

import EditableText from '@/components/common/EditableText.vue'
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

  beforeAll(() => {
    const app = createApp({})
    app.use(PrimeVue)
    vi.useFakeTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('renders correctly', () => {
    render(TreeExplorerTreeNode, {
      props: { node: mockNode },
      global: {
        components: { EditableText, Badge },
        plugins: [createTestingPinia(), i18n],
        provide: {
          [InjectKeyHandleEditLabelFunction]: mockHandleEditLabel
        }
      }
    })

    const treeNode = screen.getByTestId('tree-node-1')
    expect(treeNode).toBeInTheDocument()
    expect(treeNode).toHaveClass('tree-folder')
    expect(treeNode).not.toHaveClass('tree-leaf')
    expect(screen.getByText('Test Node')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
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
        components: { EditableText, Badge, InputText },
        plugins: [createTestingPinia(), i18n, PrimeVue],
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
        components: { EditableText, Badge, InputText },
        provide: { [InjectKeyHandleEditLabelFunction]: handleEditLabelMock },
        plugins: [createTestingPinia(), i18n, PrimeVue]
      }
    })

    // Trigger blur on the input to finish editing (fires the 'edit' event)
    await fireEvent.blur(screen.getByRole('textbox'))

    expect(handleEditLabelMock).toHaveBeenCalledOnce()
  })
})
