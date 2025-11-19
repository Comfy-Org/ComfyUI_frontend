// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj } from '@storybook/vue3'
import { defineAsyncComponent } from 'vue'

type UnsafeReason = 'appInstallDir' | 'updaterCache' | 'oneDrive' | null

type ValidationState = {
  unsafeBasePath: boolean
  unsafeBasePathReason: UnsafeReason
}

const validationState: ValidationState = {
  unsafeBasePath: false,
  unsafeBasePathReason: null
}

const createMockElectronAPI = () => {
  const logListeners: Array<(message: string) => void> = []

  const getValidationUpdate = () => ({
    inProgress: false,
    unsafeBasePath: validationState.unsafeBasePath,
    unsafeBasePathReason: validationState.unsafeBasePathReason
  })

  return {
    getPlatform: () => 'darwin',
    changeTheme: (_theme: unknown) => {},
    onLogMessage: (listener: (message: string) => void) => {
      logListeners.push(listener)
    },
    showContextMenu: (_options: unknown) => {},
    Events: {
      trackEvent: (_eventName: string, _data?: unknown) => {}
    },
    Validation: {
      onUpdate: (_callback: (update: unknown) => void) => {},
      async getStatus() {
        return getValidationUpdate()
      },
      async validateInstallation(callback: (update: unknown) => void) {
        callback(getValidationUpdate())
      },
      async complete() {
        // Only allow completion when the base path is safe
        return !validationState.unsafeBasePath
      },
      dispose: () => {}
    },
    setBasePath: () => Promise.resolve(true),
    reinstall: () => Promise.resolve(),
    uv: {
      installRequirements: () => Promise.resolve(),
      clearCache: () => Promise.resolve(),
      resetVenv: () => Promise.resolve()
    }
  }
}

const ensureElectronAPI = () => {
  const globalWindow = window as unknown as { electronAPI?: unknown }
  if (!globalWindow.electronAPI) {
    globalWindow.electronAPI = createMockElectronAPI()
  }

  return globalWindow.electronAPI
}

const MaintenanceView = defineAsyncComponent(async () => {
  ensureElectronAPI()
  const module = await import('./MaintenanceView.vue')
  return module.default
})

const meta: Meta<typeof MaintenanceView> = {
  title: 'Desktop/Views/MaintenanceView',
  component: MaintenanceView,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0a0a0a' },
        { name: 'neutral-900', value: '#171717' },
        { name: 'neutral-950', value: '#0a0a0a' }
      ]
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'All tasks OK',
  render: () => ({
    components: { MaintenanceView },
    setup() {
      validationState.unsafeBasePath = false
      validationState.unsafeBasePathReason = null
      ensureElectronAPI()
      return {}
    },
    template: '<MaintenanceView />'
  })
}

export const UnsafeBasePathOneDrive: Story = {
  name: 'Unsafe base path (OneDrive)',
  render: () => ({
    components: { MaintenanceView },
    setup() {
      validationState.unsafeBasePath = true
      validationState.unsafeBasePathReason = 'oneDrive'
      ensureElectronAPI()
      return {}
    },
    template: '<MaintenanceView />'
  })
}
