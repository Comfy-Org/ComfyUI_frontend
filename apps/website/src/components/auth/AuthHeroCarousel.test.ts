// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { cleanup, render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { nextTick } from 'vue'

import type { HeroSlide } from '../../config/hero-slides'

const slides = vi.hoisted(() => ({ value: [] as HeroSlide[] }))

vi.mock<unknown>(import('../../config/hero-slides'), () => ({
  get HERO_SLIDES() {
    return slides.value
  },
  PROVIDER_ICON: { gemini: '/gemini.svg' }
}))

const buildSlide = (id: string, title: string): HeroSlide => ({
  id,
  title,
  provider: 'gemini',
  src: `${id}.webm`,
  poster: `${id}.webp`,
  mimeType: 'video/webm'
})

function stubViewportWidth(pixels: number) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const minWidth = /min-width:\s*([\d.]+)(px|rem)/.exec(query)
      const threshold = minWidth
        ? Number(minWidth[1]) * (minWidth[2] === 'rem' ? 16 : 1)
        : 0
      return {
        matches: pixels >= threshold,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }
    })
  )
}

async function renderCarousel(count: number, viewportWidth = 1280) {
  stubViewportWidth(viewportWidth)
  slides.value = Array.from({ length: count }, (_, index) =>
    buildSlide(`slide-${index}`, `Model ${index}`)
  )
  const { default: AuthHeroCarousel } = await import('./AuthHeroCarousel.vue')
  const view = render(AuthHeroCarousel)
  await nextTick()
  return view
}

beforeEach(() => {
  vi.resetModules()
})

describe('AuthHeroCarousel', () => {
  const allSlides = () =>
    screen
      .getAllByRole('group', { hidden: true })
      .filter((el) => el.getAttribute('aria-roledescription') === 'slide')

  const activeSlide = () => {
    const exposed = allSlides().filter(
      (el) => el.getAttribute('aria-hidden') !== 'true'
    )
    expect(
      exposed,
      'exactly one slide may be exposed to assistive tech; the rest are aria-hidden'
    ).toHaveLength(1)
    return exposed[0]
  }

  it('does not mount below the xl breakpoint', async () => {
    await renderCarousel(3, 1024)

    expect(
      screen.queryByRole('group', { hidden: true }),
      'mounting below xl would download the hero video on devices that never display it'
    ).toBeNull()
  })

  it('mounts every slide at xl and wider, only after mount', async () => {
    await renderCarousel(3, 1280)

    await waitFor(() => expect(allSlides()).toHaveLength(3))
  })

  it('moves to the next slide and wraps backwards from the first', async () => {
    const user = userEvent.setup()
    await renderCarousel(3)

    const activeTitle = () => activeSlide().getAttribute('aria-label')

    expect(activeTitle()).toBe('Model 0')

    await user.click(screen.getByRole('button', { name: 'Next slide' }))
    expect(activeTitle()).toBe('Model 1')

    await user.click(screen.getByRole('button', { name: 'Previous slide' }))
    await user.click(screen.getByRole('button', { name: 'Previous slide' }))
    expect(activeTitle()).toBe('Model 2')
  })

  it('keeps the active slide in the same slot when wrapping', async () => {
    const user = userEvent.setup()
    await renderCarousel(3)

    const strip = () =>
      Object.fromEntries(
        allSlides().map((el) => [el.style.order, el.getAttribute('aria-label')])
      )

    expect(strip()).toEqual({ 0: 'Model 2', 1: 'Model 0', 2: 'Model 1' })

    await user.click(screen.getByRole('button', { name: 'Next slide' }))
    expect(strip()).toEqual({ 0: 'Model 0', 1: 'Model 1', 2: 'Model 2' })

    await user.click(screen.getByRole('button', { name: 'Next slide' }))
    await user.click(screen.getByRole('button', { name: 'Next slide' }))
    expect(
      strip(),
      'wrapping to the first slide travels one slot like any other step'
    ).toEqual({ 0: 'Model 2', 1: 'Model 0', 2: 'Model 1' })

    await user.click(screen.getByRole('button', { name: 'Previous slide' }))
    expect(strip()).toEqual({ 0: 'Model 1', 1: 'Model 2', 2: 'Model 0' })
  })

  it('announces the slide a user navigated to', async () => {
    const user = userEvent.setup()
    await renderCarousel(3)

    const liveRegion = screen.getByRole('status')
    expect(
      liveRegion.textContent.trim(),
      'silent until the user navigates; auto-advance must not talk over them'
    ).toBe('')

    await user.click(screen.getByRole('button', { name: 'Next slide' }))

    expect(liveRegion.textContent.trim()).toBe('Model 1, slide 2 of 3')
  })

  it('renders navigation only when there is more than one slide', async () => {
    await renderCarousel(3)
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeTruthy()

    cleanup()

    await renderCarousel(1)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
