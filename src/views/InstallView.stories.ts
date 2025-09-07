// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj } from '@storybook/vue3'
import { provide } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import InstallView from './InstallView.vue'

// Create a mock router for stories
const createMockRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      {
        path: '/server-start',
        component: { template: '<div>Server Start</div>' }
      },
      {
        path: '/manual-configuration',
        component: { template: '<div>Manual Configuration</div>' }
      }
    ]
  })

const meta: Meta<typeof InstallView> = {
  title: 'Views/InstallView',
  component: InstallView,
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
  },
  decorators: [
    (story) => {
      // Mock electron API
      ;(window as any).electronAPI = {
        getPlatform: () => 'darwin',
        Config: {
          getDetectedGpu: () => Promise.resolve('mps')
        },
        Events: {
          trackEvent: (eventName: string, data?: any) => {
            console.log('Track event:', eventName, data)
          }
        },
        installComfyUI: (options: any) => {
          console.log('Install ComfyUI with options:', options)
        },
        changeTheme: (theme: any) => {
          console.log('Change theme:', theme)
        },
        getSystemPaths: () =>
          Promise.resolve({
            defaultInstallPath: '/Users/username/ComfyUI'
          }),
        validateInstallPath: () =>
          Promise.resolve({
            isValid: true,
            exists: false,
            canWrite: true,
            freeSpace: 100000000000,
            requiredSpace: 10000000000,
            isNonDefaultDrive: false
          }),
        validateComfyUISource: () =>
          Promise.resolve({
            isValid: true
          }),
        showDirectoryPicker: () => Promise.resolve('/Users/username/ComfyUI')
      }

      return {
        setup() {
          return {
            story
          }
        },
        template: '<div style="width: 100vw; height: 100vh;"><story /></div>'
      }
    }
  ]
}

export default meta
type Story = StoryObj<typeof meta>

// Default story - start at GPU selection
export const GpuSelection: Story = {
  render: () => {
    const router = createMockRouter()

    return {
      components: { InstallView },
      setup() {
        // Provide router to child components
        provide('router', router)
        // The component will automatically start at step 1
        return {}
      },
      template: '<InstallView />'
    }
  }
}

// Story showing the install location step
export const InstallLocation: Story = {
  render: () => {
    const router = createMockRouter()

    return {
      components: { InstallView },
      setup() {
        // Provide router to child components
        provide('router', router)
        // We'll programmatically advance to step 2 after mount
        return {}
      },
      mounted() {
        // Set the device first to enable navigation
        const component = this.$el.querySelector(
          '[data-pc-name="stepper"]'
        )?.__vueParentComponent
        if (component) {
          component.ctx.device = 'mps'
          component.ctx.currentStep = '2'
          component.ctx.highestStep = 2
        }
      },
      template: '<InstallView />'
    }
  }
}

// Story showing the migration step (currently empty)
export const MigrationStep: Story = {
  render: () => {
    const router = createMockRouter()

    return {
      components: { InstallView },
      setup() {
        // Provide router to child components
        provide('router', router)
        return {}
      },
      mounted() {
        // Set the device and path to enable navigation
        const component = this.$el.querySelector(
          '[data-pc-name="stepper"]'
        )?.__vueParentComponent
        if (component) {
          component.ctx.device = 'mps'
          component.ctx.installPath = '/Users/username/ComfyUI'
          component.ctx.currentStep = '3'
          component.ctx.highestStep = 3
        }
      },
      template: '<InstallView />'
    }
  }
}

// Story showing the desktop settings configuration
export const DesktopSettings: Story = {
  render: () => {
    const router = createMockRouter()

    return {
      components: { InstallView },
      setup() {
        // Provide router to child components
        provide('router', router)
        return {}
      },
      mounted() {
        // Set all required data to reach the settings step
        const component = this.$el.querySelector(
          '[data-pc-name="stepper"]'
        )?.__vueParentComponent
        if (component) {
          component.ctx.device = 'mps'
          component.ctx.installPath = '/Users/username/ComfyUI'
          component.ctx.currentStep = '4'
          component.ctx.highestStep = 4
        }
      },
      template: '<InstallView />'
    }
  }
}

// Story with Windows platform (no Apple Metal option)
export const WindowsPlatform: Story = {
  render: () => {
    const router = createMockRouter()

    // Override the platform to Windows
    ;(window as any).electronAPI.getPlatform = () => 'win32'
    ;(window as any).electronAPI.Config.getDetectedGpu = () =>
      Promise.resolve('nvidia')

    return {
      components: { InstallView },
      setup() {
        // Provide router to child components
        provide('router', router)
        return {}
      },
      template: '<InstallView />'
    }
  }
}

// Story with CPU selected
export const CpuSelected: Story = {
  render: () => {
    const router = createMockRouter()

    return {
      components: { InstallView },
      setup() {
        // Provide router to child components
        provide('router', router)
        return {}
      },
      mounted() {
        // Select CPU option
        const component = this.$el.querySelector(
          '[data-pc-name="stepper"]'
        )?.__vueParentComponent
        if (component) {
          component.ctx.device = 'cpu'
        }
      },
      template: '<InstallView />'
    }
  }
}

// Story with manual install selected
export const ManualInstall: Story = {
  render: () => {
    const router = createMockRouter()

    return {
      components: { InstallView },
      setup() {
        // Provide router to child components
        provide('router', router)
        return {}
      },
      mounted() {
        // Select manual install option
        const component = this.$el.querySelector(
          '[data-pc-name="stepper"]'
        )?.__vueParentComponent
        if (component) {
          component.ctx.device = 'unsupported'
        }
      },
      template: '<InstallView />'
    }
  }
}

// Story with error state (invalid install path)
export const ErrorState: Story = {
  render: () => {
    const router = createMockRouter()

    // Override validation to return an error
    ;(window as any).electronAPI.validateInstallPath = () =>
      Promise.resolve({
        isValid: false,
        exists: false,
        canWrite: false,
        freeSpace: 100000000000,
        requiredSpace: 10000000000,
        isNonDefaultDrive: false,
        error: 'Permission denied: Cannot write to this directory'
      })

    return {
      components: { InstallView },
      setup() {
        // Provide router to child components
        provide('router', router)
        return {}
      },
      mounted() {
        // Navigate to install location step with error
        const component = this.$el.querySelector(
          '[data-pc-name="stepper"]'
        )?.__vueParentComponent
        if (component) {
          component.ctx.device = 'mps'
          component.ctx.currentStep = '2'
          component.ctx.highestStep = 2
          component.ctx.pathError =
            'Permission denied: Cannot write to this directory'
        }
      },
      template: '<InstallView />'
    }
  }
}

// Story showing complete flow ready to install
export const ReadyToInstall: Story = {
  render: () => {
    const router = createMockRouter()

    return {
      components: { InstallView },
      setup() {
        // Provide router to child components
        provide('router', router)
        return {}
      },
      mounted() {
        // Set all data as if user completed all steps
        const component = this.$el.querySelector(
          '[data-pc-name="stepper"]'
        )?.__vueParentComponent
        if (component) {
          component.ctx.device = 'mps'
          component.ctx.installPath = '/Users/username/ComfyUI'
          component.ctx.autoUpdate = true
          component.ctx.allowMetrics = true
          component.ctx.migrationSourcePath = '/Users/username/ComfyUI-old'
          component.ctx.migrationItemIds = ['models', 'custom_nodes']
          component.ctx.currentStep = '4'
          component.ctx.highestStep = 4
        }
      },
      template: '<InstallView />'
    }
  }
}

// Interactive story that allows full navigation
export const Interactive: Story = {
  render: () => {
    const router = createMockRouter()

    return {
      components: { InstallView },
      setup() {
        // Provide router to child components
        provide('router', router)
        // This story allows full interaction through all steps
        return {}
      },
      template: '<InstallView />'
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'Fully interactive installation wizard. You can navigate through all steps, select options, and see how the flow works.'
      }
    }
  }
}
