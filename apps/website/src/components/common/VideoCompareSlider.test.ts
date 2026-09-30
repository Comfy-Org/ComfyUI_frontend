import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import VideoCompareSlider from './VideoCompareSlider.vue'

const props = {
  beforeSrc: 'before.webm',
  afterSrc: 'after.webm',
  beforeLabel: 'Before',
  afterLabel: 'After',
  sliderLabel: 'Comparison slider'
}

async function renderSlider() {
  render(VideoCompareSlider, { props })
  const slider = screen.getByRole('slider', { name: 'Comparison slider' })
  const surface = screen.getByTestId('video-compare-surface')
  const beforeVideo = screen.getByTestId<HTMLVideoElement>(
    'video-compare-before'
  )
  const afterVideo = screen.getByTestId<HTMLVideoElement>('video-compare-after')
  await waitFor(() => expect(beforeVideo).toHaveAttribute('src', 'before.webm'))
  return { slider, surface, beforeVideo, afterVideo }
}

async function pressAt(
  user: ReturnType<typeof userEvent.setup>,
  surface: HTMLElement,
  clientX: number,
  keys = '[MouseLeft>]'
) {
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 0, 400, 225)
  )
  await user.pointer([{ keys, target: surface, coords: { clientX } }])
}

describe('VideoCompareSlider', () => {
  it('renders no clip sources on the server', async () => {
    const html = await renderToString(
      createSSRApp({ render: () => h(VideoCompareSlider, props) })
    )

    expect(html).toContain('role="slider"')
    expect(html).not.toContain('before.webm')
    expect(html).not.toContain('after.webm')
  })

  it('starts at the midpoint with the after clip revealed on the right', async () => {
    const { slider, afterVideo } = await renderSlider()

    expect(afterVideo).toHaveAttribute('src', 'after.webm')
    expect(slider).toHaveAttribute('aria-valuenow', '50')
    expect(afterVideo.style.clipPath).toBe('inset(0 0 0 50%)')
    expect(screen.getByText('Before')).toBeVisible()
    expect(screen.getByText('After')).toBeVisible()
  })

  it('moves with the keyboard and clips the after clip to match', async () => {
    const user = userEvent.setup()
    const { slider, afterVideo } = await renderSlider()

    slider.focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(slider).toHaveAttribute('aria-valuenow', '60')
    expect(afterVideo.style.clipPath).toBe('inset(0 0 0 60%)')

    await user.keyboard('{Home}')
    expect(slider).toHaveAttribute('aria-valuenow', '0')
  })

  it('jumps to the pressed point and follows the pointer while held', async () => {
    const user = userEvent.setup()
    const { slider, surface } = await renderSlider()

    await pressAt(user, surface, 200)
    expect(slider).toHaveAttribute('aria-valuenow', '25')

    await user.pointer([{ coords: { clientX: 400 } }])
    expect(slider).toHaveAttribute('aria-valuenow', '75')
  })

  it('ignores presses from other buttons', async () => {
    const user = userEvent.setup()
    const { slider, surface } = await renderSlider()

    await pressAt(user, surface, 200, '[MouseRight>]')
    await user.pointer([{ coords: { clientX: 400 } }])

    expect(slider).toHaveAttribute('aria-valuenow', '50')
  })

  it.for([
    { release: 'pointerup', event: () => new Event('pointerup') },
    { release: 'pointercancel', event: () => new Event('pointercancel') },
    {
      release: 'a move with no button held',
      event: () => new PointerEvent('pointermove', { clientX: 400, buttons: 0 })
    }
  ])('stops following the pointer after $release', async ({ event }) => {
    const user = userEvent.setup()
    const { slider, surface } = await renderSlider()
    await pressAt(user, surface, 200)

    window.dispatchEvent(event())
    await user.pointer([{ coords: { clientX: 400 } }])

    expect(slider).toHaveAttribute('aria-valuenow', '25')
  })

  it.for([
    { before: 4, after: 1, expected: 4 },
    { before: 4, after: 3.9, expected: 3.9 }
  ])(
    'leaves the after clip at $after when the before clip is at $before',
    async ({ before, after, expected }) => {
      const { beforeVideo, afterVideo } = await renderSlider()

      beforeVideo.currentTime = before
      afterVideo.currentTime = after
      beforeVideo.dispatchEvent(new Event('timeupdate'))

      expect(afterVideo.currentTime).toBe(expected)
    }
  )
})
