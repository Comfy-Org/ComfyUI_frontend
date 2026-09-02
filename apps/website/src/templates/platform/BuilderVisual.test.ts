// @vitest-environment happy-dom
// The subject is a decorative aria-hidden SVG, so there is nothing to query
// by role or text: the assertion is a count of animated nodes.
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import BuilderVisual from './BuilderVisual.vue'

/** Every animation in the diagram, each of which costs main-thread work. */
const ANIMATION_CLASSES = [
  'animate-dash-flow',
  'animate-platform-builder-float',
  'animate-platform-builder-float-slow',
  'animate-platform-builder-float-delayed',
  'animate-platform-builder-pulse'
]

function countAnimated(container: Element) {
  return ANIMATION_CLASSES.reduce(
    (total, cls) => total + container.querySelectorAll(`.${cls}`).length,
    0
  )
}

describe('BuilderVisual', () => {
  let visibilityState: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stubIntersectionObserver()
    visibilityState = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible')
  })

  it('animates while on screen in a visible tab', async () => {
    const { container } = render(BuilderVisual)
    await setAllIntersecting(true)

    expect(countAnimated(container)).toBe(9)
  })

  it('parks every animation once scrolled out of view', async () => {
    const { container } = render(BuilderVisual)
    await setAllIntersecting(true)
    await setAllIntersecting(false)

    // None of these can be composited, so off-screen they would otherwise
    // keep doing main-thread work every frame.
    expect(countAnimated(container)).toBe(0)
    // The diagram itself still renders; only the motion stops.
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('parks every animation while the tab is hidden', async () => {
    const { container } = render(BuilderVisual)
    await setAllIntersecting(true)
    visibilityState.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()

    expect(countAnimated(container)).toBe(0)
  })
})
