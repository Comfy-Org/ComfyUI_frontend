import type { FaqItem } from '../../components/common/FAQSection.vue'
import type { Locale } from '../../i18n/translations'
import { createTranslator } from '../../i18n/translations'
import en from '../../locales/en/router.json' with { type: 'json' }
import ja from '../../locales/ja/router.json' with { type: 'json' }
import zhCN from '../../locales/zh-CN/router.json' with { type: 'json' }

// The Router landing page's copy lives with the page rather than in the
// sitewide translations chunk, which every route pays for.
const router = createTranslator({ en, 'zh-CN': zhCN, ja })

export const routerT = router.t

/** The FAQ entries, in order, for as many numbered pairs as the copy holds. */
export function routerFaq(locale: Locale = 'en'): FaqItem[] {
  const items: FaqItem[] = []
  for (let n = 1; ; n += 1) {
    const question = `platform.router.faq.${n}.q`
    const answer = `platform.router.faq.${n}.a`
    if (!router.hasKey(question) || !router.hasKey(answer)) return items
    items.push({
      question: routerT(question, locale),
      answer: routerT(answer, locale)
    })
  }
}
