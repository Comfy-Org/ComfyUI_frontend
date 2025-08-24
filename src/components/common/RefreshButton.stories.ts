import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

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
      description: 'Active/loading state of the button (v-model)'
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled'
    },
    outlined: {
      control: 'boolean',
      description: 'Whether to use outlined button style'
    },
    severity: {
      control: 'select',
      options: ['secondary', 'success', 'info', 'warn', 'help', 'danger'],
      description: 'PrimeVue severity level for button styling'
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof RefreshButton>

const createStoryRender =
  (initialState = false, asyncDuration = 2000) =>
  (args: any) => ({
    components: { RefreshButton },
    setup() {
      const isActive = ref(args.modelValue ?? initialState)
      const actions = ref<string[]>([])

      const logAction = (action: string) => {
        const timestamp = new Date().toLocaleTimeString()
        actions.value.unshift(`${action} (${timestamp})`)
        if (actions.value.length > 5) actions.value.pop()
        console.log(action)
      }

      const handleRefresh = async () => {
        logAction('Refresh started')
        isActive.value = true
        await new Promise((resolve) => setTimeout(resolve, asyncDuration))
        isActive.value = false
        logAction('Refresh completed')
      }

      return { args, isActive, actions, handleRefresh }
    },
    template: `
    <div style="padding: 20px;">
      <RefreshButton
        v-model="isActive"
        v-bind="args"
        @refresh="handleRefresh"
      />
      <div v-if="actions.length > 0" style="margin-top: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; font-family: monospace; font-size: 12px;">
        <div style="font-weight: bold; margin-bottom: 8px;">Actions Log:</div>
        <div v-for="action in actions" :key="action" style="margin: 2px 0;">{{ action }}</div>
      </div>
    </div>
  `
  })

export const Default: Story = {
  render: createStoryRender(),
  args: {
    modelValue: false,
    disabled: false,
    outlined: true,
    severity: 'secondary'
  }
}

export const Active: Story = {
  render: createStoryRender(true),
  args: {
    disabled: false,
    outlined: true,
    severity: 'secondary'
  }
}

export const Disabled: Story = {
  render: createStoryRender(),
  args: {
    disabled: true,
    outlined: true,
    severity: 'secondary'
  }
}

export const Filled: Story = {
  render: createStoryRender(),
  args: {
    disabled: false,
    outlined: false,
    severity: 'secondary'
  }
}

export const SuccessSeverity: Story = {
  render: createStoryRender(),
  args: {
    disabled: false,
    outlined: true,
    severity: 'success'
  }
}

export const DangerSeverity: Story = {
  render: createStoryRender(),
  args: {
    disabled: false,
    outlined: true,
    severity: 'danger'
  }
}

// Simplified gallery showing all severities
export const SeverityGallery: Story = {
  render: () => ({
    components: { RefreshButton },
    setup() {
      const severities = [
        'secondary',
        'success',
        'info',
        'warn',
        'help',
        'danger'
      ]
      const states = ref(Object.fromEntries(severities.map((s) => [s, false])))

      const refresh = async (severity: string) => {
        console.log(`Refreshing with ${severity} severity`)
        states.value[severity] = true
        await new Promise((resolve) => setTimeout(resolve, 2000))
        states.value[severity] = false
      }

      return { severities, states, refresh }
    },
    template: `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 20px;">
        <div v-for="severity in severities" :key="severity" style="text-align: center;">
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
  })
}

// ComfyUI usage examples
export const WorkflowRefresh: Story = {
  render: () => ({
    components: { RefreshButton },
    setup() {
      const isRefreshing = ref(false)

      const refreshWorkflows = async () => {
        console.log('Refreshing workflows...')
        isRefreshing.value = true
        await new Promise((resolve) => setTimeout(resolve, 3000))
        isRefreshing.value = false
        console.log('Workflows refreshed!')
      }

      return { isRefreshing, refreshWorkflows }
    },
    template: `
      <div style="display: flex; align-items: center; gap: 12px; padding: 20px;">
        <span>Workflows:</span>
        <RefreshButton v-model="isRefreshing" @refresh="refreshWorkflows" />
      </div>
    `
  })
}
