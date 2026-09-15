import type { Locale } from '../i18n/translations'

import { t } from '../i18n/translations'

const faqNumbers = [1, 2, 3, 4] as const

// One source for both the rendered Q&A section and the FAQPage json-ld node,
// so the structured data always matches the on-page copy per locale.
export function contactFaqs(locale: Locale) {
  return faqNumbers.map((n) => ({
    id: String(n),
    question: t(`contact.faq.q${n}`, locale),
    answer: t(`contact.faq.a${n}`, locale)
  }))
}
