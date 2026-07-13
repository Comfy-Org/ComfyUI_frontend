import type { Meta, StoryObj } from '@storybook/vue3-vite'

import OnboardingTourNudge from './OnboardingTourNudge.vue'
import { useOnboardingTourStore } from './onboardingTourStore'

const meta: Meta<typeof OnboardingTourNudge> = {
  title: 'Renderer/OnboardingTour/OnboardingTourNudge',
  component: OnboardingTourNudge,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' }
  },
  decorators: [
    () => {
      useOnboardingTourStore().showNudge()
      return { template: '<story />' }
    }
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { OnboardingTourNudge },
    template: '<OnboardingTourNudge />'
  })
}
