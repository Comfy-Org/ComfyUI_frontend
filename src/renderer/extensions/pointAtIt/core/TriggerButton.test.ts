import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { messages } from './messages'
import TriggerButton from './TriggerButton.vue'

const baseProps: ComponentProps<typeof TriggerButton> = {
  active: false,
  disabled: false,
  panelOpen: false,
  unsent: 0,
  waitingSince: null
}

function renderTrigger(
  props: Partial<ComponentProps<typeof TriggerButton>> = {}
) {
  return render(TriggerButton, { props: { ...baseProps, ...props } })
}

describe('TriggerButton', () => {
  it('P-04, P-06: its main part asks to toggle the mode and its caret asks for the panel', async () => {
    const user = userEvent.setup()
    const { emitted } = renderTrigger()

    await user.click(screen.getByRole('button', { name: messages.annotate }))
    await user.click(screen.getByRole('button', { name: messages.showPanel }))

    expect(emitted('toggle')).toHaveLength(1)
    expect(emitted('caret')).toHaveLength(1)
  })

  it('P-01, P-10: names the shortcut and looks pressed while the mode is on', () => {
    renderTrigger({ active: true })

    const main = screen.getByRole('button', { name: messages.annotate })
    expect(main).toHaveAttribute('aria-pressed', 'true')
    expect(main).toHaveAttribute('title', expect.stringContaining('(Q)'))
  })

  it('P-10: shows how many comments of the current turn are unsent, and nothing at zero', async () => {
    const { rerender } = renderTrigger({ unsent: 3 })

    expect(screen.getByLabelText('3 unsent questions')).toHaveTextContent('3')

    await rerender({ unsent: 0 })
    expect(screen.queryByLabelText(/unsent/)).not.toBeInTheDocument()
  })

  it('P-10, SD-01: shows a loading icon and the elapsed seconds while a request is waiting', () => {
    renderTrigger({ unsent: 2, waitingSince: Date.now() - 12_400 })

    expect(screen.getByTestId('point-at-it-loading')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: messages.annotate })
    ).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('12 s')
    expect(screen.queryByLabelText(/unsent/)).not.toBeInTheDocument()
  })

  it('SD-02: shows no loading icon when nothing is waiting', () => {
    renderTrigger()

    expect(screen.queryByTestId('point-at-it-loading')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('W-01: the trigger is called Ask', () => {
    renderTrigger()

    expect(screen.getByRole('button', { name: 'Ask' })).toBeVisible()
  })

  it('P-15: is marked as the layer’s own, so it can never be picked', () => {
    renderTrigger()

    expect(screen.getByTestId('point-at-it-trigger')).toHaveAttribute(
      'data-point-at-it-layer'
    )
  })
})
