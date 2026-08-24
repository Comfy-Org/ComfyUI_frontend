// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import FAQSection from './FAQSection.vue'

describe('FAQSection', () => {
  it('renders each question as a heading-wrapped accordion trigger', async () => {
    render(FAQSection, {
      props: {
        headingKey: 'cloud.faq.heading',
        faqPrefix: 'cloud.faq',
        faqCount: 12,
        footerKey: 'cloud.faq.footer'
      }
    })

    const questions = screen.getAllByRole('heading', { level: 3 })
    expect(questions).toHaveLength(12)

    const firstTrigger = screen.getAllByRole('button')[0]
    expect(firstTrigger.closest('h3')).toBeTruthy()
    expect(firstTrigger.getAttribute('aria-expanded')).toBe('false')

    await firstTrigger.click()
    expect(firstTrigger.getAttribute('aria-expanded')).toBe('true')
  })
})
