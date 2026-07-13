import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { toNodeId } from '@/types/nodeId'

import OnboardingTourOverlay from './OnboardingTourOverlay.vue'
import { useOnboardingTourStore } from './onboardingTourStore'
import type { TourStep } from './tourSequence'

interface StoryArgs {
  stepIndex: number
  revealedCount: number
}

const SAMPLE_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="100%" height="100%" fill="%234f46e5"/></svg>'
  )

const steps: TourStep[] = [
  { kind: 'upload', nodeId: toNodeId(1) },
  {
    kind: 'prompt',
    nodeId: null,
    prompt: {
      subgraphNodeId: toNodeId(2),
      innerNodeId: toNodeId(3),
      widgetName: 'text',
      portFallback: 'prompt'
    }
  },
  { kind: 'run', nodeId: null },
  { kind: 'result', nodeId: toNodeId(4), mediaKind: 'image' }
]

const meta: Meta<StoryArgs> = {
  title: 'Renderer/OnboardingTour/OnboardingTourOverlay',
  component: OnboardingTourOverlay,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' }
  },
  argTypes: {
    stepIndex: { control: { type: 'number', min: 0, max: 3 } },
    revealedCount: { control: { type: 'number', min: 0, max: 4 } }
  },
  decorators: [
    (_, context) => {
      const store = useOnboardingTourStore()
      store.phase = 'active'
      store.steps = steps
      store.stepIndex = context.args.stepIndex
      store.revealedNodeIds = new Set(
        Array.from({ length: context.args.revealedCount }, (_, i) =>
          toNodeId(i + 1)
        )
      )
      const activeStep = steps[context.args.stepIndex]
      store.resultMedia =
        activeStep?.kind === 'result'
          ? { url: SAMPLE_IMAGE, kind: activeStep.mediaKind ?? 'image' }
          : null
      // Spotlight geometry needs a live litegraph canvas (absent in Storybook),
      // so holes are exercised by the unit test; this catalogs the coach-mark.
      return { template: '<story />' }
    }
  ]
}

export default meta
type Story = StoryObj<typeof meta>

const render: Story['render'] = () => ({
  components: { OnboardingTourOverlay },
  template: '<OnboardingTourOverlay />'
})

export const FirstStep: Story = {
  args: { stepIndex: 0, revealedCount: 1 },
  render
}

export const MultiReveal: Story = {
  args: { stepIndex: 1, revealedCount: 2 },
  render
}

export const LastStep: Story = {
  args: { stepIndex: 3, revealedCount: 1 },
  render
}
