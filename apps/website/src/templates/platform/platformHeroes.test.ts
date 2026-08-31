// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubIntersectionObserver } from '../../test/fakeIntersectionObserver'
import BuilderHero from './BuilderHero.vue'
import HeroSection from './HeroSection.vue'
import ModelsApiHero from './ModelsApiHero.vue'
import ServerlessHero from './ServerlessHero.vue'

vi.mock('../../composables/useReducedMotion', () => ({
  prefersReducedMotion: () => true
}))

const CONSOLE = 'https://platform.comfy.org'
const PLATFORM_DOCS = 'https://docs.comfy.org/development/overview'

function href(name: string | RegExp) {
  return screen.getByRole('link', { name }).getAttribute('href')
}

// Each hero is a thin configuration of HeroSplit01; what is worth pinning is
// the CTA wiring and the badge treatment, which differ per product.
describe('platform heroes', () => {
  beforeEach(() => {
    stubIntersectionObserver()
  })

  describe('HeroSection', () => {
    it('sends both CTAs to the console and the platform docs', () => {
      render(HeroSection)

      expect(href('Get Started')).toBe(CONSOLE)
      expect(href('Read the docs')).toBe(PLATFORM_DOCS)
    })

    it('localizes the CTAs', () => {
      render(HeroSection, { props: { locale: 'zh-CN' } })

      expect(screen.queryByRole('link', { name: 'Get Started' })).toBeNull()
      expect(screen.getAllByRole('link')).toHaveLength(2)
    })

    it('keeps the heading available to screen readers only', () => {
      render(HeroSection)

      expect(screen.getByRole('heading', { level: 1 }).classList).toContain(
        'sr-only'
      )
    })
  })

  describe('ServerlessHero', () => {
    it('sends both CTAs to the console and the platform docs', () => {
      render(ServerlessHero)

      expect(href('Get Started')).toBe(CONSOLE)
      expect(href('Read the docs')).toBe(PLATFORM_DOCS)
    })

    it('titles the hero with the Serverless product name', () => {
      render(ServerlessHero)

      expect(
        screen.getByRole('heading', { level: 1, name: 'Serverless API' })
      ).toBeTruthy()
    })
  })

  describe('ModelsApiHero', () => {
    it('points the secondary CTA at the Comfy Router quickstart', () => {
      render(ModelsApiHero)

      expect(href('Get Started')).toBe(CONSOLE)
      expect(href('Read the docs')).toBe(
        'https://docs.comfy.org/development/comfy-router/quickstart#comfy-router-quickstart'
      )
    })

    it('titles the hero with the Models product name', () => {
      render(ModelsApiHero)

      expect(
        screen.getByRole('heading', { level: 1, name: 'Models API' })
      ).toBeTruthy()
    })
  })

  describe('BuilderHero', () => {
    it('sends the primary CTA to builds and the secondary to enterprise', () => {
      render(BuilderHero)

      expect(href('Get Started')).toBe('https://platform.comfy.org/builds')
      expect(href('Enterprise: Managed Builds')).toBe('/enterprise')
    })

    it('localizes the enterprise route', () => {
      render(BuilderHero, { props: { locale: 'zh-CN' } })

      const hrefs = screen
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
      expect(hrefs).toContain('/zh-CN/enterprise')
    })
  })
})
