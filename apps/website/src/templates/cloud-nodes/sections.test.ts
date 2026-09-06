// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { externalLinks } from '../../config/routes'
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
  // The block renders titleHighlight BEFORE title, so the halves being the
  // right way round is not obvious from the config alone.
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
    expect(hrefs).toContain(externalLinks.cloud)
    expect(hrefs).toContain(externalLinks.docsCloudNodes)
  })
})

describe('SetupSection', () => {
  it('lists three steps and links how to update', () => {
    const { container } = render(SetupSection, { props })
    expect(container.querySelectorAll('article')).toHaveLength(3)
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toContain(externalLinks.docsUpdateComfyUI)
  })
})

describe('ModelsSection', () => {
  it('renders one tile per model', () => {
    const { container } = render(ModelsSection, { props })
    expect(container.querySelectorAll('li')).toHaveLength(
      cloudNodeModelCards.length
    )
  })

  // It used to promise "the docs" and link to /cloud-nodes, the page you are
  // already on.
  it('sends the node reference to the docs, not back to this page', () => {
    render(ModelsSection, { props })
    const link = screen.getByRole('link', { name: /node reference/i })
    expect(link.getAttribute('href')).toBe(externalLinks.docsCloudNodes)
  })
})

describe('HowItWorksSection', () => {
  it('lists the four mechanism points', () => {
    const { container } = render(HowItWorksSection, { props })
    expect(container.querySelectorAll('li')).toHaveLength(4)
  })
})

describe('WhySection', () => {
  it('lists the four reasons', () => {
    render(WhySection, { props })
    expect(screen.getByText('The VRAM wall')).toBeTruthy()
    expect(screen.getByText('No plan to buy')).toBeTruthy()
  })
})

describe('FAQSection', () => {
  it('asks the seven launch questions, beta first', () => {
    const { container } = render(FAQSection, { props })
    const questions = container.querySelectorAll('button')
    expect(questions.length).toBeGreaterThanOrEqual(7)
    expect(screen.getByText(/why are these marked beta/i)).toBeTruthy()
  })
})

describe('ClosingCtaSection', () => {
  it('closes on getting started', () => {
    render(ClosingCtaSection, { props })
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toContain(externalLinks.cloud)
  })
})
