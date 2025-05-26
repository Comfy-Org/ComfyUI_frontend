import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Panel from 'primevue/panel'
import { describe, expect, it, vi } from 'vitest'

import SelectionToolbox from '@/components/graph/SelectionToolbox.vue'

// Mock all child components
vi.mock('@/components/graph/selectionToolbox/BypassButton.vue', () => ({
  default: {
    name: 'BypassButton',
    render: () => null
  }
}))

vi.mock('@/components/graph/selectionToolbox/ColorPickerButton.vue', () => ({
  default: {
    name: 'ColorPickerButton',
    render: () => null
  }
}))

vi.mock('@/components/graph/selectionToolbox/DeleteButton.vue', () => ({
  default: {
    name: 'DeleteButton',
    render: () => null
  }
}))

vi.mock('@/components/graph/selectionToolbox/ExecuteButton.vue', () => ({
  default: {
    name: 'ExecuteButton',
    render: () => null
  }
}))

vi.mock('@/components/graph/selectionToolbox/MaskEditorButton.vue', () => ({
  default: {
    name: 'MaskEditorButton',
    render: () => null
  }
}))

vi.mock('@/components/graph/selectionToolbox/PinButton.vue', () => ({
  default: {
    name: 'PinButton',
    render: () => null
  }
}))

vi.mock('@/components/graph/selectionToolbox/RefreshButton.vue', () => ({
  default: {
    name: 'RefreshButton',
    render: () => null
  }
}))

vi.mock(
  '@/components/graph/selectionToolbox/ConvertToSubgraphButton.vue',
  () => ({
    default: {
      name: 'ConvertToSubgraphButton',
      render: () => null
    }
  })
)

vi.mock(
  '@/components/graph/selectionToolbox/ExtensionCommandButton.vue',
  () => ({
    default: {
      name: 'ExtensionCommandButton',
      props: ['command'],
      render: () => null
    }
  })
)

// Mock extension service and stores
vi.mock('@/services/extensionService', () => ({
  useExtensionService: vi.fn(() => ({
    invokeExtensions: vi.fn(() => [])
  }))
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: vi.fn(() => ({
    getCommand: vi.fn()
  }))
}))

vi.mock('@/stores/graphStore', () => ({
  useCanvasStore: vi.fn(() => ({
    selectedItems: []
  }))
}))

describe('SelectionToolbox', () => {
  const mountComponent = () => {
    return mount(SelectionToolbox, {
      global: {
        plugins: [PrimeVue],
        components: { Panel }
      }
    })
  }

  it('renders all toolbox buttons', () => {
    const wrapper = mountComponent()

    // Verify all buttons are rendered
    expect(wrapper.findComponent({ name: 'ExecuteButton' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ColorPickerButton' }).exists()).toBe(
      true
    )
    expect(wrapper.findComponent({ name: 'BypassButton' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'PinButton' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'MaskEditorButton' }).exists()).toBe(
      true
    )
    expect(wrapper.findComponent({ name: 'DeleteButton' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'RefreshButton' }).exists()).toBe(true)
    expect(
      wrapper.findComponent({ name: 'ConvertToSubgraphButton' }).exists()
    ).toBe(true)
  })
})
