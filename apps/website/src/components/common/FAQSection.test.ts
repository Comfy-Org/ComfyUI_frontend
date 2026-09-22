import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { routerFaq } from '../../templates/platform/routerCopy'
import FAQSection from './FAQSection.vue'

describe('FAQSection', () => {
  it('reveals the requested answer when its question is expanded', async () => {
    render(FAQSection, {
      props: { locale: 'en', heading: 'Router FAQ', items: routerFaq('en') }
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

  it('resolves its copy from translation keys when given a prefix', () => {
    render(FAQSection, {
      props: {
        locale: 'en',
        headingKey: 'platform.faq.heading',
        faqPrefix: 'platform.faq',
        faqCount: 11
      }
    })

    expect(
      screen.getByRole('heading', { name: 'Frequently asked questions' })
    ).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(11)
  })
})
