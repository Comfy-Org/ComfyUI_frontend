import type { Locale, LocalizedText } from '../../i18n/translations'
import { faqAnswerPlainText } from '../../utils/faqAnswer'
import { resolveFaqPairs } from '../../utils/faqPairs'
import type { JsonLdNode } from '../../utils/jsonLd'
import { jsonLdId } from '../../utils/jsonLd'

interface AffiliateFaq {
  id: string
  question: LocalizedText
  answer: LocalizedText
}

/**
 * The FAQPage node for the affiliates page.
 *
 * Out of the frontmatter because `.astro` is not instrumented, and this is the
 * kind of shaping that fails quietly: the page indexed `faq.question[locale]`
 * and `faq.answer[locale]` separately, so a locale missing either half would
 * have emitted `name: undefined` into structured data rather than failing.
 * Every affiliate FAQ carries all three locales today, which is what kept it
 * invisible.
 *
 * `resolveFaqPairs` is the same rule the model-launch pages use: a question and
 * its answer are one unit, so an item that is not translated end to end stays
 * English end to end rather than pairing one language with another.
 */
export function affiliateFaqPageNode(
  canonicalUrl: string,
  faqs: readonly AffiliateFaq[],
  locale: Locale
): JsonLdNode {
  return {
    '@type': 'FAQPage',
    '@id': jsonLdId(canonicalUrl, 'faq'),
    mainEntity: resolveFaqPairs(faqs, locale).map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faqAnswerPlainText(answer)
      }
    }))
  }
}
