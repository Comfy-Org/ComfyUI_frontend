import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import ManagerProgressFooter from '@/components/dialog/footer/ManagerProgressFooter.vue'
import { useComfyManagerService } from '@/services/comfyManagerService'
import {
  useComfyManagerStore,
  useManagerProgressDialogStore
} from '@/stores/comfyManagerStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useSettingStore } from '@/stores/settingStore'
import { TaskLog } from '@/types/comfyManagerTypes'

// Mock modules
vi.mock('@/stores/comfyManagerStore')
vi.mock('@/stores/dialogStore')
vi.mock('@/stores/settingStore')
vi.mock('@/stores/commandStore')
vi.mock('@/services/comfyManagerService')

// Mock useEventListener to capture the event handler
let reconnectHandler: (() => void) | null = null
vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  return {
    ...actual,
    useEventListener: vi.fn(
      (_target: any, event: string, handler: any, _options: any) => {
        if (event === 'reconnected') {
          reconnectHandler = handler
        }
      }
    )
  }
})
vi.mock('@/services/workflowService', () => ({
  useWorkflowService: vi.fn(() => ({
    reloadCurrentWorkflow: vi.fn().mockResolvedValue(undefined)
  }))
}))
vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: vi.fn(() => ({
    completedActivePalette: {
      light_theme: false
    }
  }))
}))

// Helper function to mount component with required setup
const mountComponent = () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {}
    }
  })

  return mount(ManagerProgressFooter, {
    global: {
      plugins: [PrimeVue, i18n],
      mocks: {
        $t: (key: string) => key // Mock i18n translation
      }
    }
  })
}

describe('ManagerProgressFooter', () => {
  const mockTaskLogs: TaskLog[] = []

  const mockComfyManagerStore = {
    uncompletedCount: 0,
    taskLogs: mockTaskLogs,
    allTasksDone: true,
    clearLogs: vi.fn(),
    setStale: vi.fn(),
    // Add other required properties
    isLoading: { value: false },
    error: { value: null },
    statusMessage: { value: 'DONE' },
    installedPacks: {},
    installedPacksIds: new Set(),
    isPackInstalled: vi.fn(),
    isPackEnabled: vi.fn(),
    getInstalledPackVersion: vi.fn(),
    refreshInstalledList: vi.fn(),
    installPack: vi.fn(),
    uninstallPack: vi.fn(),
    updatePack: vi.fn(),
    updateAllPacks: vi.fn(),
    disablePack: vi.fn(),
    enablePack: vi.fn()
  }

  const mockDialogStore = {
    closeDialog: vi.fn(),
    // Add other required properties
    dialogStack: { value: [] },
    showDialog: vi.fn(),
    $id: 'dialog',
    $state: {} as any,
    $patch: vi.fn(),
    $reset: vi.fn(),
    $subscribe: vi.fn(),
    $dispose: vi.fn(),
    $onAction: vi.fn()
  }

  const mockSettingStore = {
    get: vi.fn().mockReturnValue(false),
    set: vi.fn(),
    // Add other required properties
    settingValues: { value: {} },
    settingsById: { value: {} },
    exists: vi.fn(),
    getDefaultValue: vi.fn(),
    loadSettingValues: vi.fn(),
    updateValue: vi.fn(),
    $id: 'setting',
    $state: {} as any,
    $patch: vi.fn(),
    $reset: vi.fn(),
    $subscribe: vi.fn(),
    $dispose: vi.fn(),
    $onAction: vi.fn()
  }

  const mockProgressDialogStore = {
    isExpanded: false,
    toggle: vi.fn(),
    collapse: vi.fn(),
    expand: vi.fn()
  }

  const mockCommandStore = {
    execute: vi.fn().mockResolvedValue(undefined)
  }

  const mockComfyManagerService = {
    rebootComfyUI: vi.fn().mockResolvedValue(null)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset task logs
    mockTaskLogs.length = 0
    mockComfyManagerStore.taskLogs = mockTaskLogs
    // Reset event handler
    reconnectHandler = null

    vi.mocked(useComfyManagerStore).mockReturnValue(
      mockComfyManagerStore as any
    )
    vi.mocked(useDialogStore).mockReturnValue(mockDialogStore as any)
    vi.mocked(useSettingStore).mockReturnValue(mockSettingStore as any)
    vi.mocked(useManagerProgressDialogStore).mockReturnValue(
      mockProgressDialogStore as any
    )
    vi.mocked(useCommandStore).mockReturnValue(mockCommandStore as any)
    vi.mocked(useComfyManagerService).mockReturnValue(
      mockComfyManagerService as any
    )
  })

  describe('State 1: Queue Running', () => {
    it('should display loading spinner and progress counter when queue is running', async () => {
      // Setup queue running state
      mockComfyManagerStore.uncompletedCount = 3
      mockTaskLogs.push(
        { taskName: 'Installing pack1', logs: [] },
        { taskName: 'Installing pack2', logs: [] },
        { taskName: 'Installing pack3', logs: [] }
      )

      const wrapper = mountComponent()

      // Check loading spinner exists (DotSpinner component)
      expect(wrapper.find('.inline-flex').exists()).toBe(true)

      // Check current task name is displayed
      expect(wrapper.text()).toContain('Installing pack3')

      // Check progress counter (completed: 2 of 3)
      expect(wrapper.text()).toMatch(/2.*3/)

      // Check expand/collapse button exists
      const expandButton = wrapper.find('[aria-label="Expand"]')
      expect(expandButton.exists()).toBe(true)

      // Check Apply Changes button is NOT shown
      expect(wrapper.text()).not.toContain('manager.applyChanges')
    })

    it('should toggle expansion when expand button is clicked', async () => {
      mockComfyManagerStore.uncompletedCount = 1
      mockTaskLogs.push({ taskName: 'Installing', logs: [] })

      const wrapper = mountComponent()

      const expandButton = wrapper.find('[aria-label="Expand"]')
      await expandButton.trigger('click')

      expect(mockProgressDialogStore.toggle).toHaveBeenCalled()
    })
  })

  describe('State 2: Tasks Completed (Waiting for Restart)', () => {
    it('should display check mark and Apply Changes button when all tasks are done', async () => {
      // Setup tasks completed state
      mockComfyManagerStore.uncompletedCount = 0
      mockTaskLogs.push(
        { taskName: 'Installed pack1', logs: [] },
        { taskName: 'Installed pack2', logs: [] }
      )
      mockComfyManagerStore.allTasksDone = true

      const wrapper = mountComponent()

      // Check check mark emoji
      expect(wrapper.text()).toContain('✅')

      // Check restart message (split into 3 parts)
      expect(wrapper.text()).toContain('manager.clickToFinishSetup')
      expect(wrapper.text()).toContain('manager.applyChanges')
      expect(wrapper.text()).toContain('manager.toFinishSetup')

      // Check Apply Changes button exists
      const applyButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('manager.applyChanges'))
      expect(applyButton).toBeTruthy()

      // Check no progress counter
      expect(wrapper.text()).not.toMatch(/\d+.*of.*\d+/)
    })
  })

  describe('State 3: Restarting', () => {
    it('should display restarting message and spinner during restart', async () => {
      // Setup completed state first
      mockComfyManagerStore.uncompletedCount = 0
      mockComfyManagerStore.allTasksDone = true

      const wrapper = mountComponent()

      // Click Apply Changes to trigger restart
      const applyButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('manager.applyChanges'))
      await applyButton?.trigger('click')

      // Wait for state update
      await nextTick()

      // Check restarting message
      expect(wrapper.text()).toContain('manager.restartingBackend')

      // Check loading spinner during restart
      expect(wrapper.find('.inline-flex').exists()).toBe(true)

      // Check Apply Changes button is hidden
      expect(wrapper.text()).not.toContain('manager.applyChanges')
    })
  })

  describe('State 4: Restart Completed', () => {
    it('should display success message and auto-close after 3 seconds', async () => {
      vi.useFakeTimers()

      // Setup completed state
      mockComfyManagerStore.uncompletedCount = 0
      mockComfyManagerStore.allTasksDone = true

      const wrapper = mountComponent()

      // Trigger restart
      const applyButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('manager.applyChanges'))
      await applyButton?.trigger('click')

      // Wait for event listener to be set up
      await nextTick()

      // Trigger the reconnect handler directly
      if (reconnectHandler) {
        await reconnectHandler()
      }

      // Wait for restart completed state
      await nextTick()

      // Check success message
      expect(wrapper.text()).toContain('🎉')
      expect(wrapper.text()).toContain(
        'manager.extensionsSuccessfullyInstalled'
      )

      // Check dialog closes after 3 seconds
      vi.advanceTimersByTime(3000)

      await nextTick()

      expect(mockDialogStore.closeDialog).toHaveBeenCalledWith({
        key: 'global-manager-progress-dialog'
      })
      expect(mockComfyManagerStore.clearLogs).toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe('Common Features', () => {
    it('should always display close button', async () => {
      const wrapper = mountComponent()

      const closeButton = wrapper.find('[aria-label="Close"]')
      expect(closeButton.exists()).toBe(true)
    })

    it('should close dialog when close button is clicked', async () => {
      const wrapper = mountComponent()

      const closeButton = wrapper.find('[aria-label="Close"]')
      await closeButton.trigger('click')

      expect(mockDialogStore.closeDialog).toHaveBeenCalledWith({
        key: 'global-manager-progress-dialog'
      })
    })
  })

  describe('Toast Management', () => {
    it('should suppress reconnection toasts during restart', async () => {
      mockComfyManagerStore.uncompletedCount = 0
      mockComfyManagerStore.allTasksDone = true
      mockSettingStore.get.mockReturnValue(false) // Original setting

      const wrapper = mountComponent()

      // Click Apply Changes
      const applyButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('manager.applyChanges'))
      await applyButton?.trigger('click')

      // Check toast setting was disabled
      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.Toast.DisableReconnectingToast',
        true
      )
    })

    it('should restore toast settings after restart completes', async () => {
      mockComfyManagerStore.uncompletedCount = 0
      mockComfyManagerStore.allTasksDone = true
      mockSettingStore.get.mockReturnValue(false) // Original setting

      const wrapper = mountComponent()

      // Click Apply Changes
      const applyButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('manager.applyChanges'))
      await applyButton?.trigger('click')

      // Wait for event listener to be set up
      await nextTick()

      // Trigger the reconnect handler directly
      if (reconnectHandler) {
        await reconnectHandler()
      }

      // Wait for settings restoration
      await nextTick()

      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.Toast.DisableReconnectingToast',
        false // Restored to original
      )
    })
  })

  describe('Error Handling', () => {
    it('should restore state and close dialog on restart error', async () => {
      mockComfyManagerStore.uncompletedCount = 0
      mockComfyManagerStore.allTasksDone = true

      // Mock restart to throw error
      mockComfyManagerService.rebootComfyUI.mockRejectedValue(
        new Error('Restart failed')
      )

      const wrapper = mountComponent()

      // Click Apply Changes
      const applyButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('manager.applyChanges'))

      try {
        await applyButton?.trigger('click')
      } catch (error) {
        expect(error).toEqual(new Error('Restart failed'))
      }

      // Wait for error handling
      await nextTick()

      // Check dialog was closed on error
      expect(mockDialogStore.closeDialog).toHaveBeenCalled()
      // Check toast settings were restored
      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.Toast.DisableReconnectingToast',
        false
      )
    })
  })
})
