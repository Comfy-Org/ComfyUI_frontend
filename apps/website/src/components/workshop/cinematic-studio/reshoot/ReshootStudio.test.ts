import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ReshootStudio from './ReshootStudio.vue'

function setup() {
  render(ReshootStudio)
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

describe('Re-shoot on one screen', () => {
  async function pickExample(user: ReturnType<typeof setup>) {
    await user.click(screen.getByRole('button', { name: /Sci-fi pilot/ }))
    await vi.advanceTimersByTimeAsync(3000)
  }

  it('reads the scene as soon as a clip is picked, then aims from the globe', async () => {
    const user = setup()
    expect(screen.queryByTestId('reshoot-action')).toBeNull()
    expect(screen.getByTestId('reshoot-empty')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Sci-fi pilot/ }))

    expect(screen.getByRole('status')).toHaveTextContent('Estimating depth')
    expect(screen.getByTestId('reshoot-action')).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Rotation' })).toBeDisabled()

    await vi.advanceTimersByTimeAsync(3000)
    screen.getByTestId('reshoot-globe').focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('slider', { name: 'Rotation' })).toHaveValue('-25')
    expect(screen.getByTestId('reshoot-action')).toBeEnabled()
  })

  it('lines up a take next to the picture and cancels it there', async () => {
    const user = setup()
    await pickExample(user)

    await user.click(screen.getByTestId('reshoot-action'))

    expect(
      screen.getByRole('button', { name: 'Take 1 · az -30° el 15°' })
    ).toHaveAttribute('aria-current', 'true')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled')
  })

  it("aims again from a finished take's angle", async () => {
    const user = setup()
    await pickExample(user)
    await user.click(screen.getByTestId('reshoot-action'))
    await vi.advanceTimersByTimeAsync(6500)
    screen.getByTestId('reshoot-globe').focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    await user.click(
      screen.getByRole('button', { name: 'Take 1 · az -30° el 15°' })
    )

    await user.click(
      screen.getByRole('button', { name: 'Use this angle again' })
    )

    expect(screen.getByRole('slider', { name: 'Rotation' })).toHaveValue('-30')
    expect(
      screen.getByRole('button', { name: 'Aim', current: true })
    ).toBeInTheDocument()
  })
})
