import { describe, expect, it } from 'vitest'

import { contactFaqs } from './contactFaq'

describe('contactFaqs', () => {
  it('resolves every question and answer in both locales', () => {
    for (const locale of ['en', 'zh-CN'] as const) {
      const faqs = contactFaqs(locale)
      expect(faqs).toHaveLength(4)
      for (const faq of faqs) {
        expect(faq.question, `${faq.id} question (${locale})`).not.toBe('')
        expect(faq.answer, `${faq.id} answer (${locale})`).not.toBe('')
      }
    }
  })
})
