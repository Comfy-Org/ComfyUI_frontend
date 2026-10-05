import type { FaqItem } from '@/components/common/FAQSection.vue'
import { DEFAULT_LOCALE } from '@/config/locales'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

/** The FAQ entries, in order, for as many numbered pairs as the copy holds. */
export function routerFaq(locale: Locale = 'en'): FaqItem[] {
  const { t, te } = translationsFor(locale)
  const items: FaqItem[] = []
  for (let n = 1; ; n += 1) {
    const question = `platform.router.faq.${n}.q`
    const answer = `platform.router.faq.${n}.a`
    if (!te(question, DEFAULT_LOCALE) || !te(answer, DEFAULT_LOCALE)) {
      return items
    }
    items.push({
      question: t(question),
      answer: t(answer)
    })
  }
}
