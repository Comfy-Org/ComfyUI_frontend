import type { Meta, StoryObj } from '@storybook/vue3-vite'

import RefreshButton from './RefreshButton.vue'

const meta: Meta<typeof RefreshButton> = {
  title: 'Components/Common/RefreshButton',
  component: RefreshButton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'RefreshButton is an interactive button with loading state management. It shows a refresh icon that transforms into a progress spinner when active, using v-model for state control.'
      }
    }
  },
  argTypes: {
    modelValue: {
      control: 'boolean',
      description: 'Active/loading state of the button (v-model)',
      defaultValue: false
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
      defaultValue: false
    },
    outlined: {
      control: 'boolean',
      description: 'Whether to use outlined button style',
      defaultValue: true
    },
    severity: {
      control: 'select',
      options: ['secondary', 'success', 'info', 'warn', 'help', 'danger'],
      description: 'PrimeVue severity level for button styling',
      defaultValue: 'secondary'
    },
    onRefresh: {
      description: 'Event emitted when button is clicked'
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof RefreshButton>

export const Default: Story = {
  render: (args) => ({
    components: { RefreshButton },
    setup() {
      return { args }
    },
    data() {
      return {
        isActive: args.modelValue || false
      }
    },
    methods: {
      handleRefresh() {
        console.log('Refresh clicked')
        this.isActive = true
        // Simulate async operation
        setTimeout(() => {
          this.isActive = false
        }, 2000)
      }
    },
    template: `
      <RefreshButton
        v-model="isActive"
        :disabled="args.disabled"
        :outlined="args.outlined"
        :severity="args.severity"
        @refresh="handleRefresh"
      />
    `
  }),
  args: {
    modelValue: false,
    disabled: false,
    outlined: true,
    severity: 'secondary'
  },
  parameters: {
    docs: {
      description: {
        story: 'Default refresh button - click to see loading animation for 2 seconds.'
      }
    }
  }
}

export const Active: Story = {
  render: (args) => ({
    components: { RefreshButton },
    setup() {
      return { args }
    },
    data() {
      return {
        isActive: true
      }
    },
    methods: {
      handleRefresh() {
        console.log('Refresh clicked')
      }
    },
    template: `
      <RefreshButton
        v-model="isActive"
        :disabled="args.disabled"
        :outlined="args.outlined"
        :severity="args.severity"
        @refresh="handleRefresh"
      />
    `
  }),
  args: {
    disabled: false,
    outlined: true,
    severity: 'secondary'
  },
  parameters: {
    docs: {
      description: {
        story: 'Refresh button in active/loading state showing progress spinner.'
      }
    }
  }
}

export const Disabled: Story = {
  render: (args) => ({
    components: { RefreshButton },
    setup() {
      return { args }
    },
    data() {
      return {
        isActive: false
      }
    },
    methods: {
      handleRefresh() {
        console.log('Refresh clicked')
      }
    },
    template: `
      <RefreshButton
        v-model="isActive"
        :disabled="args.disabled"
        :outlined="args.outlined"
        :severity="args.severity"
        @refresh="handleRefresh"
      />
    `
  }),
  args: {
    disabled: true,
    outlined: true,
    severity: 'secondary'
  },
  parameters: {
    docs: {
      description: {
        story: 'Disabled refresh button that cannot be clicked.'
      }
    }
  }
}

export const Filled: Story = {
  render: (args) => ({
    components: { RefreshButton },
    setup() {
      return { args }
    },
    data() {
      return {
        isActive: false
      }
    },
    methods: {
      handleRefresh() {
        console.log('Refresh clicked')
        this.isActive = true
        setTimeout(() => {
          this.isActive = false
        }, 2000)
      }
    },
    template: `
      <RefreshButton
        v-model="isActive"
        :disabled="args.disabled"
        :outlined="args.outlined"
        :severity="args.severity"
        @refresh="handleRefresh"
      />
    `
  }),
  args: {
    disabled: false,
    outlined: false,
    severity: 'secondary'
  },
  parameters: {
    docs: {
      description: {
        story: 'Filled (non-outlined) refresh button style.'
      }
    }
  }
}

export const SuccessSeverity: Story = {
  render: (args) => ({
    components: { RefreshButton },
    setup() {
      return { args }
    },
    data() {
      return {
        isActive: false
      }
    },
    methods: {
      handleRefresh() {
        console.log('Refresh clicked')
        this.isActive = true
        setTimeout(() => {
          this.isActive = false
        }, 2000)
      }
    },
    template: `
      <RefreshButton
        v-model="isActive"
        :disabled="args.disabled"
        :outlined="args.outlined"
        :severity="args.severity"
        @refresh="handleRefresh"
      />
    `
  }),
  args: {
    disabled: false,
    outlined: true,
    severity: 'success'
  },
  parameters: {
    docs: {
      description: {
        story: 'Refresh button with success severity (green color).'
      }
    }
  }
}

export const DangerSeverity: Story = {
  render: (args) => ({
    components: { RefreshButton },
    setup() {
      return { args }
    },
    data() {
      return {
        isActive: false
      }
    },
    methods: {
      handleRefresh() {
        console.log('Refresh clicked')
        this.isActive = true
        setTimeout(() => {
          this.isActive = false
        }, 2000)
      }
    },
    template: `
      <RefreshButton
        v-model="isActive"
        :disabled="args.disabled"
        :outlined="args.outlined"
        :severity="args.severity"
        @refresh="handleRefresh"
      />
    `
  }),
  args: {
    disabled: false,
    outlined: true,
    severity: 'danger'
  },
  parameters: {
    docs: {
      description: {
        story: 'Refresh button with danger severity (red color) for critical refresh actions.'
      }
    }
  }
}

// ComfyUI use case examples
export const WorkflowRefresh: Story = {
  render: () => ({
    components: { RefreshButton },
    data() {
      return {
        isRefreshing: false
      }
    },
    methods: {
      refreshWorkflows() {
        console.log('Refreshing workflows...')
        this.isRefreshing = true
        setTimeout(() => {
          this.isRefreshing = false
          console.log('Workflows refreshed!')
        }, 3000)
      }
    },
    template: `
      <div style="display: flex; align-items: center; gap: 12px; padding: 20px;">
        <span>Workflows:</span>
        <RefreshButton
          v-model="isRefreshing"
          @refresh="refreshWorkflows"
        />
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story: 'Example usage for refreshing workflows in ComfyUI interface.'
      }
    }
  }
}

export const ModelListRefresh: Story = {
  render: () => ({
    components: { RefreshButton },
    data() {
      return {
        isRefreshing: false
      }
    },
    methods: {
      refreshModels() {
        console.log('Refreshing model list...')
        this.isRefreshing = true
        setTimeout(() => {
          this.isRefreshing = false
          console.log('Models refreshed!')
        }, 2500)
      }
    },
    template: `
      <div style="display: flex; align-items: center; gap: 12px; padding: 20px;">
        <span>Model List:</span>
        <RefreshButton
          v-model="isRefreshing"
          severity="info"
          @refresh="refreshModels"
        />
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story: 'Example usage for refreshing model list with info severity.'
      }
    }
  }
}

// Gallery showing all severities
export const SeverityGallery: Story = {
  render: () => ({
    components: { RefreshButton },
    data() {
      return {
        states: {
          secondary: false,
          success: false,
          info: false,
          warn: false,
          help: false,
          danger: false
        }
      }
    },
    methods: {
      refresh(severity: string) {
        console.log(`Refreshing with ${severity} severity`)
        ;(this.states as any)[severity] = true
        setTimeout(() => {
          ;(this.states as any)[severity] = false
        }, 2000)
      }
    },
    template: `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 20px;">
        <div v-for="severity in ['secondary', 'success', 'info', 'warn', 'help', 'danger']" 
             :key="severity" 
             style="text-align: center;">
          <RefreshButton
            v-model="states[severity]"
            :severity="severity"
            @refresh="refresh(severity)"
          />
          <div style="margin-top: 8px; font-size: 12px; color: #666; text-transform: capitalize;">
            {{ severity }}
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story: 'Gallery showing all available severity levels with their colors.'
      }
    }
  }
}

export const StateComparison: Story = {
  render: () => ({
    components: { RefreshButton },
    data() {
      return {
        activeState: true,
        inactiveState: false,
        disabledState: false
      }
    },
    methods: {
      refresh(type: string) {
        console.log(`${type} refresh clicked`)
      }
    },
    template: `
      <div style="display: flex; align-items: center; gap: 20px; padding: 20px;">
        <div style="text-align: center;">
          <RefreshButton
            v-model="inactiveState"
            @refresh="refresh('inactive')"
          />
          <div style="margin-top: 8px; font-size: 12px; color: #666;">Inactive</div>
        </div>
        <div style="text-align: center;">
          <RefreshButton
            v-model="activeState"
            @refresh="refresh('active')"
          />
          <div style="margin-top: 8px; font-size: 12px; color: #666;">Active</div>
        </div>
        <div style="text-align: center;">
          <RefreshButton
            v-model="disabledState"
            :disabled="true"
            @refresh="refresh('disabled')"
          />
          <div style="margin-top: 8px; font-size: 12px; color: #666;">Disabled</div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story: 'Side-by-side comparison of different button states.'
      }
    }
  }
}