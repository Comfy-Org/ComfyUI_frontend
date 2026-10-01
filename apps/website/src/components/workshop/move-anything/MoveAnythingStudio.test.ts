import { render, screen } from '@testing-library/vue'
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
})
