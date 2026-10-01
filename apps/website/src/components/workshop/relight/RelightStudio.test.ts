import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RelightStudio from './RelightStudio.vue'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

async function openExample() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(RelightStudio)
  await user.click(screen.getByRole('button', { name: 'Try the example' }))
  return user
}

describe('RelightStudio', () => {
  it('nudges a light in the example, relights, then offers the relit photo', async () => {
    const user = await openExample()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()

    const key = screen.getByRole('button', { name: /^Warm key\./ })
    expect(key).toHaveStyle({ left: '20%' })
    key.focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(key).toHaveStyle({ left: '25%' })
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()

    await user.click(screen.getByTestId('relight-run'))
    expect(screen.getByRole('status')).toHaveTextContent('Relighting…')
    expect(screen.getByRole('status')).toHaveTextContent('2 lights')
    await vi.runAllTimersAsync()

    expect(
      await screen.findByRole('link', { name: 'Download' })
    ).toHaveAttribute('href', '/images/apps/relight/example-relit.jpg')
  })

  it('changes the selected light’s brightness in the Lights tray', async () => {
    const user = await openExample()

    await user.click(screen.getByRole('button', { name: /Lights/ }))
    const tray = screen.getByRole('dialog', { name: 'Lights' })
    expect(tray).toHaveTextContent('2 of 4')
    const brightness = within(tray).getByRole('slider', { name: 'Brightness' })
    expect(brightness).toHaveValue('80')

    await fireEvent.update(brightness, '35')

    expect(brightness).toHaveValue('35')
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
  })

  it('hides the live preview on Original', async () => {
    const user = await openExample()
    expect(screen.getByTestId('relight-preview')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Original' }))

    expect(screen.queryByTestId('relight-preview')).toBeNull()
  })
})
