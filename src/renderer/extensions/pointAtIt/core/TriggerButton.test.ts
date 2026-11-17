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
  role: 'mode',
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

  it('BA-24: while the thinking is folded, Ask is the thinking toggle: named so, not pressed, and it asks to toggle', async () => {
    const user = userEvent.setup()
    const { emitted } = renderTrigger({
      role: 'thinkingFolded',
      waitingSince: Date.now()
    })

    const main = screen.getByRole('button', { name: messages.askThinking })
    expect(main).toBeEnabled()
    expect(main).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.queryByRole('button', { name: messages.annotate })
    ).not.toBeInTheDocument()

    await user.click(main)
    expect(emitted('toggle')).toHaveLength(1)
  })

  it('BA-24: while the thinking is open, Ask looks pressed', () => {
    renderTrigger({ role: 'thinkingOpen', waitingSince: Date.now() })

    expect(
      screen.getByRole('button', { name: messages.askThinking })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('BA-24: the mode being on does not make the thinking toggle look pressed', () => {
    renderTrigger({ role: 'thinkingFolded', active: true })

    expect(
      screen.getByRole('button', { name: messages.askThinking })
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('BA-24: no segment or button besides Ask and its caret, whatever Ask does', () => {
    for (const role of ['mode', 'thinkingFolded', 'thinkingOpen'] as const) {
      const { unmount } = renderTrigger({ role })
      expect(screen.getAllByRole('button')).toHaveLength(2)
      unmount()
    }
  })

  it('P-10: shows how many comments of the current turn are unsent, and nothing at zero', async () => {
    const { rerender } = renderTrigger({ unsent: 3 })

    expect(screen.getByLabelText('3 unsent questions')).toHaveTextContent('3')

    await rerender({ unsent: 0 })
    expect(screen.queryByLabelText(/unsent/)).not.toBeInTheDocument()
  })

  it('P-10, SD-01: shows a loading icon and no duration while a request is waiting', () => {
    renderTrigger({ unsent: 2, waitingSince: Date.now() - 12_400 })

    expect(screen.getByTestId('point-at-it-loading')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: messages.annotate })
    ).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText(/\d+ s\b/)).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/unsent/)).not.toBeInTheDocument()
  })

  it('BA-05: the caret waits too while a request is waiting, so the list cannot be opened over the thinking', () => {
    renderTrigger({ waitingSince: Date.now() })

    expect(
      screen.getByRole('button', { name: messages.showPanel })
    ).toBeDisabled()
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
