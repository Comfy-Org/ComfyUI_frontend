import { describe, expect, it } from 'vitest'

import type { Locale } from '../../i18n/translations'

import { cliFaqs } from './faqs'

const locales: Locale[] = ['en', 'zh-CN']

describe('cliFaqs', () => {
  it.each(locales)(
    'returns 10 populated items with unique ids for %s',
    (locale) => {
      const faqs = cliFaqs(locale)

      expect(faqs).toHaveLength(10)
      expect(new Set(faqs.map((faq) => faq.id)).size).toBe(10)
      for (const faq of faqs) {
        expect(faq.question).not.toBe('')
        expect(faq.answer).not.toBe('')
      }
    }
  )

  it('keeps ids identical across locales', () => {
    const ids = (locale: Locale) => cliFaqs(locale).map((faq) => faq.id)

    expect(ids('zh-CN')).toEqual(ids('en'))
  })
})
