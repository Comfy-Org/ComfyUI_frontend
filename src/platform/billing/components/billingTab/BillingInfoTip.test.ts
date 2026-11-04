import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'

import BillingInfoTip from '@/platform/billing/components/billingTab/BillingInfoTip.vue'

function renderTip(props: { text: string; label?: string }) {
  return render(
    defineComponent({
      components: { BillingInfoTip, TooltipProvider },
      setup: () => ({ props }),
      template: `<TooltipProvider :delay-duration="0"><BillingInfoTip v-bind="props" /></TooltipProvider>`
    })
  )
}

describe('BillingInfoTip', () => {
  it('names the button with its tooltip text', () => {
    renderTip({ text: 'Plan credits are spent first.' })

    expect(
      screen.getByRole('button', { name: 'Plan credits are spent first.' })
    ).toBeInTheDocument()
  })

  it('uses a separate label when one is given', () => {
    renderTip({ text: 'Credits pay for runs.', label: 'About credits' })

    expect(
      screen.getByRole('button', { name: 'About credits' })
    ).toBeInTheDocument()
  })

  it('shows the text on keyboard focus', async () => {
    const user = userEvent.setup()
    renderTip({ text: 'Credits pay for runs.', label: 'About credits' })

    await user.tab()

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Credits pay for runs.'
    )
  })

  it('keeps the text open after a tap and closes it with Escape', async () => {
    const user = userEvent.setup()
    renderTip({ text: 'Used after plan credits run out.' })

    await user.click(
      screen.getByRole('button', { name: 'Used after plan credits run out.' })
    )

    expect(
      await screen.findByText('Used after plan credits run out.')
    ).toBeVisible()

    await user.keyboard('{Escape}')

    await vi.waitFor(() =>
      expect(
        screen.queryByText('Used after plan credits run out.')
      ).not.toBeInTheDocument()
    )
  })
})
