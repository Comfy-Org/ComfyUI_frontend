// @vitest-environment happy-dom
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import { ELEMENT_KEYS, FLOW } from './graphLayout'
import GraphLinks from './GraphLinks.vue'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock('../../composables/useReducedMotion', () => ({
  prefersReducedMotion: () => motion.reduced
}))

const BANDS = 32

function defaultPositions() {
  return Object.fromEntries(
    ELEMENT_KEYS.map((key) => [
      key,
      { x: FLOW.elements[key].left, y: FLOW.elements[key].top }
    ])
  ) as Record<(typeof ELEMENT_KEYS)[number], { x: number; y: number }>
}

function renderLinks() {
  return render(GraphLinks, { props: { positions: defaultPositions() } })
}

describe('GraphLinks', () => {
  beforeEach(() => {
    motion.reduced = false
    stubIntersectionObserver()
  })

  it('draws one wire per node pair with a full band stack each', () => {
    vi.spyOn(SVGPathElement.prototype, 'getTotalLength').mockReturnValue(150)
    const { container } = renderLinks()

    expect(container.querySelectorAll('defs path')).toHaveLength(3)
    expect(container.querySelectorAll('use')).toHaveLength(3 * BANDS)

    // A 150-unit wire is a single wrap: the dash period spans the whole
    // normalised path.
    const use = container.querySelector('use') as SVGUseElement
    expect(use.style.strokeDasharray).toBe(
      `${100 / BANDS} ${100 - 100 / BANDS}`
    )
  })

  it('rounds long wires to more wraps so sweep speed stays comparable', async () => {
    vi.spyOn(SVGPathElement.prototype, 'getTotalLength').mockReturnValue(800)
    const { container } = renderLinks()
    await vi.advanceTimersByTimeAsync(1)

    // 800 units / 400 per wrap = 2 wraps: the dash period halves.
    const use = container.querySelector('use') as SVGUseElement
    expect(use.style.strokeDasharray).toBe(`${50 / BANDS} ${50 - 50 / BANDS}`)
  })

  it('ramps band opacity from the head down to the reference floor', () => {
    const { container } = renderLinks()
    const uses = [...container.querySelectorAll('use')].slice(0, BANDS)

    expect((uses[0] as SVGUseElement).style.strokeOpacity).toBe('1')
    expect((uses.at(-1) as SVGUseElement).style.strokeOpacity).toBe('0.04')
  })

  it('sways the wires over time while on screen', async () => {
    const { container } = renderLinks()
    const path = container.querySelector('defs path') as SVGPathElement
    const initial = path.getAttribute('d')

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(500)
    expect(path.getAttribute('d')).not.toBe(initial)
  })

  it('holds still under prefers-reduced-motion', async () => {
    motion.reduced = true
    const { container } = renderLinks()
    const path = container.querySelector('defs path') as SVGPathElement
    const initial = path.getAttribute('d')

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(500)
    expect(path.getAttribute('d')).toBe(initial)
  })
})
