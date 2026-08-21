import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import VideoCompareSlider from './VideoCompareSlider.vue'

const baseSrc = 'base.mp4'
const overlaySrc = 'overlay.mp4'

function renderSlider(startPosition?: number) {
  return render(VideoCompareSlider, {
    props: { baseSrc, overlaySrc, label: 'Compare', startPosition }
  })
}

function movePointer(clientX: number, trackWidth: number) {
  const track = screen.getByRole('group')
  track.getBoundingClientRect = () =>
    ({ left: 0, width: trackWidth }) as DOMRect
  track.dispatchEvent(new MouseEvent('pointermove', { clientX, bubbles: true }))
}

describe('VideoCompareSlider', () => {
  it('exposes the handle position via an accessible slider', () => {
    renderSlider(30)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuenow', '30')
    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', '100')
  })

  it('moves the handle with the keyboard', async () => {
    renderSlider(50)
    const slider = screen.getByRole('slider')
    slider.focus()

    await userEvent.keyboard('{ArrowRight}')
    expect(slider).toHaveAttribute('aria-valuenow', '55')

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(slider).toHaveAttribute('aria-valuenow', '45')
  })

  it('clamps keyboard movement to the [0, 100] range', async () => {
    renderSlider(50)
    const slider = screen.getByRole('slider')
    slider.focus()

    await userEvent.keyboard('{Home}')
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    await userEvent.keyboard('{ArrowLeft}')
    expect(slider).toHaveAttribute('aria-valuenow', '0')

    await userEvent.keyboard('{End}')
    expect(slider).toHaveAttribute('aria-valuenow', '100')
    await userEvent.keyboard('{ArrowRight}')
    expect(slider).toHaveAttribute('aria-valuenow', '100')
  })

  it('tracks the pointer as a percentage of the track width', async () => {
    renderSlider(50)

    await waitFor(() => {
      movePointer(50, 200)
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '25')
    })
  })
})
