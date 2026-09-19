import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import FAQSection from './FAQSection.vue'

describe('FAQSection', () => {
  it('reveals the requested answer when its question is expanded', async () => {
    render(FAQSection, {
      props: {
        locale: 'en',
        headingKey: 'platform.router.faq.heading',
        faqPrefix: 'platform.router.faq',
        faqCount: 12
      }
    })

    const question = screen.getByRole('button', {
      name: 'Do I need a Comfy subscription?'
    })
    expect(question.getAttribute('aria-expanded')).toBe('false')

    await userEvent.click(question)

    expect(question.getAttribute('aria-expanded')).toBe('true')
    expect(
      screen.getByText(
        'No. Router runs on credits. Add credits and start calling models.'
      )
    ).toBeTruthy()
  })
})
