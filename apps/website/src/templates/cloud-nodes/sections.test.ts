// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { externalLinks, getRoutes } from '../../config/routes'
import ClosingCtaSection from './ClosingCtaSection.vue'
import FAQSection from './FAQSection.vue'
import HeroSection from './HeroSection.vue'
import HowItWorksSection from './HowItWorksSection.vue'
import ModelsSection from './ModelsSection.vue'
import SetupSection from './SetupSection.vue'
import WhySection from './WhySection.vue'
import { cloudNodeModelCards } from './modelCards'

const props = { locale: 'en' as const }

describe('HeroSection', () => {
  it('reads "Your graph. Our GPUs." in that order', () => {
    render(HeroSection, { props, global: { stubs: { VideoPlayer: true } } })
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Your graph. Our GPUs.'
    )
  })

  it('offers the docs alongside getting started', () => {
    render(HeroSection, { props, global: { stubs: { VideoPlayer: true } } })
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toContain(getRoutes('en').download)
    expect(hrefs).toContain(externalLinks.docsCloudNodes)
  })
})

describe('SetupSection', () => {
  it('lists four steps and links how to update', () => {
    render(SetupSection, { props })
    expect(screen.getAllByRole('article')).toHaveLength(4)
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toContain(externalLinks.docsUpdateComfyUI)
  })
})

describe('ModelsSection', () => {
  it('renders one tile per model', () => {
    render(ModelsSection, { props })
    expect(screen.getAllByRole('listitem')).toHaveLength(
      cloudNodeModelCards.length
    )
  })

  it('sends the node reference to the docs, not back to this page', () => {
    render(ModelsSection, { props })
    const link = screen.getByRole('link', { name: /node reference/i })
    expect(link.getAttribute('href')).toBe(externalLinks.docsCloudNodes)
  })
})

describe('HowItWorksSection', () => {
  it('lists the four mechanism points', () => {
    render(HowItWorksSection, { props })
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })
})

describe('WhySection', () => {
  it('lists the four reasons', () => {
    render(WhySection, { props })
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4)
  })
})

describe('FAQSection', () => {
  it('asks the seven launch questions, beta first', () => {
    render(FAQSection, { props })
    const questions = screen.getAllByRole('button')
    expect(questions).toHaveLength(7)
    expect(questions[0].textContent).toMatch(/why are these marked beta/i)
  })
})

describe('ClosingCtaSection', () => {
  it('closes on getting started', () => {
    render(ClosingCtaSection, { props })
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toContain(getRoutes('en').download)
  })
})
