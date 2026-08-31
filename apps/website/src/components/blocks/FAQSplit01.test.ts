// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import FAQSplit01 from './FAQSplit01.vue'

const props = {
  heading: 'Questions',
  faqs: [
    { id: 'billing', question: 'How am I billed?', answer: 'Per second.' },
    { id: 'byok', question: 'Can I bring my own key?', answer: 'Yes.' }
  ]
}

function heading() {
  return screen.getByRole('heading', { name: 'Questions' })
}

describe('FAQSplit01', () => {
  it('renders one accordion trigger per question', () => {
    render(FAQSplit01, { props })

    expect(
      screen.getByRole('button', { name: 'How am I billed?' })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Can I bring my own key?' })
    ).toBeTruthy()
  })

  it('renders a full-size heading by default', () => {
    render(FAQSplit01, { props })

    expect(heading().classList).toContain('text-4xl')
  })

  it('shrinks the heading when compact', () => {
    render(FAQSplit01, { props: { ...props, compact: true } })

    expect(heading().classList).toContain('text-2xl')
    expect(heading().classList).not.toContain('text-4xl')
  })
})
