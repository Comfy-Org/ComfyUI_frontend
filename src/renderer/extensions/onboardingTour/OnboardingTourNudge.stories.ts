import type { Meta, StoryObj } from '@storybook/vue3-vite'

import OnboardingTourNudge from './OnboardingTourNudge.vue'
import { useOnboardingTourStore } from './onboardingTourStore'

const SAMPLE_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="100%" height="100%" fill="%234f46e5"/></svg>'
  )

const meta: Meta<typeof OnboardingTourNudge> = {
  title: 'Renderer/OnboardingTour/OnboardingTourNudge',
  component: OnboardingTourNudge,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' }
  },
  decorators: [
    () => {
      const store = useOnboardingTourStore()
      store.resultMedia = { url: SAMPLE_IMAGE, kind: 'image' }
      store.showNudge()
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
