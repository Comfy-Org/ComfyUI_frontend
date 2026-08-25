import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import VideoCompareSlider from './VideoCompareSlider.vue'

const baseSrc = 'base.mp4'
const overlaySrc = 'overlay.mp4'

function renderSlider(startPosition?: number) {
  return render(VideoCompareSlider, {
    props: { baseSrc, overlaySrc, label: 'Compare', startPosition }
  })
}

function stubTrackWidth(trackWidth: number) {
  const track = screen.getByRole('group')
  track.getBoundingClientRect = () =>
    ({ left: 0, width: trackWidth }) as DOMRect
  return track
}

function dispatchPointer(type: string, clientX: number) {
  screen
    .getByRole('group')
    .dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, buttons: 1 }))
}

function dragPointer(clientX: number, trackWidth: number) {
  stubTrackWidth(trackWidth)
  dispatchPointer('pointerdown', clientX)
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

  it('tracks the pointer as a percentage of the track width while dragging', async () => {
    renderSlider(50)

    await waitFor(() => {
      dragPointer(50, 200)
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '25')
    })
  })

  it('ignores pointer movement that is not an active drag', () => {
    renderSlider(50)
    stubTrackWidth(200)

    dispatchPointer('pointermove', 50)

    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '50')
  })

  describe('reduced motion', () => {
    it('does not autoplay the clips when reduced motion is preferred', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn()
        }))
      )
      renderSlider(50)

      for (const video of screen.getAllByTestId('compare-clip')) {
        expect(video).not.toHaveAttribute('autoplay')
      }
    })
  })
})
