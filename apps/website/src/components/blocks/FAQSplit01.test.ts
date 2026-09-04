// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import FAQSplit01 from './FAQSplit01.vue'

const faqs = [
  {
    id: 'gpu',
    question: 'Do I need a GPU?',
    answer: 'A dedicated GPU is strongly recommended for local runs.'
  },
  {
    id: 'cloud',
    question: 'Can I run it on Comfy Cloud?',
    answer: 'Yes, every workflow runs unchanged on Comfy Cloud.'
  }
]

function panelWith(answer: string) {
  const panel = screen
    .getAllByRole('region', { hidden: true })
    .find((region) => within(region).queryByText(answer) !== null)
  if (!panel) throw new Error(`no panel renders "${answer}"`)
  return panel
}

describe('FAQSplit01', () => {
  it('keeps every answer in the document while collapsed', () => {
    render(FAQSplit01, { props: { heading: 'FAQ', faqs } })

    for (const faq of faqs) {
      // happy-dom does not model the "until-found" content-visibility state
      // reka-ui renders in a real browser (Accordion's Presence resolution
      // differs from the CSS-driven one browsers use), so this only asserts
      // that the answer stays mounted and hidden, not the exact attribute
      // value. FAQSplit01.vue's :unmount-on-hide="false" is what produces
      // hidden="until-found" at runtime; see FAQSplit01.vue for that wiring.
      expect(panelWith(faq.answer).hasAttribute('hidden')).toBe(true)
    }
    expect(
      screen
        .getByRole('button', { name: faqs[0].question })
        .getAttribute('aria-expanded')
    ).toBe('false')
  })

  it('reveals an answer when its question is opened', async () => {
    render(FAQSplit01, { props: { heading: 'FAQ', faqs } })
    const trigger = screen.getByRole('button', { name: faqs[0].question })

    await userEvent.click(trigger)
    await nextTick()

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(
      within(screen.getByRole('region', { name: faqs[0].question })).getByText(
        faqs[0].answer
      )
    ).toBeDefined()
    expect(panelWith(faqs[1].answer).hasAttribute('hidden')).toBe(true)
  })
})
