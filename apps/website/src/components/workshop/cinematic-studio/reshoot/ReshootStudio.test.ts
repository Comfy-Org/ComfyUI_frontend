import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ReshootStudio from './ReshootStudio.vue'
import ReshootStudioPanel from './ReshootStudioPanel.vue'

const layouts = [
  { name: 'bottom composer', component: ReshootStudio },
  { name: 'side panel', component: ReshootStudioPanel }
]

function setup(component: (typeof layouts)[number]['component']) {
  render(component)
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

async function openCamera(user: ReturnType<typeof setup>) {
  const chip = screen.queryByRole('button', { name: /^New camera/ })
  if (chip) await user.click(chip)
}

describe.for(layouts)('Re-shoot in the $name layout', ({ component }) => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('opens on the example result and keeps the camera locked until depth is analyzed', async () => {
    const user = setup(component)

    expect(
      screen.getByRole('button', { name: 'Example result', current: true })
    ).toBeInTheDocument()
    await openCamera(user)
    expect(screen.getByRole('slider', { name: /Azimuth/ })).toBeDisabled()

    await user.click(screen.getByTestId('reshoot-action'))
    expect(screen.getByTestId('reshoot-action')).toHaveTextContent(
      'Estimating depth'
    )
    await vi.advanceTimersByTimeAsync(3000)

    expect(screen.getByTestId('reshoot-action')).toHaveTextContent('Generate')
    await openCamera(user)
    expect(screen.getByRole('slider', { name: /Azimuth/ })).toBeEnabled()
  })

  it('adds a take for the aimed camera, then shows its result', async () => {
    const user = setup(component)
    await user.click(screen.getByTestId('reshoot-action'))
    await vi.advanceTimersByTimeAsync(3000)

    await user.click(screen.getByTestId('reshoot-action'))

    const take = screen.getByRole('button', {
      name: 'Take 1 · az -30° el 15°'
    })
    expect(take).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Generating the new view'
    )
    await vi.advanceTimersByTimeAsync(6500)
    expect(screen.getByRole('link', { name: 'Download' })).toBeInTheDocument()
  })

  it('cancels a take that is still generating', async () => {
    const user = setup(component)
    await user.click(screen.getByTestId('reshoot-action'))
    await vi.advanceTimersByTimeAsync(3000)
    await user.click(screen.getByTestId('reshoot-action'))

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('status')).toHaveTextContent('Cancelled')
    await vi.advanceTimersByTimeAsync(6500)
    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull()
  })
})
