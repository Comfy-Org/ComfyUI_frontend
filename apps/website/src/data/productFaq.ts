import type { Locale, TranslationKey } from '../i18n/translations'

import { t } from '../i18n/translations'
import { faqAnswerPlainText } from '../utils/faqAnswer'

// A few answers carry raw HTML anchors; structured data carries what the
// reader sees, so flatten tags to their inner text before the markdown and
// bare-URL pass, then collapse the whitespace-pre-line newlines.
const stripHtml = (value: string) => value.replace(/<[^>]+>/g, '')

/**
 * The FAQ entries a product page renders through common/FAQSection.vue,
 * flattened for FAQPage JSON-LD. Keep prefix and count in sync with the
 * page's wrapper (product/cloud/FAQSection.vue, product/local/FAQSection.vue).
 */
export function productFaqItems(prefix: string, count: number, locale: Locale) {
  return Array.from({ length: count }, (_, i) => ({
    question: t(`${prefix}.${i + 1}.q` as TranslationKey, locale),
    answer: faqAnswerPlainText(
      stripHtml(t(`${prefix}.${i + 1}.a` as TranslationKey, locale))
    )
      .replace(/\s+/g, ' ')
      .trim()
  }))
}
