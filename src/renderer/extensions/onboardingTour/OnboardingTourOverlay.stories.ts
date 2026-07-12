import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { toNodeId } from '@/types/nodeId'

import OnboardingTourOverlay from './OnboardingTourOverlay.vue'
import { useOnboardingTourStore } from './onboardingTourStore'

interface StoryArgs {
  totalSteps: number
  stepIndex: number
  revealedCount: number
}

const meta: Meta<StoryArgs> = {
  title: 'Renderer/OnboardingTour/OnboardingTourOverlay',
  component: OnboardingTourOverlay,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' }
  },
  argTypes: {
    totalSteps: { control: { type: 'number', min: 1, max: 6 } },
    stepIndex: { control: { type: 'number', min: 0, max: 5 } },
    revealedCount: { control: { type: 'number', min: 0, max: 4 } }
  },
  decorators: [
    (_, context) => {
      const store = useOnboardingTourStore()
      store.phase = 'active'
      store.stepIndex = context.args.stepIndex
      store.revealedNodeIds = new Set(
        Array.from({ length: context.args.revealedCount }, (_, i) =>
          toNodeId(i + 1)
        )
      )
      // Spotlight geometry needs a live litegraph canvas (absent in Storybook),
      // so holes are exercised by the unit test; this catalogs the coach-mark.
      return { template: '<story />' }
    }
  ]
}

export default meta
type Story = StoryObj<typeof meta>

const render: Story['render'] = (args) => ({
  components: { OnboardingTourOverlay },
  setup() {
    return { args }
  },
  template: `
    <OnboardingTourOverlay :totalSteps="args.totalSteps">
      <template #content>
        <p class="text-base font-semibold text-base-foreground">Tell it what to make</p>
        <p class="text-sm text-muted-foreground">
          This prompt reshapes the image: same style, new subject. This line is yours to change.
        </p>
      </template>
      <template #actions>
        <button type="button" class="text-xs font-medium text-base-foreground">Next</button>
      </template>
    </OnboardingTourOverlay>
  `
})

export const FirstStep: Story = {
  args: { totalSteps: 4, stepIndex: 0, revealedCount: 1 },
  render
}

export const MultiReveal: Story = {
  args: { totalSteps: 4, stepIndex: 1, revealedCount: 2 },
  render
}

export const LastStep: Story = {
  args: { totalSteps: 4, stepIndex: 3, revealedCount: 1 },
  render
}
