import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import ManagerProgressFooter from '@/workbench/extensions/manager/components/ManagerProgressFooter.vue'
import { useComfyManagerService } from '@/workbench/extensions/manager/services/comfyManagerService'
import {
  useComfyManagerStore,
  useManagerProgressDialogStore
} from '@/workbench/extensions/manager/stores/comfyManagerStore'
import type { TaskLog } from '@/workbench/extensions/manager/types/comfyManagerTypes'

// Mock modules
vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore')
vi.mock('@/stores/dialogStore')
vi.mock('@/platform/settings/settingStore')
vi.mock('@/stores/commandStore')
vi.mock('@/workbench/extensions/manager/services/comfyManagerService')
vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: vi.fn(() => ({
      conflictedPackages: { value: [] },
      runFullConflictAnalysis: vi.fn().mockResolvedValue(undefined)
    }))
  })
)

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
vi.mock('@/platform/workflow/core/services/workflowService', () => ({
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
const mountComponent = (options: { captureError?: boolean } = {}) => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: {
          progressCountOf: 'of'
        },
        manager: {
          clickToFinishSetup: 'Click',
          applyChanges: 'Apply Changes',
          toFinishSetup: 'to finish setup',
          restartingBackend: 'Restarting backend to apply changes...',
          extensionsSuccessfullyInstalled:
            'Extension(s) successfully installed and are ready to use!',
          restartToApplyChanges: 'To apply changes, please restart ComfyUI',
          installingDependencies: 'Installing dependencies...'
        }
      }
    }
  })

  const config: any = {
    global: {
      plugins: [pinia, PrimeVue, i18n]
    }
  }

  // Add error handler for tests that expect errors
  if (options.captureError) {
    config.global.config = {
      errorHandler: () => {
        // Suppress error in test
      }
    }
  }

  return mount(ManagerProgressFooter, config)
}

describe('ManagerProgressFooter', () => {
  const mockTaskLogs: TaskLog[] = []

  const mockComfyManagerStore = {
    taskLogs: mockTaskLogs,
    allTasksDone: true,
    isProcessingTasks: false,
    succeededTasksIds: [] as string[],
    failedTasksIds: [] as string[],
    taskHistory: {} as Record<string, any>,
    taskQueue: null,
    resetTaskState: vi.fn(),
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
    // Create new pinia instance for each test
    const pinia = createPinia()
    setActivePinia(pinia)

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
      mockComfyManagerStore.isProcessingTasks = true
      mockComfyManagerStore.succeededTasksIds = ['1', '2']
      mockComfyManagerStore.failedTasksIds = []
      mockComfyManagerStore.taskHistory = {
        '1': { taskName: 'Installing pack1' },
        '2': { taskName: 'Installing pack2' },
        '3': { taskName: 'Installing pack3' }
      }
      mockTaskLogs.push(
        { taskName: 'Installing pack1', taskId: '1', logs: [] },
        { taskName: 'Installing pack2', taskId: '2', logs: [] },
        { taskName: 'Installing pack3', taskId: '3', logs: [] }
      )

      const wrapper = mountComponent()

      // Check loading spinner exists (DotSpinner component)
      expect(wrapper.find('.inline-flex').exists()).toBe(true)

      // Check current task name is displayed
      expect(wrapper.text()).toContain('Installing pack3')

      // Check progress counter (completed: 2 of 3)
      expect(wrapper.text()).toMatch(/2.*of.*3/)

      // Check expand/collapse button exists
      const expandButton = wrapper.find('[aria-label="Expand"]')
      expect(expandButton.exists()).toBe(true)

      // Check Apply Changes button is NOT shown
      expect(wrapper.text()).not.toContain('Apply Changes')
    })

    it('should toggle expansion when expand button is clicked', async () => {
      mockComfyManagerStore.isProcessingTasks = true
      mockTaskLogs.push({ taskName: 'Installing', taskId: '1', logs: [] })

      const wrapper = mountComponent()

      const expandButton = wrapper.find('[aria-label="Expand"]')
      await expandButton.trigger('click')

      expect(mockProgressDialogStore.toggle).toHaveBeenCalled()
    })
  })

  describe('State 2: Tasks Completed (Waiting for Restart)', () => {
    it('should display check mark and Apply Changes button when all tasks are done', async () => {
      // Setup tasks completed state
      mockComfyManagerStore.isProcessingTasks = false
      mockTaskLogs.push(
        { taskName: 'Installed pack1', taskId: '1', logs: [] },
        { taskName: 'Installed pack2', taskId: '2', logs: [] }
      )
      mockComfyManagerStore.allTasksDone = true

      const wrapper = mountComponent()

      // Check check mark emoji
      expect(wrapper.text()).toContain('✅')

      // Check restart message
      expect(wrapper.text()).toContain(
        'To apply changes, please restart ComfyUI'
      )
      expect(wrapper.text()).toContain('Apply Changes')

      // Check Apply Changes button exists
      const applyButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('Apply Changes'))
      expect(applyButton).toBeTruthy()

      // Check no progress counter
      expect(wrapper.text()).not.toMatch(/\d+.*of.*\d+/)
    })
  })

  describe('State 3: Restarting', () => {
    it('should display restarting message and spinner during restart', async () => {
      // Setup completed state first
      mockComfyManagerStore.isProcessingTasks = false
      mockComfyManagerStore.allTasksDone = true

      const wrapper = mountComponent()

      // Click Apply Changes to trigger restart
      const applyButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('Apply Changes'))
      await applyButton?.trigger('click')

      // Wait for state update
      await nextTick()

      // Check restarting message
      expect(wrapper.text()).toContain('Restarting backend to apply changes...')

      // Check loading spinner during restart
      expect(wrapper.find('.inline-flex').exists()).toBe(true)

      // Check Apply Changes button is hidden
      expect(wrapper.text()).not.toContain('Apply Changes')
    })
  })

  describe('State 4: Restart Completed', () => {
    it('should display success message and auto-close after 3 seconds', async () => {
      vi.useFakeTimers()

      // Setup completed state
      mockComfyManagerStore.isProcessingTasks = false
      mockComfyManagerStore.allTasksDone = true

      const wrapper = mountComponent()

      // Trigger restart
      const applyButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('Apply Changes'))
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
        'Extension(s) successfully installed and are ready to use!'
      )

      // Check dialog closes after 3 seconds
      vi.advanceTimersByTime(3000)

      await nextTick()

      expect(mockDialogStore.closeDialog).toHaveBeenCalledWith({
        key: 'global-manager-progress-dialog'
      })
      expect(mockComfyManagerStore.resetTaskState).toHaveBeenCalled()

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
      mockComfyManagerStore.isProcessingTasks = false
      mockComfyManagerStore.allTasksDone = true
      mockSettingStore.get.mockReturnValue(false) // Original setting

      const wrapper = mountComponent()

      // Click Apply Changes
      const applyButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('Apply Changes'))
      await applyButton?.trigger('click')

      // Check toast setting was disabled
      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.Toast.DisableReconnectingToast',
        true
      )
    })

    it('should restore toast settings after restart completes', async () => {
      mockComfyManagerStore.isProcessingTasks = false
      mockComfyManagerStore.allTasksDone = true
      mockSettingStore.get.mockReturnValue(false) // Original setting

      const wrapper = mountComponent()

      // Click Apply Changes
      const applyButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('Apply Changes'))
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
      mockComfyManagerStore.isProcessingTasks = false
      mockComfyManagerStore.allTasksDone = true

      // Mock restart to throw error
      mockComfyManagerService.rebootComfyUI.mockRejectedValue(
        new Error('Restart failed')
      )

      const wrapper = mountComponent({ captureError: true })

      // Click Apply Changes
      const applyButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('Apply Changes'))

      expect(applyButton).toBeTruthy()

      // The component throws the error but Vue Test Utils catches it
      // We need to check if the error handling logic was executed
      await applyButton!.trigger('click').catch(() => {
        // Error is expected, ignore it
      })

      // Wait for error handling
      await nextTick()

      // Check dialog was closed on error
      expect(mockDialogStore.closeDialog).toHaveBeenCalled()
      // Check toast settings were restored
      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.Toast.DisableReconnectingToast',
        false
      )
      // Check that the error handler was called
      expect(mockComfyManagerService.rebootComfyUI).toHaveBeenCalled()
    })
  })
})
