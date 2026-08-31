import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import { creditsToCents } from '@/base/credits/comfyCredits'
import { setBillingContextMock } from '@/storybook/mocks/useBillingContext'

import TopUpCreditsDialogContentWorkspace from './TopUpCreditsDialogContentWorkspace.vue'

/**
 * The top-up dialog's steps (Figma 5624-32438 / 5631:32731). Each story drives
 * the component the way a customer does — the steps are internal state, not
 * props — so the screens shown here are the ones the flow can actually reach.
 */
const STARTING_BALANCE = creditsToCents(46_450)

const meta: Meta<typeof TopUpCreditsDialogContentWorkspace> = {
  title: 'Components/TopUpCreditsDialog',
  component: TopUpCreditsDialogContentWorkspace,
  parameters: { layout: 'centered' },
  beforeEach: () => {
    setBillingContextMock({ balanceCents: STARTING_BALANCE })
  }
}

export default meta
type Story = StoryObj<typeof TopUpCreditsDialogContentWorkspace>

async function goToConfirm(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'Add credits' }))
}

async function payAndSettle(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await goToConfirm(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: /^Pay \$/ }))
}

/** Step 1 — choose an amount. */
export const Amount: Story = {}

/** Step 2 — confirm the charge. */
export const Confirm: Story = {
  play: async ({ canvasElement }) => {
    await goToConfirm(canvasElement)
  }
}

/** Step 4 — the charge went through. */
export const Success: Story = {
  play: async ({ canvasElement }) => {
    await payAndSettle(canvasElement)
    await expect(
      within(canvasElement).getByText("You're all set")
    ).toBeInTheDocument()
  }
}

/** Step 5 — the card was refused. */
export const Declined: Story = {
  beforeEach: () => {
    setBillingContextMock({
      balanceCents: STARTING_BALANCE,
      topupStatus: 'failed'
    })
  },
  play: async ({ canvasElement }) => {
    await payAndSettle(canvasElement)
    await expect(
      within(canvasElement).getByText('Payment declined')
    ).toBeInTheDocument()
  }
}
