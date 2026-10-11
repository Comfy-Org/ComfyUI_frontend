import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const faqNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

/**
 * Shared between the on-page accordion and the FAQPage JSON-LD in
 * pages/cli.astro so the structured data always matches the rendered copy.
 */
export function cliFaqs(locale: Locale) {
  const { t } = translationsFor(locale)
  return faqNumbers.map((n) => ({
    id: String(n),
    question: t(`cli.faq.${n}.q`),
    answer: t(`cli.faq.${n}.a`)
  }))
}
