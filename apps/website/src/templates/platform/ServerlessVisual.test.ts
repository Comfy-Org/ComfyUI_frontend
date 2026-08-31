// @vitest-environment happy-dom
/* eslint-disable testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import ServerlessVisual from './ServerlessVisual.vue'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock('../../composables/useReducedMotion', () => ({
  prefersReducedMotion: () => motion.reduced
}))

/** The marquee is only observable through which cells are lit, so tests
 * compare that set across frames rather than reaching into component state. */
function litCells() {
  return [...document.querySelectorAll('.shadow-md')].length
}

function pingCount() {
  return document.querySelectorAll('.animate-ping').length
}

describe('ServerlessVisual', () => {
  beforeEach(() => {
    motion.reduced = false
    stubIntersectionObserver()
  })

  it('exposes the animation as a single labelled image to assistive tech', () => {
    render(ServerlessVisual)

    expect(
      screen.getByRole('img', {
        name: 'Animated diagram showing serverless activity moving through B200 GPU workers.'
      })
    ).toBeTruthy()
  })

  it('renders the full worker grid', () => {
    render(ServerlessVisual)

    // 12 columns x 5 rows of activity cells.
    expect(document.querySelectorAll('.rounded-sm')).toHaveLength(60)
  })

  it('localizes the label', () => {
    render(ServerlessVisual, { props: { locale: 'zh-CN' } })

    expect(
      document.querySelector('[role="img"]')?.getAttribute('aria-label')
    ).toBe('动画图示：无服务器活动在 B200 GPU 工作节点之间移动。')
  })

  it('animates the marquee while on screen', async () => {
    render(ServerlessVisual)
    await setAllIntersecting(true)

    const frames = new Set<number>()
    for (let step = 0; step < 8; step += 1) {
      await vi.advanceTimersByTimeAsync(140)
      frames.add(litCells())
    }

    expect(frames.size).toBeGreaterThan(1)
  })

  it('holds still while off screen', async () => {
    render(ServerlessVisual)
    await setAllIntersecting(false)

    const before = litCells()
    await vi.advanceTimersByTimeAsync(140 * 8)

    expect(litCells()).toBe(before)
  })

  it('stays static and drops the ping rings under reduced motion', async () => {
    motion.reduced = true
    render(ServerlessVisual)
    await setAllIntersecting(true)

    expect(pingCount()).toBe(0)

    const before = litCells()
    await vi.advanceTimersByTimeAsync(140 * 8)

    expect(litCells()).toBe(before)
  })

  it('renders the ping rings when motion is allowed', () => {
    render(ServerlessVisual)

    expect(pingCount()).toBe(3)
  })
})
