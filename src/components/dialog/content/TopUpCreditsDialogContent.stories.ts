import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import TopUpCreditsDialogContent from './TopUpCreditsDialogContent.vue'

interface TopUpCreditsStoryArgs {
  refreshDate?: string
  isInsufficientCredits?: boolean
  subscriptionTiersEnabled?: boolean
}

const meta: Meta<TopUpCreditsStoryArgs> = {
  title: 'Components/Dialog/TopUpCreditsDialogContent',
  component: TopUpCreditsDialogContent,
  argTypes: {
    refreshDate: {
      control: 'text',
      description: 'Date when credits refresh'
    },
    isInsufficientCredits: {
      control: 'boolean',
      description: 'Show insufficient credits message (legacy design only)'
    },
    subscriptionTiersEnabled: {
      control: 'boolean',
      description: 'Feature flag to control design (new vs legacy)'
    }
  },
  parameters: {
    docs: {
      description: {
        component:
          'Credit top-up dialog content. Design is controlled by the `subscription_tiers_enabled` feature flag (defaults to new design).'
      }
    }
  },
  decorators: [
    (_story) => {
      // Mock the Firebase Auth store with realistic data
      const authStore = useFirebaseAuthStore()

      // Set up mock balance data - using cents as the backend actually sends
      authStore.balance = {
        amount_micros: 1055, // 10.55 USD worth = 2226 credits
        cloud_credit_balance_micros: 422, // 4.22 USD worth
        prepaid_balance_micros: 211, // 2.11 USD worth
        currency: 'USD'
      }
      authStore.isFetchingBalance = false

      return {
        template: `
          <div class="p-4 max-w-md mx-auto bg-surface-primary">
            <story />
          </div>
        `
      }
    }
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const NewDesign: Story = {
  args: {
    refreshDate: 'Dec 16, 2025',
    subscriptionTiersEnabled: true
  }
}

export const NewDesignWithoutRefresh: Story = {
  args: {
    refreshDate: undefined,
    subscriptionTiersEnabled: true
  }
}

export const LegacyDesign: Story = {
  args: {
    refreshDate: 'Dec 16, 2025',
    subscriptionTiersEnabled: false
  }
}

export const LegacyInsufficientCredits: Story = {
  args: {
    refreshDate: undefined,
    isInsufficientCredits: true,
    subscriptionTiersEnabled: false
  }
}
