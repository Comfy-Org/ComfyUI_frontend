import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import BypassButton from '@/components/graph/selectionToolbox/BypassButton.vue'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useCommandStore } from '@/stores/commandStore'

// Mock all dependencies
vi.mock('@/stores/commandStore', () => ({
  useCommandStore: vi.fn()
}))

vi.mock('@/composables/graph/useSelectionState', () => ({
  useSelectionState: vi.fn()
}))

describe('BypassButton', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        selectionToolbox: {
          bypassButton: {
            tooltip: 'Bypass/Unbypass Selected Nodes'
          }
        },
        'commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label':
          'Toggle Bypass Selected Nodes'
      }
    }
  })

  // Mock interfaces
  interface MockCommandStore {
    execute: ReturnType<typeof vi.fn>
  }

  interface MockSelectionState {
    hasAnySelection: { value: boolean }
  }

  // Mock instances
  let mockCommandStore: MockCommandStore
  let mockSelectionState: MockSelectionState

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock command store
    mockCommandStore = {
      execute: vi.fn().mockResolvedValue(undefined)
    }
    vi.mocked(useCommandStore).mockReturnValue(
      mockCommandStore as unknown as ReturnType<typeof useCommandStore>
    )

    // Setup mock selection state
    mockSelectionState = {
      hasAnySelection: ref(true)
    }
    vi.mocked(useSelectionState).mockReturnValue(
      mockSelectionState as unknown as ReturnType<typeof useSelectionState>
    )
  })

  const mountComponent = () => {
    return mount(BypassButton, {
      global: {
        plugins: [i18n, PrimeVue],
        directives: { tooltip: Tooltip },
        stubs: {
          'i-lucide:ban': true
        }
      }
    })
  }

  test('should render bypass button when items are selected', () => {
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
  })

  test('should have correct test id', () => {
    const wrapper = mountComponent()
    const button = wrapper.find('[data-testid="bypass-button"]')
    expect(button.exists()).toBe(true)
  })

  test('should execute bypass command when clicked', async () => {
    const wrapper = mountComponent()
    await wrapper.find('button').trigger('click')

    expect(mockCommandStore.execute).toHaveBeenCalledWith(
      'Comfy.Canvas.ToggleSelectedNodes.Bypass'
    )
  })

  test('should show button when hasAnySelection is true', () => {
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.isVisible()).toBe(true)
  })

  test('should call useSelectionState composable', () => {
    mountComponent()
    expect(useSelectionState).toHaveBeenCalled()
  })
})
