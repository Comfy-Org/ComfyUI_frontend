import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { HeroSlide } from '@/platform/cloud/onboarding/constants/heroSlides'

const slides = vi.hoisted(() => ({ value: [] as HeroSlide[] }))

vi.mock('@/platform/cloud/onboarding/constants/heroSlides', () => ({
  get HERO_SLIDES() {
    return slides.value
  },
  PROVIDER_ICON: { gemini: 'icon-mask-[comfy--gemini]' }
}))

const buildSlide = (id: string, title: string): HeroSlide => ({
  id,
  title,
  provider: 'gemini',
  src: `${id}.webm`,
  poster: `${id}.webp`,
  mimeType: 'video/webm'
})

const MESSAGES = {
  cloudHero: {
    previousSlide: 'Previous slide',
    nextSlide: 'Next slide',
    slideRoleDescription: 'slide',
    carouselRoleDescription: 'carousel',
    carouselLabel: 'Featured models',
    slideStatus: '{title}, slide {current} of {total}'
  }
}

async function renderCarousel(count: number) {
  slides.value = Array.from({ length: count }, (_, index) =>
    buildSlide(`slide-${index}`, `Model ${index}`)
  )
  const { default: CloudHeroCarousel } =
    await import('@/platform/cloud/onboarding/components/CloudHeroCarousel.vue')
  return render(CloudHeroCarousel, {
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', messages: { en: MESSAGES } })
      ]
    }
  })
}

beforeEach(() => {
  vi.resetModules()
})

describe('CloudHeroCarousel', () => {
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

    expect(strip(), 'active slide starts in the middle slot').toEqual({
      0: 'Model 2',
      1: 'Model 0',
      2: 'Model 1'
    })

    await user.click(screen.getByRole('button', { name: 'Next slide' }))
    expect(strip(), 'a step rotates the strip by one slot').toEqual({
      0: 'Model 0',
      1: 'Model 1',
      2: 'Model 2'
    })

    await user.click(screen.getByRole('button', { name: 'Next slide' }))
    await user.click(screen.getByRole('button', { name: 'Next slide' }))
    expect(
      strip(),
      'wrapping to the first slide travels one slot like any other step, rather than rewinding the whole strip'
    ).toEqual({ 0: 'Model 2', 1: 'Model 0', 2: 'Model 1' })

    await user.click(screen.getByRole('button', { name: 'Previous slide' }))
    expect(strip(), 'a backwards step rotates the other way').toEqual({
      0: 'Model 1',
      1: 'Model 2',
      2: 'Model 0'
    })
  })

  it('announces the slide a user navigated to', async () => {
    const user = userEvent.setup()
    const { container } = await renderCarousel(3)

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeInTheDocument()
    expect(
      liveRegion,
      'silent until the user navigates; the reel also auto-advances and announcing that would talk over them'
    ).toBeEmptyDOMElement()

    await user.click(screen.getByRole('button', { name: 'Next slide' }))

    expect(liveRegion?.textContent?.trim()).toBe('Model 1, slide 2 of 3')
  })

  it('renders navigation only when there is more than one slide', async () => {
    await renderCarousel(3)
    expect(
      screen.getByRole('button', { name: 'Next slide' })
    ).toBeInTheDocument()

    cleanup()

    await renderCarousel(1)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
