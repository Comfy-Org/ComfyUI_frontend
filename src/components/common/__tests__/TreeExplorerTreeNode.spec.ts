import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import EditableText from '@/components/common/EditableText.vue'
import Badge from 'primevue/badge'
import { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

describe('TreeExplorerTreeNode', () => {
  const mockNode = {
    key: '1',
    label: 'Test Node',
    leaf: false,
    totalLeaves: 3,
    icon: 'pi pi-folder',
    type: 'folder'
  } as RenderedTreeExplorerNode

  it('renders correctly', () => {
    const wrapper = mount(TreeExplorerTreeNode, {
      props: { node: mockNode },
      global: {
        components: { EditableText, Badge },
        provide: { renameEditingNode: { value: null } }
      }
    })

    expect(wrapper.find('.tree-node').exists()).toBe(true)
    expect(wrapper.find('.tree-folder').exists()).toBe(true)
    expect(wrapper.find('.tree-leaf').exists()).toBe(false)
    expect(wrapper.findComponent(EditableText).props('modelValue')).toBe(
      'Test Node'
    )
    expect(wrapper.findComponent(Badge).props()['value']).toBe(3)
  })
})
