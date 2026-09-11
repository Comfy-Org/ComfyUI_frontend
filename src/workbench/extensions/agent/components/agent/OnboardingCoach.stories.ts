import type { Meta, StoryObj } from '@storybook/vue3-vite'

import '../../agentPanel.css'

import OnboardingCoach from './OnboardingCoach.vue'

const meta: Meta<typeof OnboardingCoach> = {
  title: 'Agent/OnboardingCoach',
  component: OnboardingCoach,
  parameters: { layout: 'fullscreen' },
  args: {
    step: {
      target: '#agent-coach-target',
      title: 'Meet Comfy Agent',
      body: 'Describe your idea to build and edit a workflow with the agent.'
    },
    storageKey: 'storybook-agent-onboarding'
  },
  render: (args) => ({
    components: { OnboardingCoach },
    setup() {
      localStorage.removeItem('storybook-agent-onboarding')
      return { args }
    },
    template: `
      <div id="agent-coach-target" class="agent-scope ml-auto h-screen w-100 bg-base-background">
        <OnboardingCoach v-bind="args" />
      </div>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
