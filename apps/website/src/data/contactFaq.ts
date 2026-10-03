import type { Locale } from '../i18n/translations'

import { translationsFor } from '../i18n/translations'

const faqNumbers = [1, 2, 3, 4] as const

// One source for both the rendered Q&A section and the FAQPage json-ld node,
// so the structured data always matches the on-page copy per locale.
export function contactFaqs(locale: Locale) {
  const { t } = translationsFor(locale)
  return faqNumbers.map((n) => ({
    id: String(n),
    question: t(`contact.faq.q${n}`),
    answer: t(`contact.faq.a${n}`)
  }))
}
