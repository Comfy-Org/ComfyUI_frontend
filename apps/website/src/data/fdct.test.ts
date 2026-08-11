import { describe, expect, it } from 'vitest'

import type { Locale } from '../i18n/translations'
import { parseFaqAnswer } from '../utils/faqAnswer'
import { applyFdctUrl, fdctFaqs, fdctPage } from './fdct'

const LOCALES = ['en', 'zh-CN'] as const satisfies readonly Locale[]

function applyLinks(locale: Locale) {
  return fdctFaqs(locale)
    .flatMap((faq) => parseFaqAnswer(faq.answer))
    .filter((part) => part.type === 'link' && part.value === applyFdctUrl)
}

describe('fdct apply pathway', () => {
  it.for(LOCALES)('links to the FDCT role from the %s Q&A', (locale) => {
    expect(applyLinks(locale)).toHaveLength(1)
  })

  it.for(LOCALES)(
    'leaves no unresolved link placeholder in the %s Q&A',
    (locale) => {
      const unresolved = fdctFaqs(locale).filter((faq) =>
        faq.answer.includes('{applyUrl}')
      )

      expect(unresolved).toEqual([])
    }
  )

  it('exposes the FDCT role through the Q&A only, never as a page CTA', () => {
    const ctasToTheRole = Object.entries(fdctPage.ctas).filter(([, href]) =>
      href.startsWith('https://jobs.ashbyhq.com/')
    )

    expect(ctasToTheRole).toEqual([])
  })
})
