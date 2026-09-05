// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import * as reducedMotion from '../../composables/useReducedMotion'
import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import ServerlessIsometricStudy from './ServerlessIsometricStudy.vue'

beforeEach(() => {
  stubIntersectionObserver()
})

it('keeps the SVG illustration when canvas rendering is unavailable', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  render(ServerlessIsometricStudy)
  // eslint-disable-next-line testing-library/no-node-access
  expect(screen.getByRole('img').querySelector('svg rect')).not.toBeNull()
})

it('replaces SVG tiles with a drawn canvas once its texture loads', async () => {
  vi.spyOn(reducedMotion, 'prefersReducedMotion').mockReturnValue(true)
  let finishLoading: (() => void) | undefined
  vi.stubGlobal(
    'Image',
    class {
      width = 1600
      height = 1064
      onload: (() => void) | null = null
      set src(_value: string) {
        finishLoading = () => this.onload?.()
      }
    }
  )
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    createPattern: vi.fn(() => ({ setTransform: vi.fn() })),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    transform: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn()
  } satisfies Partial<CanvasRenderingContext2D>
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D
  )
  const { unmount } = render(ServerlessIsometricStudy)
  expect(context.fill).not.toHaveBeenCalled()
  finishLoading?.()
  await nextTick()
  expect(context.drawImage).toHaveBeenCalledOnce()
  expect(context.createPattern).toHaveBeenCalledOnce()
  expect(context.roundRect).toHaveBeenCalled()
  expect(context.fill).toHaveBeenCalled()
  const illustration = screen.getByRole('img')
  // eslint-disable-next-line testing-library/no-node-access
  expect(illustration.querySelector('svg rect')).toBeNull()
  unmount()
  context.createPattern.mockClear()
  finishLoading?.()
  expect(context.createPattern).not.toHaveBeenCalled()
})

it('stops scheduling frames offscreen, in a hidden tab, and after unmount', async () => {
  const frames = new Map<number, FrameRequestCallback>()
  let id = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++id, callback)
    return id
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((key) => {
    frames.delete(key)
  })
  const visibility = vi
    .spyOn(document, 'visibilityState', 'get')
    .mockReturnValue('visible')
  const { unmount } = render(ServerlessIsometricStudy)
  await setAllIntersecting(true)
  expect(frames.size).toBe(1)
  await setAllIntersecting(false)
  expect(frames.size).toBe(0)
  await setAllIntersecting(true)
  expect(frames.size).toBe(1)
  visibility.mockReturnValue('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  await nextTick()
  expect(frames.size).toBe(0)
  visibility.mockReturnValue('visible')
  document.dispatchEvent(new Event('visibilitychange'))
  await nextTick()
  expect(frames.size).toBe(1)
  unmount()
  expect(frames.size).toBe(0)
})
