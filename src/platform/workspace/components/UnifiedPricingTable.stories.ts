import type { Meta, StoryObj } from '@storybook/vue3-vite'

import UnifiedPricingTable from './UnifiedPricingTable.vue'

/**
 * The unified pricing table (B4 / FE-934): one table for the new billing model,
 * with a personal/team **plan** toggle on a single workspace (Gamma-style).
 *
 * Note: the personal/team toggle itself only renders when `teamWorkspacesEnabled`
 * is on (a server flag, off in Storybook), so these stories drive the view via
 * `initialPlanMode` instead. Personal prices fall back to the static
 * `TIER_PRICING` (no API in Storybook); the team column uses the locked DES-197
 * credit-slider stops.
 */
const meta: Meta<typeof UnifiedPricingTable> = {
  title: 'Components/UnifiedPricingTable',
  component: UnifiedPricingTable,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    initialPlanMode: {
      control: 'inline-radio',
      options: ['personal', 'team']
    }
  },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="mx-auto max-w-[1328px] bg-base-background p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

/** Personal plans (Standard / Creator / Pro) with the monthly/yearly toggle. */
export const Personal: Story = {
  args: { initialPlanMode: 'personal' }
}

/** Team plan: the credit slider + Enterprise card. */
export const TeamPlan: Story = {
  args: { initialPlanMode: 'team' }
}
