// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubIntersectionObserver } from '../../test/fakeIntersectionObserver'
import BuilderEnterpriseSection from './BuilderEnterpriseSection.vue'
import BuilderPillarsSection from './BuilderPillarsSection.vue'
import BuilderProblemSection from './BuilderProblemSection.vue'
import ManagedBuildsClosingSection from './ManagedBuildsClosingSection.vue'
import ManagedBuildsHero from './ManagedBuildsHero.vue'
import ModelsApiCallsSection from './ModelsApiCallsSection.vue'
import ModelsApiFeaturesSection from './ModelsApiFeaturesSection.vue'
import ServerlessDeploySection from './ServerlessDeploySection.vue'
import ServerlessScaleSection from './ServerlessScaleSection.vue'

vi.mock('../../composables/useReducedMotion', () => ({
  prefersReducedMotion: () => true
}))

function href(name: string | RegExp) {
  return screen.getByRole('link', { name }).getAttribute('href')
}

function cardTitles() {
  return screen
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent?.trim())
}

// These sections are locale-driven configuration over shared blocks. The
// contract worth pinning is the card count and where the links point.
describe('platform sections', () => {
  beforeEach(() => {
    stubIntersectionObserver()
  })

  describe('BuilderPillarsSection', () => {
    it('renders the four builder pillars', () => {
      render(BuilderPillarsSection)

      expect(cardTitles()).toHaveLength(4)
      expect(cardTitles().every(Boolean)).toBe(true)
    })

    it('renders localized pillar copy', () => {
      render(BuilderPillarsSection, { props: { locale: 'zh-CN' } })

      expect(cardTitles()).toHaveLength(4)
    })
  })

  describe('ModelsApiFeaturesSection', () => {
    it('renders the six Models API features', () => {
      render(ModelsApiFeaturesSection)

      expect(cardTitles()).toHaveLength(6)
    })
  })

  describe('BuilderProblemSection', () => {
    it('lists the four pain points', () => {
      render(BuilderProblemSection)

      expect(screen.getAllByRole('listitem')).toHaveLength(4)
    })
  })

  describe('BuilderEnterpriseSection', () => {
    it('links to Managed Builds and to contact', () => {
      render(BuilderEnterpriseSection)

      expect(href('Explore Managed Builds')).toBe('/enterprise/managed-builds')
      expect(href('Contact sales')).toBe('/contact')
    })

    it('localizes both links', () => {
      render(BuilderEnterpriseSection, { props: { locale: 'zh-CN' } })

      const hrefs = screen
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
      expect(hrefs).toEqual([
        '/zh-CN/enterprise/managed-builds',
        '/zh-CN/contact'
      ])
    })
  })

  describe('ManagedBuildsHero', () => {
    it('sends its only CTA to contact', () => {
      render(ManagedBuildsHero)

      expect(href('Contact sales')).toBe('/contact')
    })

    it('localizes the CTA destination', () => {
      render(ManagedBuildsHero, { props: { locale: 'zh-CN' } })

      expect(href('联系销售')).toBe('/zh-CN/contact')
    })
  })

  describe('ManagedBuildsClosingSection', () => {
    it('closes on a single contact CTA', () => {
      render(ManagedBuildsClosingSection)

      expect(screen.getAllByRole('link')).toHaveLength(1)
      expect(href('Contact sales')).toBe('/contact')
    })
  })

  describe('ServerlessDeploySection', () => {
    it('shows the snapshot and workflow deploy paths as tabs', () => {
      render(ServerlessDeploySection)

      expect(screen.getAllByRole('tab')).toHaveLength(2)
      expect(screen.getByRole('tabpanel').textContent).toContain(
        'comfy build init --from-snapshot'
      )
    })
  })

  describe('ModelsApiCallsSection', () => {
    it('shows the three call shapes as tabs', () => {
      render(ModelsApiCallsSection)

      expect(
        screen.getAllByRole('tab').map((tab) => tab.textContent?.trim())
      ).toEqual(['run', 'subscribe', 'submit'])
    })
  })

  describe('ServerlessScaleSection', () => {
    it('renders its heading and the log-stream diagram', () => {
      render(ServerlessScaleSection)

      expect(screen.getAllByRole('heading')).not.toHaveLength(0)
    })
  })
})
