import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Button from 'primevue/button'
import ButtonGroup from 'primevue/buttongroup'
import type { MenuItem } from 'primevue/menuitem'
import SplitButton from 'primevue/splitbutton'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ComfyQueueButton from '@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue'

// Mock global distribution constant
Object.defineProperty(global, '__DISTRIBUTION__', {
  value: 'localhost',
  writable: true
})

// Mock the environment utility
vi.mock('@/utils/envUtil', () => ({
  isElectron: vi.fn(() => false)
}))

// Mock the stores
vi.mock('@/stores/commandStore', () => ({
  useCommandStore: vi.fn()
}))

vi.mock('@/stores/queueStore', () => ({
  useQueuePendingTaskCountStore: vi.fn(),
  useQueueSettingsStore: vi.fn()
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: vi.fn()
}))

describe('ComfyQueueButton', () => {
  let mockCommandStore: any
  let mockQueueCountStore: any
  let mockQueueSettingsStore: any
  let mockWorkspaceStore: any

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        menu: {
          run: 'Run',
          instant: 'Instant',
          onChange: 'On Change',
          disabledTooltip: 'Run workflow',
          instantTooltip: 'Run instantly',
          onChangeTooltip: 'Run on change',
          runWorkflow: 'Run Workflow',
          runWorkflowFront: 'Run Workflow (Front)',
          interrupt: 'Interrupt'
        },
        sideToolbar: {
          queueTab: {
            clearPendingTasks: 'Clear Pending Tasks'
          }
        }
      }
    }
  })

  beforeEach(async () => {
    setActivePinia(createPinia())

    // Reset mocks
    mockCommandStore = {
      execute: vi.fn()
    }

    mockQueueCountStore = {
      count: { value: 0 }
    }

    mockQueueSettingsStore = {
      mode: { value: 'disabled' }
    }

    mockWorkspaceStore = {
      shiftDown: false
    }

    // Setup store mocks
    const { useCommandStore } = vi.mocked(await import('@/stores/commandStore'))
    const { useQueuePendingTaskCountStore, useQueueSettingsStore } = vi.mocked(
      await import('@/stores/queueStore')
    )
    const { useWorkspaceStore } = vi.mocked(
      await import('@/stores/workspaceStore')
    )

    useCommandStore.mockReturnValue(mockCommandStore)
    useQueuePendingTaskCountStore.mockReturnValue(mockQueueCountStore)
    useQueueSettingsStore.mockReturnValue(mockQueueSettingsStore)
    useWorkspaceStore.mockReturnValue(mockWorkspaceStore)

    vi.clearAllMocks()
  })

  const mountComponent = (distribution?: 'desktop' | 'localhost' | 'cloud') => {
    if (distribution) {
      // @ts-expect-error - Updating global for test
      global.__DISTRIBUTION__ = distribution
    }

    return mount(ComfyQueueButton, {
      global: {
        plugins: [i18n],
        directives: { tooltip: Tooltip },
        components: {
          Button,
          ButtonGroup,
          SplitButton
        },
        stubs: {
          BatchCountEdit: { template: '<div class="batch-count-edit" />' }
        }
      }
    })
  }

  describe('Desktop Environment', () => {
    it('should include instant mode option when not in cloud', () => {
      const wrapper = mountComponent('desktop')
      const splitButton = wrapper.findComponent(SplitButton)

      // Check that instant mode is included in the menu items
      const menuItems = splitButton.props('model')
      expect(menuItems).toBeDefined()
      expect(Array.isArray(menuItems)).toBe(true)
      const hasInstantMode = (menuItems as MenuItem[]).some(
        (item) => item.key === 'instant'
      )
      expect(hasInstantMode).toBe(true)
    })

    it('should render with disabled mode selected by default', () => {
      const wrapper = mountComponent('desktop')
      const splitButton = wrapper.findComponent(SplitButton)

      expect(splitButton.props('label')).toBe('Run')
    })
  })

  describe('Cloud Environment', () => {
    it('should exclude instant mode option when in cloud', () => {
      const wrapper = mountComponent('cloud')
      const splitButton = wrapper.findComponent(SplitButton)

      // Check that instant mode is NOT included in the menu items
      const menuItems = splitButton.props('model')
      expect(menuItems).toBeDefined()
      expect(Array.isArray(menuItems)).toBe(true)
      const hasInstantMode = (menuItems as MenuItem[]).some(
        (item) => item.key === 'instant'
      )
      expect(hasInstantMode).toBe(false)
    })

    it('should only include disabled and change modes in cloud', () => {
      const wrapper = mountComponent('cloud')
      const splitButton = wrapper.findComponent(SplitButton)

      const menuItems = splitButton.props('model')
      expect(menuItems).toBeDefined()
      expect(Array.isArray(menuItems)).toBe(true)
      const itemKeys = (menuItems as MenuItem[]).map((item) => item.key)
      expect(itemKeys).toEqual(['disabled', 'change'])
    })

    it('should gracefully handle when queueMode is instant in cloud', () => {
      // Set queue mode to instant
      mockQueueSettingsStore.mode.value = 'instant'

      const wrapper = mountComponent('cloud')
      const splitButton = wrapper.findComponent(SplitButton)

      // Should fallback to disabled mode label since instant is not available
      expect(splitButton.props('label')).toBe('Run')
    })
  })

  describe('Queue Mode Icons', () => {
    it('should display correct icon for disabled mode', () => {
      mockQueueSettingsStore.mode.value = 'disabled'
      const wrapper = mountComponent('desktop')

      const iconElement = wrapper.find('.icon-\\[lucide--play\\]')
      expect(iconElement.exists()).toBe(true)
    })

    it('should display correct icon for instant mode', () => {
      mockQueueSettingsStore.mode.value = 'instant'
      const wrapper = mountComponent('desktop')

      const iconElement = wrapper.find('.icon-\\[lucide--fast-forward\\]')
      expect(iconElement.exists()).toBe(true)
    })

    it('should display correct icon for change mode', () => {
      mockQueueSettingsStore.mode.value = 'change'
      const wrapper = mountComponent('desktop')

      const iconElement = wrapper.find('.icon-\\[lucide--step-forward\\]')
      expect(iconElement.exists()).toBe(true)
    })
  })

  describe('Queue Prompt Execution', () => {
    it('should execute Comfy.QueuePrompt command on click', async () => {
      const wrapper = mountComponent('desktop')
      const splitButton = wrapper.findComponent(SplitButton)

      await splitButton.trigger('click')

      expect(mockCommandStore.execute).toHaveBeenCalledWith('Comfy.QueuePrompt')
    })

    it('should execute Comfy.QueuePromptFront command on shift+click', async () => {
      const wrapper = mountComponent('desktop')
      const splitButton = wrapper.findComponent(SplitButton)

      await splitButton.trigger('click', { shiftKey: true })

      expect(mockCommandStore.execute).toHaveBeenCalledWith(
        'Comfy.QueuePromptFront'
      )
    })
  })
})
