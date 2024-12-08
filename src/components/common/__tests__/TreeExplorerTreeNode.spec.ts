// @ts-strict-ignore
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import EditableText from '@/components/common/EditableText.vue'
import Badge from 'primevue/badge'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import { createTestingPinia } from '@pinia/testing'
import { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { createI18n } from 'vue-i18n'
import { createApp } from 'vue'
import { useToastStore } from '@/stores/toastStore'

// Create a mock i18n instance
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

  beforeAll(() => {
    // Create a Vue app instance for PrimeVuePrimeVue
    const app = createApp({})
    app.use(PrimeVue)
    vi.useFakeTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('renders correctly', () => {
    const wrapper = mount(TreeExplorerTreeNode, {
      props: { node: mockNode },
      global: {
        components: { EditableText, Badge },
        provide: { renameEditingNode: { value: null } },
        plugins: [createTestingPinia(), i18n]
      }
    })

    expect(wrapper.find('.tree-node').exists()).toBe(true)
    expect(wrapper.find('.tree-folder').exists()).toBe(true)
    expect(wrapper.find('.tree-leaf').exists()).toBe(false)
    expect(wrapper.findComponent(EditableText).props('modelValue')).toBe(
      'Test Node'
    )
    expect(wrapper.findComponent(Badge).props()['value'].toString()).toBe('3')
  })

  it('makes node label editable when renamingEditingNode matches', async () => {
    const wrapper = mount(TreeExplorerTreeNode, {
      props: { node: mockNode },
      global: {
        components: { EditableText, Badge, InputText },
        provide: { renameEditingNode: { value: { key: '1' } } },
        plugins: [createTestingPinia(), i18n, PrimeVue]
      }
    })

    const editableText = wrapper.findComponent(EditableText)
    expect(editableText.props('isEditing')).toBe(true)
  })

  it('triggers handleRename callback when editing is finished', async () => {
    const handleRenameMock = vi.fn()
    const nodeWithMockRename = {
      ...mockNode,
      handleRename: handleRenameMock
    }

    const wrapper = mount(TreeExplorerTreeNode, {
      props: { node: nodeWithMockRename },
      global: {
        components: { EditableText, Badge, InputText },
        provide: { renameEditingNode: { value: { key: '1' } } },
        plugins: [createTestingPinia(), i18n, PrimeVue]
      }
    })

    const editableText = wrapper.findComponent(EditableText)
    editableText.vm.$emit('edit', 'New Node Name')
    expect(handleRenameMock).toHaveBeenCalledOnce()
  })

  it('shows error toast when handleRename promise rejects', async () => {
    const handleRenameMock = vi
      .fn()
      .mockRejectedValue(new Error('Rename failed'))
    const nodeWithMockRename = {
      ...mockNode,
      handleRename: handleRenameMock
    }

    const wrapper = mount(TreeExplorerTreeNode, {
      props: { node: nodeWithMockRename },
      global: {
        components: { EditableText, Badge, InputText },
        provide: { renameEditingNode: { value: { key: '1' } } },
        plugins: [createTestingPinia(), i18n, PrimeVue]
      }
    })

    const toastStore = useToastStore()
    const addToastSpy = vi.spyOn(toastStore, 'add')

    const editableText = wrapper.findComponent(EditableText)
    editableText.vm.$emit('edit', 'New Node Name')

    // Wait for the promise to reject and the toast to be added
    vi.runAllTimers()

    // Wait for any pending promises to resolve
    await new Promise(process.nextTick)

    expect(handleRenameMock).toHaveBeenCalledOnce()
    expect(addToastSpy).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'Rename failed',
      life: 3000
    })
  })
})
