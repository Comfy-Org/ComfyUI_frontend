import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { useOnboardingEntryStore } from '@/platform/workflow/persistence/onboardingEntryStore'

import GettingStartedScreen from './GettingStartedScreen.vue'

const meta: Meta<typeof GettingStartedScreen> = {
  title: 'Renderer/OnboardingTour/GettingStartedScreen',
  component: GettingStartedScreen,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' }
  },
  decorators: [
    () => {
      useOnboardingEntryStore().showGettingStarted()
      // Template cards need the served template package; without a backend the
      // curated lookups return nothing, so this catalogs the screen chrome
      // (heading, tabs, placeholders). Card rendering is covered by the unit
      // test.
      return { template: '<story />' }
    }
  ]
}

export default meta
type Story = StoryObj<typeof meta>

const render: Story['render'] = () => ({
  components: { GettingStartedScreen },
  template: '<GettingStartedScreen />'
})

export const Default: Story = { render }
