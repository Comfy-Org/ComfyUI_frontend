// @vitest-environment happy-dom
/* eslint-disable testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import IndustriesSection from './IndustriesSection.vue'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock('../../composables/useReducedMotion', () => ({
  prefersReducedMotion: () => motion.reduced
}))

const DWELL_MS = 3000
const RESUME_MS = 1500

function activeButton() {
  return document.querySelector('[aria-current="true"]') as HTMLButtonElement
}

describe('IndustriesSection', () => {
  beforeEach(() => {
    motion.reduced = false
    stubIntersectionObserver()
  })

  it('lists the four industries starting on VFX & Animation', () => {
    render(IndustriesSection)

    const nav = screen.getByRole('navigation', { name: 'Industry categories' })
    expect(nav.querySelectorAll('button')).toHaveLength(4)
    expect(activeButton().textContent).toContain('VFX & Animation')

    // The media cluster plays the active industry's clips.
    const sources = [...document.querySelectorAll('video')].map((video) =>
      video.getAttribute('src')
    )
    expect(sources.some((src) => src?.includes('left1'))).toBe(true)
  })

  it('advances to the next industry on the dwell cadence while visible', async () => {
    render(IndustriesSection)

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(DWELL_MS)
    expect(activeButton().textContent).toContain(
      'Advertising & Creative Studios'
    )

    await vi.advanceTimersByTimeAsync(DWELL_MS)
    expect(activeButton().textContent).toContain('Gaming')
  })

  it('selects on rollover, holds while hovering, then resumes from there', async () => {
    render(IndustriesSection)
    await setAllIntersecting(true)

    const nav = screen.getByRole('navigation', { name: 'Industry categories' })
    const gaming = screen.getByRole('button', { name: 'Gaming' })

    nav.dispatchEvent(new PointerEvent('pointerenter'))
    gaming.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.advanceTimersByTimeAsync(0)
    expect(activeButton().textContent).toContain('Gaming')

    // Held: the cycle stays put well past the dwell time.
    await vi.advanceTimersByTimeAsync(DWELL_MS * 3)
    expect(activeButton().textContent).toContain('Gaming')

    // Released: it picks back up on the shorter resume fuse.
    nav.dispatchEvent(new PointerEvent('pointerleave'))
    await vi.advanceTimersByTimeAsync(RESUME_MS)
    expect(activeButton().textContent).toContain('eCommerce & Fashion')
  })

  it('selects on click and keyboard focus', async () => {
    const { emitted } = render(IndustriesSection)
    void emitted

    const ecommerce = screen.getByRole('button', {
      name: 'eCommerce & Fashion'
    })
    ecommerce.click()
    await vi.advanceTimersByTimeAsync(0)
    expect(activeButton().textContent).toContain('eCommerce & Fashion')

    const vfx = screen.getByRole('button', { name: 'VFX & Animation' })
    vfx.dispatchEvent(new FocusEvent('focus'))
    await vi.advanceTimersByTimeAsync(0)
    expect(activeButton().textContent).toContain('VFX & Animation')
  })

  it('does not cycle under prefers-reduced-motion', async () => {
    motion.reduced = true
    render(IndustriesSection)

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(DWELL_MS * 4)
    expect(activeButton().textContent).toContain('VFX & Animation')
  })
})
