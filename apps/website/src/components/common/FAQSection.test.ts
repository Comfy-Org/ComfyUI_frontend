import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import FAQSection from './FAQSection.vue'

describe('FAQSection', () => {
  it.for([
    {
      prefix: 'download.faq',
      questions: ['Do I need a GPU to run ComfyUI locally?']
    },
    { prefix: 'missing.faq', questions: [] }
  ])('renders available FAQ pairs for $prefix', ({ prefix, questions }) => {
    render(FAQSection, {
      props: {
        locale: 'en',
        headingKey: 'download.faq.heading',
        faqPrefix: prefix,
        faqCount: 1
      }
    })

    expect(screen.queryAllByRole('button')).toEqual(
      questions.map((name) => screen.getByRole('button', { name }))
    )
  })
})
