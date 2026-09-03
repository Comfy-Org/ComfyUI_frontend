// @vitest-environment happy-dom
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import FeaturedWorkflowsSection from './FeaturedWorkflowsSection.vue'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock('../../composables/useReducedMotion', () => ({
  prefersReducedMotion: () => motion.reduced
}))

const DWELL_MS = 6000
const SLIDE_COUNT = 6

function trackOffset(container: Element): string {
  const track = container.querySelector('[style*="translate3d"]') as HTMLElement
  return track.style.transform
}

describe('FeaturedWorkflowsSection', () => {
  let play: ReturnType<typeof vi.spyOn>
  let pause: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    motion.reduced = false
    stubIntersectionObserver()
    play = vi
      .spyOn(HTMLVideoElement.prototype, 'play')
      .mockResolvedValue(undefined)
    pause = vi
      .spyOn(HTMLVideoElement.prototype, 'pause')
      .mockImplementation(() => {})
  })

  it('renders every slide with its workflow link', () => {
    const { container } = render(FeaturedWorkflowsSection)

    expect(
      screen.getByRole('region', { name: 'FEATURED · STAFF PICK' })
    ).toBeTruthy()
    const links = [...container.querySelectorAll('a')]
    expect(links).toHaveLength(SLIDE_COUNT)
    expect(trackOffset(container)).toBe('translate3d(-0%, 0, 0)')
  })

  it('steps forward and back with the arrows, wrapping at the ends', async () => {
    const { container } = render(FeaturedWorkflowsSection)

    screen.getByRole('button', { name: 'Next featured workflow' }).click()
    await vi.advanceTimersByTimeAsync(0)
    expect(trackOffset(container)).toBe('translate3d(-100%, 0, 0)')

    const prev = screen.getByRole('button', {
      name: 'Previous featured workflow'
    })
    prev.click()
    await vi.advanceTimersByTimeAsync(0)
    expect(trackOffset(container)).toBe('translate3d(-0%, 0, 0)')

    prev.click()
    await vi.advanceTimersByTimeAsync(0)
    expect(trackOffset(container)).toBe(
      `translate3d(-${(SLIDE_COUNT - 1) * 100}%, 0, 0)`
    )
  })

  it('plays only the displayed slide while visible, rewinding on entry', async () => {
    const { container } = render(FeaturedWorkflowsSection)

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(play).toHaveBeenCalledTimes(1)

    const videos = [...container.querySelectorAll('video')]
    videos[1].currentTime = 42
    screen.getByRole('button', { name: 'Next featured workflow' }).click()
    await vi.advanceTimersByTimeAsync(0)

    expect(pause).toHaveBeenCalled()
    expect(videos[1].currentTime).toBe(0)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('pauses when scrolled away', async () => {
    render(FeaturedWorkflowsSection)

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(0)
    pause.mockClear()

    await setAllIntersecting(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(pause).toHaveBeenCalled()
  })

  it('auto-advances on the dwell cadence and holds while hovered', async () => {
    const { container } = render(FeaturedWorkflowsSection)
    await setAllIntersecting(true)

    await vi.advanceTimersByTimeAsync(DWELL_MS)
    expect(trackOffset(container)).toBe('translate3d(-100%, 0, 0)')

    const region = screen.getByRole('region', { name: 'FEATURED · STAFF PICK' })
    region.dispatchEvent(new PointerEvent('pointerenter'))
    await vi.advanceTimersByTimeAsync(DWELL_MS * 2)
    expect(trackOffset(container)).toBe('translate3d(-100%, 0, 0)')
  })
})
