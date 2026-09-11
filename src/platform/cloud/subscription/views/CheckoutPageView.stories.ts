import type { Meta, StoryObj } from '@storybook/vue3-vite'

import SubscriptionRequiredDialogContentUnified from '@/platform/workspace/components/SubscriptionRequiredDialogContentUnified.vue'

/**
 * Standalone checkout page (prototype): the dialog subscribe flow lifted onto
 * a full page so every product can link one checkout URL instead of
 * duplicating the flow. Same content component as the dialog — logic and
 * outcome states are identical by construction; only the shell differs.
 */
const meta: Meta = {
  title: 'Views/CheckoutPage',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' }
}

export default meta
type Story = StoryObj<typeof meta>

function pageStory(initialPlanMode: 'personal' | 'team'): Story {
  return {
    render: () => ({
      components: { SubscriptionRequiredDialogContentUnified },
      setup() {
        return { initialPlanMode, noop: () => {} }
      },
      template: `
        <div class="flex min-h-screen w-screen items-center justify-center bg-base-background p-4 xl:p-10">
          <div class="relative flex max-h-[920px] min-h-0 w-full max-w-6xl flex-1 overflow-hidden rounded-2xl border border-interface-stroke bg-secondary-background shadow-xl">
            <SubscriptionRequiredDialogContentUnified
              :on-close="noop"
              :embedded-checkout-enabled="true"
              :initial-plan-mode="initialPlanMode"
            />
          </div>
        </div>
      `
    })
  }
}

export const PersonalPlans: Story = pageStory('personal')

export const TeamPlans: Story = pageStory('team')
