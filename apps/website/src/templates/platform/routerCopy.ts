import { createI18n } from 'vue-i18n'

import type { FaqItem } from '../../components/common/FAQSection.vue'
import { DEFAULT_LOCALE } from '../../config/locales'
import type { Locale } from '../../i18n/translations'
import en from '../../locales/en/router.json' with { type: 'json' }
import ja from '../../locales/ja/router.json' with { type: 'json' }
import zhCN from '../../locales/zh-CN/router.json' with { type: 'json' }

const routerI18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, 'zh-CN': zhCN, ja },
  missingWarn: false,
  fallbackWarn: false,
  warnHtmlMessage: false
})

export const { t: routerT } = routerI18n.global

/** The FAQ entries, in order, for as many numbered pairs as the copy holds. */
export function routerFaq(locale: Locale = 'en'): FaqItem[] {
  const items: FaqItem[] = []
  for (let n = 1; ; n += 1) {
    const question = `platform.router.faq.${n}.q`
    const answer = `platform.router.faq.${n}.a`
    if (
      !routerI18n.global.te(question, DEFAULT_LOCALE) ||
      !routerI18n.global.te(answer, DEFAULT_LOCALE)
    ) {
      return items
    }
    items.push({
      question: routerT(question, {}, { locale }),
      answer: routerT(answer, {}, { locale })
    })
  }
}
