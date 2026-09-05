// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

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
