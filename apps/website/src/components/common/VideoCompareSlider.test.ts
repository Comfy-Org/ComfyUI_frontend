import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import VideoCompareSlider from './VideoCompareSlider.vue'

function renderSlider() {
  render(VideoCompareSlider, {
    props: {
      beforeSrc: 'before.webm',
      afterSrc: 'after.webm',
      beforeLabel: 'Before',
      afterLabel: 'After',
      sliderLabel: 'Comparison slider'
    }
  })
  const slider = screen.getByRole('slider', { name: 'Comparison slider' })
  // eslint-disable-next-line testing-library/no-node-access
  const surface = slider.parentElement
  if (!(surface instanceof HTMLElement)) throw new Error('no surface')
  // eslint-disable-next-line testing-library/no-node-access
  const videos = surface.getElementsByTagName('video')
  const beforeVideo = videos[0]
  const afterVideo = videos[1]
  return { slider, surface, beforeVideo, afterVideo }
}

describe('VideoCompareSlider', () => {
  it('starts at the midpoint with the after clip revealed on the right', () => {
    const { slider, beforeVideo, afterVideo } = renderSlider()

    expect(beforeVideo).toHaveAttribute('src', 'before.webm')
    expect(afterVideo).toHaveAttribute('src', 'after.webm')
    expect(slider).toHaveAttribute('aria-valuenow', '50')
    expect(afterVideo.style.clipPath).toBe('inset(0 0 0 50%)')
    expect(screen.getByText('Before')).toBeVisible()
    expect(screen.getByText('After')).toBeVisible()
  })

  it('moves with the keyboard and clips the after clip to match', async () => {
    const user = userEvent.setup()
    const { slider, afterVideo } = renderSlider()

    slider.focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(slider).toHaveAttribute('aria-valuenow', '60')
    expect(afterVideo.style.clipPath).toBe('inset(0 0 0 60%)')

    await user.keyboard('{Home}')
    expect(slider).toHaveAttribute('aria-valuenow', '0')
  })

  it('follows the pointer while dragging and stops on release', async () => {
    const user = userEvent.setup()
    const { slider, surface } = renderSlider()
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      width: 400
    } as DOMRect)

    await user.pointer([
      { keys: '[MouseLeft>]', target: surface, coords: { clientX: 200 } },
      { coords: { clientX: 400 } }
    ])
    expect(slider).toHaveAttribute('aria-valuenow', '75')

    await user.pointer([{ keys: '[/MouseLeft]' }, { coords: { clientX: 100 } }])
    expect(slider).toHaveAttribute('aria-valuenow', '75')
  })

  it('keeps the after clip on the before clip timeline', () => {
    const { beforeVideo, afterVideo } = renderSlider()

    beforeVideo.currentTime = 4
    afterVideo.currentTime = 1
    beforeVideo.dispatchEvent(new Event('timeupdate'))

    expect(afterVideo.currentTime).toBe(4)
  })
})
