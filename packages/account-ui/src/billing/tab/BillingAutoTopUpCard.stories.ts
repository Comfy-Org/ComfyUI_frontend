import type { Meta, StoryObj } from '@storybook/vue3-vite'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'

import BillingAutoTopUpCard from './BillingAutoTopUpCard.vue'
import BillingAutoTopUpMemberBlock from './BillingAutoTopUpMemberBlock.vue'
import {
  autoTopUpCardCopy,
  autoTopUpMemberBlockCopy
} from './__fixtures__/autoTopUpCopy'
import { loaded, notConfiguredSettings } from './__fixtures__/autoTopUpSettings'

const meta: Meta<typeof BillingAutoTopUpCard> = {
  title: 'Account UI/Billing/BillingAutoTopUpCard',
  component: BillingAutoTopUpCard,
  tags: ['autodocs'],
  args: {
    copy: autoTopUpCardCopy,
    locale: 'en',
    offView: 'off',
    setup: null,
    state: loaded()
  },
  decorators: [
    (story) => ({
      components: { story, TooltipProvider },
      template:
        '<TooltipProvider><div class="w-[720px] bg-background p-6"><story /></div></TooltipProvider>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

const OFF = { kind: 'loaded', settings: notConfiguredSettings } as const

export const Loading: Story = { args: { state: { kind: 'loading' } } }

export const Unavailable: Story = { args: { state: { kind: 'unavailable' } } }

export const On: Story = {}

export const Off: Story = { args: { state: OFF } }

export const OnHold: Story = { args: { state: loaded({ status: 'on_hold' }) } }

export const PausedByBudget: Story = {
  args: { state: loaded({ status: 'paused_by_budget' }) }
}

export const Failed: Story = { args: { state: loaded({ status: 'failed' }) } }

export const TurnedOff: Story = {
  args: {
    state: loaded({
      status: 'failed',
      disabled_reason: 'consecutive_declines'
    })
  }
}

export const MaximumReached: Story = {
  args: {
    state: loaded({
      status: 'paused_by_budget',
      monthly_budget_is_default: true
    })
  }
}

export const NoPaymentMethod: Story = {
  args: { state: OFF, offView: 'noPaymentMethod' }
}

export const NoDefaultPaymentMethod: Story = {
  args: { state: OFF, offView: 'noDefaultPaymentMethod' }
}

export const MemberBlock: Story = {
  render: () => ({
    components: { BillingAutoTopUpMemberBlock },
    setup: () => ({ copy: autoTopUpMemberBlockCopy }),
    template: '<BillingAutoTopUpMemberBlock :copy="copy" />'
  })
}

export const PlatformRestyled: Story = {
  args: {
    state: loaded({ status: 'failed' }),
    variants: { failed: 'destructive' },
    classes: { card: 'rounded-md border-dashed', title: 'text-base' }
  }
}
