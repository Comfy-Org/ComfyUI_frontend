import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MoveAnythingStudio from './MoveAnythingStudio.vue'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

describe('MoveAnythingStudio', () => {
  it('moves a thing in the example, waits, then offers the result', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(MoveAnythingStudio)
    expect(screen.queryByTestId('move-generate')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Try the example' }))
    const generate = screen.getByTestId('move-generate')
    expect(generate).toBeDisabled()
    screen.getByRole('button', { name: /^Orange kitten\./ }).focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(generate).toHaveTextContent('Move 1 object')

    await user.click(generate)
    expect(screen.getByRole('status')).toHaveTextContent('Making the move')
    await vi.runAllTimersAsync()

    expect(
      await screen.findByRole('link', { name: 'Download' })
    ).toHaveAttribute('href', '/images/apps/move-anything/example-moved.jpg')
  })

  it('lists the selected things in the Objects tray and removes one', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(MoveAnythingStudio)
    await user.click(screen.getByRole('button', { name: 'Try the example' }))

    await user.click(screen.getByRole('button', { name: /Objects/ }))
    const tray = screen.getByRole('dialog', { name: 'Objects' })
    expect(tray).toHaveTextContent('3 of 4')
    await user.click(
      screen.getByRole('button', { name: 'Remove Orange kitten' })
    )

    expect(tray).toHaveTextContent('2 of 4')
    expect(
      screen.queryByRole('button', { name: /^Orange kitten\./ })
    ).toBeNull()
  })
  it('undoes and redoes a move from the history controls above the photo', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(MoveAnythingStudio)
    await user.click(screen.getByRole('button', { name: 'Try the example' }))
    const history = screen.getByRole('toolbar', { name: 'History' })
    const generate = screen.getByTestId('move-generate')

    screen.getByRole('button', { name: /^Orange kitten\./ }).focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    await user.click(within(history).getByRole('button', { name: 'Undo' }))
    expect(generate).toBeDisabled()

    await user.click(within(history).getByRole('button', { name: 'Redo' }))
    expect(generate).toHaveTextContent('Move 1 object')
  })
  it('shows the how-to hint on the photo until a thing is touched', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(MoveAnythingStudio)
    await user.click(screen.getByRole('button', { name: 'Try the example' }))
    const hint = /^Drag to move/

    expect(screen.getByText(hint)).toBeInTheDocument()
    screen.getByRole('button', { name: /^Orange kitten\./ }).focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.queryByText(hint)).toBeNull()
  })
})
