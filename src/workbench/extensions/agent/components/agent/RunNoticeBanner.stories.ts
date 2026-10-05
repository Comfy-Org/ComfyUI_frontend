import type { Meta, StoryObj } from '@storybook/vue3-vite'

import '../../agentPanel.css'

import RunNoticeBanner from './RunNoticeBanner.vue'

const DISMISSED_STORAGE_KEY = 'Comfy.AgentPanel.runNoticeDismissed'

// The banner hides itself for good once dismissed, and the flag is shared
// localStorage rather than a prop. Clearing it per story keeps a dismissal in
// one story from blanking every later snapshot.
function withFreshDismissal() {
  localStorage.removeItem(DISMISSED_STORAGE_KEY)
  return {
    template:
      '<div class="agent-scope w-[388px] bg-secondary-background p-4"><story /></div>'
  }
}

const meta: Meta<typeof RunNoticeBanner> = {
  title: 'Agent/RunNoticeBanner',
  component: RunNoticeBanner,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  globals: { theme: 'dark' },
  decorators: [withFreshDismissal]
}

export default meta
type Story = StoryObj<typeof meta>

/** No target bound yet, so the generic run-permissions copy renders. */
export const Default: Story = {}

export const Expanded: Story = {
  args: { expanded: true }
}

export const BoundToWorkflow: Story = {
  args: { workflowName: 'portrait' }
}

/**
 * The name is underlined inline, so a long one has to wrap inside the panel
 * without pushing the dismiss button off the row.
 */
export const LongWorkflowName: Story = {
  args: { workflowName: 'product-photo-upscale-with-face-restore-v3' }
}

// The left rule and the icon are the two neutral marks on the card, and both
// have to stay legible when base-background flips. Light covers the half that
// the dark-default stories above do not.
export const DefaultLight: Story = {
  globals: { theme: 'light' }
}

export const BoundToWorkflowLight: Story = {
  args: { workflowName: 'portrait' },
  globals: { theme: 'light' }
}
