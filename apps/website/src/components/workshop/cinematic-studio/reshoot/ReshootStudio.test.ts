import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ReshootStudio from './ReshootStudio.vue'
import ReshootStudioPanel from './ReshootStudioPanel.vue'

function setup(component: typeof ReshootStudio | typeof ReshootStudioPanel) {
  render(component)
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

describe('Re-shoot with the bottom composer', () => {
  async function pickExampleAndApply(user: ReturnType<typeof setup>) {
    await user.click(screen.getByTestId('reshoot-example'))
    await vi.advanceTimersByTimeAsync(3000)
    await user.click(screen.getByTestId('reshoot-apply'))
  }

  it('reads the scene as soon as a clip is picked, then aims in its own view', async () => {
    const user = setup(ReshootStudio)
    expect(screen.queryByTestId('reshoot-action')).toBeNull()

    await user.click(screen.getByTestId('reshoot-example'))

    expect(screen.getByRole('status')).toHaveTextContent('Estimating depth')
    expect(screen.getByTestId('reshoot-apply')).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Rotation' })).toBeDisabled()

    await vi.advanceTimersByTimeAsync(3000)
    screen.getByTestId('reshoot-globe').focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('slider', { name: 'Rotation' })).toHaveValue('-25')

    await user.click(screen.getByTestId('reshoot-apply'))

    expect(screen.queryByTestId('reshoot-aim')).toBeNull()
    expect(screen.getByTestId('reshoot-action')).toBeEnabled()
    expect(
      screen.getByRole('button', { name: /New camera\s*-25° · 15°/ })
    ).toBeInTheDocument()
  })

  it('generates a take from the applied angle and cancels it', async () => {
    const user = setup(ReshootStudio)
    await pickExampleAndApply(user)

    await user.click(screen.getByTestId('reshoot-action'))

    expect(
      screen.getByRole('button', { name: 'Take 1 · az -30° el 15°' })
    ).toHaveAttribute('aria-current', 'true')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled')
  })

  it('reopens the aim view from the camera chip', async () => {
    const user = setup(ReshootStudio)
    await pickExampleAndApply(user)

    await user.click(screen.getByRole('button', { name: /^New camera/ }))

    expect(screen.getByTestId('reshoot-aim')).toBeInTheDocument()
  })
})

describe('Re-shoot with the side panel', () => {
  it('opens on step 1 and unlocks aiming in step 2 once depth is analyzed', async () => {
    const user = setup(ReshootStudioPanel)

    expect(
      screen.getByRole('button', { name: 'Example result', current: true })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Step 2/ })).toBeDisabled()
    expect(screen.queryByRole('slider', { name: /Azimuth/ })).toBeNull()

    await user.click(screen.getByTestId('reshoot-action'))
    expect(screen.getByTestId('reshoot-action')).toHaveTextContent(
      'Estimating depth'
    )
    await vi.advanceTimersByTimeAsync(3000)

    expect(screen.getByRole('button', { name: /Step 2/ })).toHaveAttribute(
      'aria-current',
      'step'
    )
    expect(screen.getByTestId('reshoot-action')).toHaveTextContent('Generate')
    expect(screen.getByRole('slider', { name: /Azimuth/ })).toBeEnabled()
  })

  it('adds a take for the aimed camera, then shows its result', async () => {
    const user = setup(ReshootStudioPanel)
    await user.click(screen.getByTestId('reshoot-action'))
    await vi.advanceTimersByTimeAsync(3000)

    await user.click(screen.getByTestId('reshoot-action'))

    expect(
      screen.getByRole('button', { name: 'Take 1 · az -30° el 15°' })
    ).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Generating the new view'
    )
    await vi.advanceTimersByTimeAsync(6500)
    await user.click(screen.getByRole('radio', { name: 'Original clip' }))
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'download',
      'crossview-take-1-original-audio.mp4'
    )
  })

  it('cancels a take that is still generating', async () => {
    const user = setup(ReshootStudioPanel)
    await user.click(screen.getByTestId('reshoot-action'))
    await vi.advanceTimersByTimeAsync(3000)
    await user.click(screen.getByTestId('reshoot-action'))

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('status')).toHaveTextContent('Cancelled')
    await vi.advanceTimersByTimeAsync(6500)
    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull()
  })
})
