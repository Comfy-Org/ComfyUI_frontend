// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { ModelLaunchFaqSection as FaqSection } from './types'

import ModelLaunchFaqSection from './ModelLaunchFaqSection.vue'

const faq: FaqSection = {
  headingKey: 'ltx.faq.heading',
  items: [
    {
      id: 'what-is-ltx',
      question: {
        en: 'What is LTX-2.5?',
        ja: 'LTX-2.5とは？'
      },
      answer: {
        en: 'LTX-2.5 is the newest version of the open video model.'
      }
    }
  ]
}

describe('ModelLaunchFaqSection', () => {
  /**
   * The question and the answer used to fall back independently, so a machine
   * translation that reached the question but not the answer rendered a
   * Japanese question above an English answer. A reader cannot act on half a
   * pair, and it reads as a broken page rather than an untranslated one, so an
   * item that is not translated end to end stays English end to end.
   */
  it('keeps a question and its answer in the same language', () => {
    render(ModelLaunchFaqSection, { props: { faq, locale: 'ja' } })

    expect(screen.queryByText('LTX-2.5とは？')).toBeNull()
    expect(screen.getByText('What is LTX-2.5?')).toBeTruthy()
  })

  it('uses the locale when the whole item is translated', () => {
    const translated = {
      ...faq,
      items: [
        {
          ...faq.items[0],
          answer: { en: faq.items[0].answer.en, ja: 'LTX-2.5は最新版です。' }
        }
      ]
    }

    render(ModelLaunchFaqSection, { props: { faq: translated, locale: 'ja' } })

    expect(screen.getByText('LTX-2.5とは？')).toBeTruthy()
  })
})
