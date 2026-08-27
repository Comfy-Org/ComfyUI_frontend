import { describe, expect, it } from 'vitest'

import { developersFaqs } from './developers'

const PLACEHOLDER_ANSWER = 'TODO: answer pending content review.'

describe('developersFaqs', () => {
  // The page's FAQPage json-ld filters on `pending`, so drift between the flag
  // and the copy would publish a placeholder as an acceptedAnswer.
  it('flags exactly the placeholder answers as pending', () => {
    for (const faq of developersFaqs('en')) {
      expect(faq.pending).toBe(faq.answer === PLACEHOLDER_ANSWER)
    }
  })

  it('agrees on which answers are pending across locales', () => {
    const pendingIds = (locale: 'en' | 'zh-CN') =>
      developersFaqs(locale)
        .filter((faq) => faq.pending)
        .map((faq) => faq.id)

    expect(pendingIds('zh-CN')).toEqual(pendingIds('en'))
  })

  it('carries the nine questions the design asks for', () => {
    const faqs = developersFaqs('en')

    expect(faqs.map((faq) => faq.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9'
    ])
    expect(faqs[0].question).toBe('What is the Comfy Developer Platform?')
  })
})
